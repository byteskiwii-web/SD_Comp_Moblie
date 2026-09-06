import JailMonkey from 'jail-monkey';
import { useShiftStore } from '../stores/shiftStore';
import { reportIntegrityState, AttendanceAlertType } from '../api/attendanceAlerts.api';
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
 * Checks Developer Mode and reports it. Location-off is no longer checked
 * here -- the server infers it from ping gaps instead (see
 * attendanceAlerts.api.ts) -- but this call's response can still carry a
 * newly-counted location_off detection alongside (or instead of) a
 * developer_mode one, so both are handled below.
 *
 * Called from two places on different cadences -- the foreground hook
 * (useShiftIntegrityWatcher, ~60s while the app is open) and the background
 * location task (backgroundLocationTask.ts, piggybacked on its own ~12-min
 * reliable ping while the app is closed).
 *
 * Holds NO state about what it has already reported. It sends the current
 * Developer Mode state every time, and the server decides whether that is a
 * new detection (attendanceAlert.service.js#recordIntegrityState owns the
 * open-period flags). The response's `counted` says which conditions
 * actually incremented, and only those produce a notification -- so a
 * continuing outage reports repeatedly but warns exactly once.
 *
 * No-ops entirely when not on shift -- the same isClockedIn && !isOnBreak
 * gate useLocationPollingEffect uses for the geofence poll.
 */
export async function checkShiftIntegrity(): Promise<void> {
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
    const result = await reportIntegrityState({
      store_code: shift.storeCode,
      mark_date: today(),
      conditions: { developer_mode: developerMode },
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
