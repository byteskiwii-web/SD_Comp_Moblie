import { getNotifications } from '../native/notificationsModule';
import { useAuthStore } from '../stores/authStore';
import { useShiftStore } from '../stores/shiftStore';
import { locationCheck } from '../api/attendance.api';
import { checkShiftIntegrity } from '../utils/shiftIntegrityCheck';
import { probeLocation } from '../utils/locationProbe';

/**
 * The tick body run by ShiftTimerTickService (native) via
 * AppRegistry.registerHeadlessTask (see registerShiftTimerTask.ts), roughly
 * every LOCATION_POLL_INTERVAL_MS regardless of app state or location
 * availability -- see ShiftTimerService.kt's AlarmManager scheduling for why
 * this fires when the old expo-location-callback-driven approach (silent
 * with Location off) didn't.
 *
 * MUST always resolve, never reject: a rejected headless task never calls
 * notifyTaskFinished on the native side, so ShiftTimerTickService never
 * stopSelf()s and the wakelock acquired for this tick is held indefinitely.
 * Hence the outer try/catch swallowing everything.
 */
export async function runShiftTimerTick(): Promise<void> {
  console.log('[shiftTimer] tick start');
  try {
    // In a cold-start headless context (process was killed, OS revived just
    // this task), none of the app's normal startup ran: the JWT is still
    // unread in SecureStore (every API call would 401) and the persisted
    // shift store still holds its defaults (isClockedIn: false), since
    // zustand's persist middleware hydrates asynchronously. Same fix as the
    // old backgroundLocationTask.ts used.
    await Promise.all([useAuthStore.getState().hydrate(), useShiftStore.persist.rehydrate()]);

    const shift = useShiftStore.getState();
    if (!shift.isClockedIn || !shift.storeCode || shift.isOnBreak) {
      console.log('[shiftTimer] tick skipped -- not on a trackable shift');
      return;
    }
    const employeeId = useAuthStore.getState().employee?.id;
    if (!employeeId) {
      console.log('[shiftTimer] tick skipped -- no employee id after hydration');
      return;
    }

    const probe = await probeLocation();
    console.log(`[shiftTimer] probe=${probe.status}`);

    if (probe.status === 'ok') {
      try {
        const result = await locationCheck({
          employee_id: employeeId,
          store_code: shift.storeCode,
          latitude: probe.coords.latitude,
          longitude: probe.coords.longitude,
        });
        if (result.alert) {
          // Resolved per use: this runs in a headless context where the
          // module may be unavailable, and a missing alert must not
          // reject the task -- a rejected headless task never calls
          // notifyTaskFinished, so the wakelock is held indefinitely.
          await getNotifications()?.scheduleNotificationAsync({
            content: { title: 'Outside your store', body: result.alert, data: { kind: 'geofence-alert' } },
            trigger: null,
          });
        }
      } catch (err) {
        console.warn('[shiftTimer] locationCheck failed', err);
      }
    }

    // 'disabled' is direct evidence -- report it now instead of waiting on
    // the server's gap inference. 'timeout' is NOT evidence of anything (bad
    // signal, not off); leave knownLocationOff undefined so the server falls
    // back to its own inference for a persistently bad signal instead of
    // this tick punishing one slow fix.
    await checkShiftIntegrity(probe.status === 'disabled' ? true : undefined);
  } catch (err) {
    console.warn('[shiftTimer] tick failed', err);
  }
  console.log('[shiftTimer] tick end');
}
