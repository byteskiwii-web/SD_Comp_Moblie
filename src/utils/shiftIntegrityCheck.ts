import * as Location from 'expo-location';
import JailMonkey from 'jail-monkey';
import { useShiftStore } from '../stores/shiftStore';
import { useIntegrityAlertStore } from '../stores/integrityAlertStore';
import { reportAttendanceAlert, AttendanceAlertType } from '../api/attendanceAlerts.api';
import { fireIntegrityAlertNotification } from './notifications';

const today = () => new Date().toISOString().slice(0, 10);

async function report(storeCode: string, alertType: AttendanceAlertType, label: string): Promise<boolean> {
  try {
    const result = await reportAttendanceAlert({ store_code: storeCode, mark_date: today(), alert_type: alertType });
    if (result.status === 'pending') {
      await fireIntegrityAlertNotification({
        title: 'Attendance sent for review',
        body: "An integrity issue was detected 4 times today. Today's attendance has been sent to your manager and HR for review.",
        escalated: true,
      });
    } else {
      const action = alertType === 'location_off' ? 'turn location back on' : 'disable Developer Mode';
      await fireIntegrityAlertNotification({
        title: label,
        body: `Warning ${result.alertCount} of 3 — ${action} to keep today's attendance valid.`,
        escalated: false,
      });
    }
    return true;
  } catch {
    return false; // leave the persisted flag unflipped so the next check retries
  }
}

/**
 * The one place that decides "has anything actually changed since we last
 * looked" and reports it. Called from two independent contexts -- the
 * foreground hook (useShiftIntegrityWatcher, every ~60s while the app is
 * open) and the background task (backgroundIntegrityTask.ts, roughly every
 * 15+ min while it isn't) -- both reading and writing the SAME persisted
 * integrityAlertStore, so whichever one notices a transition first is the
 * only one that reports it.
 *
 * No-ops entirely when not actually on shift (mirrors the same
 * isClockedIn && !isOnBreak gate useLocationPollingEffect already uses for
 * the geofence poll) -- there is no day to flag if there is no shift.
 */
export async function checkShiftIntegrity(): Promise<void> {
  const shift = useShiftStore.getState();
  if (!shift.isClockedIn || shift.isOnBreak || !shift.storeCode) return;
  const storeCode = shift.storeCode;
  const date = today();
  const alerts = useIntegrityAlertStore.getState();

  // A new day means neither condition has been reported yet today, even if
  // the persisted flags say otherwise from yesterday -- resolved by
  // withDayReset inside the store itself the moment either setter fires, so
  // here we just treat a stale forDate as "assume true" for comparison.
  const locationOk = alerts.forDate === date ? alerts.locationOk : true;
  const devModeOff = alerts.forDate === date ? alerts.devModeOff : true;

  try {
    const locationEnabled = await Location.hasServicesEnabledAsync();
    if (locationEnabled) {
      if (!locationOk) useIntegrityAlertStore.getState().setLocationOk(true, date);
    } else if (locationOk) {
      const ok = await report(storeCode, 'location_off', 'Location is off');
      if (ok) useIntegrityAlertStore.getState().setLocationOk(false, date);
    }
  } catch {
    // Best-effort -- a transient check failure isn't itself a detection.
  }

  try {
    const devModeOn = await JailMonkey.isDevelopmentSettingsMode();
    if (!devModeOn) {
      if (!devModeOff) useIntegrityAlertStore.getState().setDevModeOff(true, date);
    } else if (devModeOff) {
      const ok = await report(storeCode, 'developer_mode', 'Developer Mode is on');
      if (ok) useIntegrityAlertStore.getState().setDevModeOff(false, date);
    }
  } catch {
    // Android-only check; a failure here is treated as "nothing to report".
  }
}
