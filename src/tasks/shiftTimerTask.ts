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
          accuracy_m: probe.coords.accuracy,
        });
        if (result.alert) {
          // Resolved per use: this runs in a headless context where the
          // module may be unavailable, and a missing alert must not
          // reject the task -- a rejected headless task never calls
          // notifyTaskFinished, so the wakelock is held indefinitely.
          await getNotifications()?.scheduleNotificationAsync({
            content: { title: result.alertTitle ?? 'Outside your store', body: result.alert, data: { kind: 'geofence-alert' } },
            trigger: null,
          });
        }
      } catch (err) {
        console.warn('[shiftTimer] locationCheck failed', err);
      }
    }

    // 'ok' and 'timeout' both mean the switch is on -- a slow fix indoors is
    // a bad signal, not location off -- so they report "on".
    //
    // 'disabled' is reported as UNKNOWN here, not "off": this tick runs in the
    // background, and Android battery savers (Samsung, Xiaomi, Oppo, Vivo...)
    // switch location off while the screen is locked even though the user has
    // it on. A real outage is still caught -- by the app's own check the
    // moment it is opened, and by the server's gap inference after 40 min.
    await checkShiftIntegrity(probe.status === 'disabled' ? null : false);
  } catch (err) {
    console.warn('[shiftTimer] tick failed', err);
  }
  console.log('[shiftTimer] tick end');
}
