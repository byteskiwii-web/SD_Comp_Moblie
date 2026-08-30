import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { BACKGROUND_LOCATION_TASK } from '../constants/config';
import { useShiftStore } from '../stores/shiftStore';
import { useAuthStore } from '../stores/authStore';
import { locationCheck } from '../api/attendance.api';
import { Platform } from 'react-native';

// Required for scheduleNotificationAsync() below to actually surface a
// notification while the app is foregrounded; harmless if we're backgrounded.
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

// Must be registered at module scope, imported once from App.tsx, so the OS
// can find this handler again even if it revived the JS context after the
// app process was killed while a background task was still scheduled.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[locationTask] error', error.message);
    return;
  }

  // Safety net: if we're not actually clocked in anymore, or we're on a
  // break (e.g. clock-out or break-start raced with a scheduled tick),
  // don't call the API. useLocationPollingEffect stops this task on those
  // same transitions, but a tick already in flight can still land here.
  const shift = useShiftStore.getState();
  if (!shift.isClockedIn || !shift.storeCode || shift.isOnBreak) return;

  const auth = useAuthStore.getState();
  const employeeId = auth.employee?.id;
  if (!employeeId) return;

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const point = locations?.[locations.length - 1];
  if (!point) return;

  try {
    const result = await locationCheck({
      employee_id: employeeId,
      store_code: shift.storeCode,
      latitude: point.coords.latitude,
      longitude: point.coords.longitude,
    });

    if (result.alert) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Outside your store',
          body: result.alert,
        },
        trigger: null,
      });
    }
  } catch (err) {
    console.warn('[locationTask] location-check failed', err);
  }
});

export async function startBackgroundLocationPolling(): Promise<void> {
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyRunning) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 12 * 60 * 1000, // 12 min -- iOS treats this as a floor, not a guarantee
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Clocked in',
      notificationBody: 'Checking your location periodically while you are on shift.',
      notificationColor: '#1E40AF',
    },
  });
}

export async function stopBackgroundLocationPolling(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (!isRunning) return;
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
