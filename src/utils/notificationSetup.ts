import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Rescued from the deleted backgroundLocationTask.ts. Must run at module
// scope and be reachable from a headless (no-Activity) JS context too --
// shiftTimerTask.ts's tick can fire a notification directly (an out-of-fence
// alert, or an integrity warning) with no App.tsx render in between -- so
// this is imported from index.ts, not App.tsx. See index.ts's comment.
//
// EVERYTHING HERE IS WRAPPED, and that is not defensive habit -- this file is
// evaluated by `import './src/utils/notificationSetup'` in index.ts, before
// App is even imported. A throw here is not a broken notification, it is a
// bundle that never finishes loading: Expo Go shows "Something went wrong"
// with no screen behind it and no way to reach the error from the app.
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
 * Two separate failure modes, and the first is the dangerous one:
 *
 *   - `Notifications.AndroidImportance` can be undefined where the module's
 *     Android surface is not present. Reading `.DEFAULT` off it then throws
 *     SYNCHRONOUSLY, at module scope, on Android only -- which looks exactly
 *     like an app that runs on iOS and dies on Android before first paint.
 *
 *   - `setNotificationChannelAsync` returns a promise that was neither
 *     awaited nor caught, so a rejection surfaced as an unhandled rejection
 *     rather than as anything actionable.
 *
 * The optional chain covers the first and the catch covers the second. A
 * missing channel costs a notification its custom importance; it must never
 * cost the whole app its startup.
 */
if (Platform.OS === 'android') {
  try {
    // 3 is Android`s own IMPORTANCE_DEFAULT. Hardcoded as the fallback so a
    // missing enum costs nothing -- the channel is still created correctly,
    // and the constant is fixed by the platform rather than by this library.
    const importance = (Notifications.AndroidImportance?.DEFAULT ??
      3) as Notifications.AndroidImportance;
    void Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance,
    })?.catch((err: unknown) => {
      console.warn('[notificationSetup] android channel not set', err);
    });
  } catch (err) {
    console.warn('[notificationSetup] android channels unavailable in this runtime', err);
  }
}
