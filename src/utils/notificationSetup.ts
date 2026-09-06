import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Rescued from the deleted backgroundLocationTask.ts. Must run at module
// scope and be reachable from a headless (no-Activity) JS context too --
// shiftTimerTask.ts's tick can fire a notification directly (an out-of-fence
// alert, or an integrity warning) with no App.tsx render in between -- so
// this is imported from index.ts, not App.tsx. See index.ts's comment.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
