import { Directory, File, Paths } from 'expo-file-system';
import { API_V1 } from '../constants/config';
import { queryClient } from '../api/queryClient';
import { useShiftStore } from '../stores/shiftStore';
import { useNotificationsStore } from '../stores/notificationsStore';
import { useConsentStore } from '../stores/consentStore';
import { getNotifications } from '../native/notificationsModule';

/**
 * End the session on the server as well as on the phone (STORE-011).
 *
 * Sign-out used to clear only the keychain. The refresh token stayed valid
 * server-side until it expired, and the device's push token -- which the
 * server ties to that session -- kept receiving the signed-out person's
 * notifications. Revoking the session stops both: push delivery already
 * skips tokens whose session is revoked.
 *
 * A plain fetch, not the API client, on purpose. The client answers a 401 by
 * refreshing and, when that fails, by signing out -- which would call this
 * again. A session that is already dead (displaced, deleted) simply answers
 * 401 here, and that is fine: there is nothing left to revoke.
 *
 * Never awaited by sign-out and never allowed to throw: an employee pressing
 * Sign out on a phone with no signal must still be signed out.
 */
export function revokeServerSession(token: string): void {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  fetch(`${API_V1}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

/**
 * Remove everything on the phone that belongs to the person signing out.
 *
 * Store phones are shared between shifts, so each of these was a way for the
 * next person to see or receive the previous one's things:
 *
 *   - cached answers (policies, inbox, leave summary -- some not keyed by
 *     employee, so they were served straight to the next account);
 *   - the local alert history shown in the app;
 *   - the background-location disclosure acceptance -- a new person is a new
 *     disclosure, which is what consentStore's own comment already promised;
 *   - shift state, and scheduled reminders: a clock-out reminder filed for one
 *     person would otherwise fire for the next;
 *   - downloaded documents, policy files and profile photos in the app cache.
 *
 * Each step is independent and best-effort: one failing must not leave the
 * others undone, and none of them may stop the sign-out itself.
 */
export async function wipeUserData(): Promise<void> {
  const steps: (() => unknown)[] = [
    () => queryClient.clear(),
    () => useShiftStore.getState().setClockedOut(),
    () => useNotificationsStore.getState().clear(),
    () => useConsentStore.getState().clearConsents(),
    () => getNotifications()?.cancelAllScheduledNotificationsAsync(),
    () => clearCachedFiles(),
  ];
  for (const step of steps) {
    try {
      await step();
    } catch (err) {
      console.warn('[signOut] a cleanup step failed; continuing', err);
    }
  }
}

/**
 * Files the app downloaded into its cache: documents, policy attachments and
 * profile photos (in `avatars/`). Only loose files at the top level and that
 * one folder -- other folders there belong to libraries (the image picker's
 * temporary directory, for one) and are theirs to manage.
 */
function clearCachedFiles(): void {
  const root = new Directory(Paths.cache);
  if (!root.exists) return;
  for (const entry of root.list()) {
    try {
      if (entry instanceof File) entry.delete();
      else if (entry instanceof Directory && entry.name === 'avatars') entry.delete();
    } catch {
      // In use, or already gone -- either way it is not this person's to keep.
    }
  }
}
