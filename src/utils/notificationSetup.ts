import { Platform } from 'react-native';
import { getNotifications } from '../native/notificationsModule';

/**
 * Notification setup, run once at startup.
 *
 * Rescued from the deleted backgroundLocationTask.ts. Must run at module scope
 * and be reachable from a headless (no-Activity) JS context too —
 * shiftTimerTask.ts's tick can fire a notification directly with no App.tsx
 * render in between — so this is imported from index.ts, not App.tsx.
 *
 * THE IMPORT ITSELF IS THE HAZARD, which is why expo-notifications is reached
 * through getNotifications() rather than imported directly. The library
 * registers a push-token listener at its own module scope, and since SDK 53
 * that throws on Android inside Expo Go. A static import here meant the throw
 * landed during evaluation of the very first file index.ts loads:
 *
 *     [runtime not ready]: Error: expo-notifications: Android Push
 *     notifications ... was removed from Expo Go with the release of SDK 53
 *
 * — the whole bundle, dead before first paint, on Android only. Everything
 * below is additionally wrapped: this file must not be able to stop the app
 * starting, whatever the runtime lacks.
 */
const Notifications = getNotifications();

if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (err) {
    console.warn('[notificationSetup] handler unavailable in this runtime', err);
  }

  /**
   * The Android channel.
   *
   * AndroidImportance can be undefined where the module's Android surface is
   * absent, and reading .DEFAULT off it throws synchronously. 3 is Android's
   * own IMPORTANCE_DEFAULT — fixed by the platform rather than this library —
   * so the fallback still creates the channel correctly. The promise is caught
   * because it was previously neither awaited nor handled.
   */
  if (Platform.OS === 'android') {
    try {
      const importance = (Notifications.AndroidImportance?.DEFAULT ??
        3) as import('expo-notifications').AndroidImportance;
      void Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance,
      })?.catch((err: unknown) => {
        console.warn('[notificationSetup] android channel not set', err);
      });
    } catch (err) {
      console.warn('[notificationSetup] android channels unavailable', err);
    }
  }
}
