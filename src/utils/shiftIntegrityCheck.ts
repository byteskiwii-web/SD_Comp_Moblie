import * as Location from 'expo-location';
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
 * Observes both integrity conditions and reports what it sees. Called from
 * two places on different cadences -- the foreground hook
 * (useShiftIntegrityWatcher, ~60s while the app is open) and the background
 * task (backgroundIntegrityTask.ts, roughly every 15+ min while it isn't).
 *
 * This function holds NO state about what it has already reported. It sends
 * the current state of both conditions every time, and the server decides
 * whether that is a new detection (attendanceAlert.service.js
 * #recordIntegrityState owns the open-period flags). The response's
 * `counted` says which conditions actually incremented, and only those
 * produce a notification -- so a continuing outage reports repeatedly but
 * warns exactly once.
 *
 * The earlier design kept an "already reported" flag on the device. That put
 * the de-duplication decision on one side and the counter on the other with
 * nothing keeping them in step: clearing app data mid-shift re-counted one
 * unbroken outage against the employee, and resetting the row server-side
 * silenced the device until the condition was manually toggled off and on.
 *
 * No-ops entirely when not on shift -- the same isClockedIn && !isOnBreak
 * gate useLocationPollingEffect uses for the geofence poll.
 */
export async function checkShiftIntegrity(): Promise<void> {
  const shift = useShiftStore.getState();
  if (!shift.isClockedIn || shift.isOnBreak || !shift.storeCode) return;

  let locationOff = false;
  let developerMode = false;

  try {
    locationOff = !(await Location.hasServicesEnabledAsync());
  } catch {
    // A check that can't run isn't a detection -- report it as "fine" rather
    // than counting it against the employee.
  }

  try {
    developerMode = await JailMonkey.isDevelopmentSettingsMode();
  } catch {
    // Android-only; treated the same way.
  }

  try {
    const result = await reportIntegrityState({
      store_code: shift.storeCode,
      mark_date: today(),
      conditions: { location_off: locationOff, developer_mode: developerMode },
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
