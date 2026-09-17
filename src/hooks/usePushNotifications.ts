import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { getNotifications } from '../native/notificationsModule';
import { hasRemotePush } from '../native/runtime';
import { registerPushToken } from '../api/devices.api';
import { useAuthStore } from '../stores/authStore';
import { navigationRef } from '../navigation/navigationRef';
import { resolveLinkTarget } from '../screens/notifications/linkTarget';

/**
 * What a server push carries in `data`. Mirrors the sender
 * (SD_Computer/src/modules/devices/push.js) — the row's id, its type, and
 * the same linkPath the inbox row has, so a tap can open the right screen.
 */
type PushData = { id?: string; type?: string; linkPath?: string | null };

/**
 * The launch tap already acted on. Module-level, not in the effect: Android
 * keeps answering getLastNotificationResponseAsync with the same response
 * for the life of the process, and the effect re-runs on every session
 * change — without this a sign-in would re-open a tap from an hour ago.
 */
let openedLaunchId: string | null = null;

/** Every query a server notification can make stale, by its type. */
const STALE_BY_TYPE: Record<string, string[][]> = {
  leave: [['leave'], ['leave-summary'], ['team-leave'], ['home-team-leave']],
  regularisation: [['attendance-today'], ['attendance-day'], ['attendance-month'], ['attendance-history']],
  policy: [['policies-outstanding'], ['policies-library']],
  onboarding: [['my-documents'], ['auth-me-extras']],
  kudos: [['kudos']],
};

/**
 * Push notifications, for the signed-in session.
 *
 * Three jobs, all guarded so a runtime without the capability loses only the
 * feature and never the app:
 *
 *   1. REGISTER. Ask for permission, get this phone's Expo push token, and
 *      hand it to the server. Once per session: the effect keys on the access
 *      token, so a fresh sign-in registers again and a refresh rotation does
 *      not. Sign-out needs nothing here — the server ties the token to the
 *      session, and a revoked session stops receiving in the same statement.
 *
 *   2. REFRESH. A push that arrives while the app is open means the inbox
 *      and whatever it is about are stale; invalidate them, so the badge and
 *      the Leave tab update as the decision is taken rather than on the next
 *      poll. The push is not rendered from — the API is re-read.
 *
 *   3. OPEN. A tap on a push — app in the background, or closed and launched
 *      by it — goes where the notification's linkPath says, through the same
 *      mapping the inbox sheet uses. Unknown paths do nothing, as there.
 *
 * Expo Go cannot hold a push token for this project (see hasRemotePush), so
 * there the hook is inert and the badge keeps its 20 s poll.
 */
export function usePushNotifications(): void {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const registeredFor = useRef<string | null>(null);

  // 1. Register this phone for the current session.
  useEffect(() => {
    if (!token || !hasRemotePush) return;
    if (registeredFor.current === token) return;
    const Notifications = getNotifications();
    if (!Notifications) return;

    let cancelled = false;
    (async () => {
      try {
        let perms = await Notifications.getPermissionsAsync();
        if (perms.status !== 'granted') perms = await Notifications.requestPermissionsAsync();
        if (perms.status !== 'granted') return; // their choice; the inbox still works

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const { data: pushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        if (cancelled || !pushToken) return;

        await registerPushToken({
          token: pushToken,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          appVersion: Constants.expoConfig?.version ?? null,
        });
        registeredFor.current = token;
      } catch (err) {
        // An emulator without Play services, a phone with no network yet, a
        // 401 on a session that just ended — all recoverable by the next
        // launch, none worth a screen. The inbox is unaffected.
        console.warn('[push] registration skipped', err);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // 2 & 3. Listen for pushes arriving and pushes tapped.
  useEffect(() => {
    if (!token) return;
    const Notifications = getNotifications();
    if (!Notifications) return;

    const refreshFor = (data: PushData | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      for (const key of STALE_BY_TYPE[data?.type ?? ''] ?? []) queryClient.invalidateQueries({ queryKey: key });
      // Kit status (and other onboarding facts) live on the profile record,
      // not in a query -- re-read it so "Kit issued" shows without a pull.
      if (data?.type === 'onboarding') void useAuthStore.getState().refreshProfile();
    };

    const open = (data: PushData | undefined) => {
      const target = resolveLinkTarget(data?.linkPath);
      if (!target || !navigationRef.isReady()) return;
      try {
        navigationRef.navigate(target.tab, target.screen ? { screen: target.screen, params: target.params } : undefined);
      } catch (err) {
        // A tab that is not mounted right now (a gate screen is showing).
        // The person is where they need to be for that; do nothing.
        console.warn('[push] could not open', err);
      }
    };

    const isServerPush = (data: unknown): data is PushData =>
      !!data && typeof data === 'object' && typeof (data as PushData).id === 'string';

    const received = Notifications.addNotificationReceivedListener((event) => {
      const data = event.request.content.data;
      if (isServerPush(data)) refreshFor(data);
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!isServerPush(data)) return;
      openedLaunchId = data.id ?? null; // so the launch check below never repeats it
      refreshFor(data);
      open(data);
    });

    // Launched by a tap: the response listener above was not yet mounted
    // when it happened, so ask for it once.
    Notifications.getLastNotificationResponseAsync?.()
      .then((response) => {
        const data = response?.notification.request.content.data;
        if (!isServerPush(data) || openedLaunchId === data.id) return;
        openedLaunchId = data.id ?? null;
        refreshFor(data);
        open(data);
      })
      .catch(() => {});

    return () => {
      received.remove();
      tapped.remove();
    };
  }, [token, queryClient]);
}
