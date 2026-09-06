import JailMonkey from 'jail-monkey';
import { useShiftStore } from '../stores/shiftStore';
import { reportIntegrityState, AttendanceAlertConditions, AttendanceAlertType } from '../api/attendanceAlerts.api';
import { fireIntegrityAlertNotification } from './notifications';

const today = () => new Date().toISOString().slice(0, 10);

const WARNING_TITLE: Record<AttendanceAlertType, string> = {
  location_off: 'Location is off',
  developer_mode: 'Developer Mode is on',
};
const WARNING_ACTION: Record<AttendanceAlertType, string> = {
  location_off: 'turn location back on',
  developer_mode: 'disable Developer Mode',
};

/**
 * Checks Developer Mode and reports it, optionally alongside a DIRECTLY
 * known location-off state.
 *
 * Called from two places on different cadences -- the foreground hook
 * (useShiftIntegrityWatcher, ~60s while the app is open, which never knows
 * its own location state reliably and so omits knownLocationOff -- the
 * server's gap inference is the fallback for that caller) and the native
 * shift-timer's tick (shiftTimerTask.ts, roughly every 12 min including
 * while the app is closed), which DOES attempt a location fix on every wake
 * and so can pass a direct answer for instant detection instead of waiting
 * on the server's gap threshold.
 *
 * Holds NO state about what it has already reported. It sends the current
 * state every time, and the server decides whether that is a new detection
 * (attendanceAlert.service.js#recordIntegrityState owns the open-period
 * flags per condition). The response's `counted` says which conditions
 * actually incremented, and only those produce a notification -- so a
 * continuing outage reports repeatedly but warns exactly once.
 *
 * No-ops entirely when not on shift -- the same isClockedIn && !isOnBreak
 * gate useLocationPollingEffect uses for the geofence poll.
 */
export async function checkShiftIntegrity(knownLocationOff?: boolean): Promise<void> {
  const shift = useShiftStore.getState();
  if (!shift.isClockedIn || shift.isOnBreak || !shift.storeCode) return;

  let developerMode = false;
  try {
    developerMode = await JailMonkey.isDevelopmentSettingsMode();
  } catch {
    // Android-only. A check that can't run isn't a detection -- report it as
    // "fine" rather than counting it against the employee.
  }

  try {
    const conditions: AttendanceAlertConditions = { developer_mode: developerMode };
    if (typeof knownLocationOff === 'boolean') conditions.location_off = knownLocationOff;

    const result = await reportIntegrityState({
      store_code: shift.storeCode,
      mark_date: today(),
      conditions,
    });

    const newlyCounted = (Object.keys(result.counted) as AttendanceAlertType[]).filter((t) => result.counted[t]);
    if (newlyCounted.length === 0) return;

    if (result.status === 'pending') {
      await fireIntegrityAlertNotification({
        title: 'Attendance sent for review',
        body: "An integrity issue was detected 4 times today. Today's attendance has been sent to your manager and HR for review.",
        escalated: true,
      });
      return;
    }

    // If both conditions happened to flip at once, warn about each -- they
    // are separate things for the employee to fix.
    for (const type of newlyCounted) {
      await fireIntegrityAlertNotification({
        title: WARNING_TITLE[type],
        body: `Warning ${result.alertCount} of 3 — ${WARNING_ACTION[type]} to keep today's attendance valid.`,
        escalated: false,
      });
    }
  } catch {
    // Network hiccup: nothing was counted server-side, and this function
    // keeps no state, so the next check simply reports the same picture
    // again. Nothing to reconcile.
  }
}
