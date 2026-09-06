import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LEGACY_BACKGROUND_LOCATION_TASK as LEGACY_TASK } from '../constants/config';

/**
 * One-time teardown for a device upgrading from the pre-shift-timer APK,
 * which registered this task via expo-location's startLocationUpdatesAsync
 * (backgroundLocationTask.ts, now deleted). Without this, an upgrading
 * device would run BOTH the old registration and the new ShiftTimer service
 * -- two foreground services, two persistent notifications, and "Task not
 * found" noise once the old JS handler no longer exists to receive it.
 *
 * Safe to call on every launch: both checks are cheap, and a clean install
 * (or one already cleaned up) simply finds nothing to do. Keep for at least
 * one release cycle, then delete.
 */
export async function stopLegacyLocationTask(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LEGACY_TASK)) {
      await Location.stopLocationUpdatesAsync(LEGACY_TASK);
    }
    if (await TaskManager.isTaskRegisteredAsync(LEGACY_TASK)) {
      await TaskManager.unregisterTaskAsync(LEGACY_TASK);
    }
  } catch {
    // Nothing registered on this install, or the check itself isn't
    // supported in this context -- either way, nothing to clean up.
  }
}
