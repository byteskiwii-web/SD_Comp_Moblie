import JailMonkey from 'jail-monkey';
import { toLocalDateKey } from './datetime';
import { useShiftStore } from '../stores/shiftStore';
import { reportIntegrityState, AttendanceAlertConditions, AttendanceAlertType } from '../api/attendanceAlerts.api';
import { fireIntegrityAlertNotification } from './notifications';
import { isLocationServicesOff } from './locationProbe';

const today = () => toLocalDateKey();

const WARNING_TITLE: Record<AttendanceAlertType, string> = {
  location_off: 'Location is off',
  developer_mode: 'Developer Mode is on',
};
const WARNING_ACTION: Record<AttendanceAlertType, string> = {
  location_off: 'turn location back on',
  developer_mode: 'disable Developer Mode',
};

/**
 * Checks Developer Mode and reports it together with whether location is off.
 *
 * Called from two places on different cadences -- the foreground hook
 * (useShiftIntegrityWatcher, ~60s while the app is open) and the native
 * shift-timer's tick (shiftTimerTask.ts, roughly every 12 min including
 * while the app is closed, Android only), which passes what its own probe
 * found. Without a caller's answer this reads the location services switch
 * itself, so EVERY report says "on" or "off".
 *
 * The device's answer wins on the server over its ping-gap inference: a gap
 * also follows a slow GPS fix indoors, a delayed timer or a failed request,
 * none of which is location being off, and was warning employees whose
 * location was on. Only when the switch cannot be read is location_off left
 * out, for the server to infer.
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

  const locationOff = typeof knownLocationOff === 'boolean' ? knownLocationOff : await isLocationServicesOff();

  let developerMode = false;
  try {
    developerMode = await JailMonkey.isDevelopmentSettingsMode();
  } catch {
    // Android-only. A check that can't run isn't a detection -- report it as
    // "fine" rather than counting it against the employee.
  }

  try {
    const conditions: AttendanceAlertConditions = { developer_mode: developerMode };
    if (typeof locationOff === 'boolean') conditions.location_off = locationOff;

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
