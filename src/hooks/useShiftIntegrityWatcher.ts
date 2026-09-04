import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import JailMonkey from 'jail-monkey';
import { useShiftStore } from '../stores/shiftStore';
import { reportAttendanceAlert, AttendanceAlertType } from '../api/attendanceAlerts.api';
import { fireIntegrityAlertNotification } from '../utils/notifications';

const CHECK_INTERVAL_MS = 60 * 1000;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Detects two shift-integrity conditions while clocked in: location services
 * turned off, and Android Developer Mode turned on. Both feed one shared
 * per-day counter server-side (attendanceAlert.service.js) -- 3 detections
 * (of either kind, in any mix) warn locally, the 4th escalates the day to
 * the site-manager and HR.
 *
 * No true background signal exists for either condition without a second,
 * heavier native dependency (expo-background-fetch, ~15 min minimum
 * interval, no exact-timing guarantee) -- deliberately not added. Instead,
 * both checks run on the same two foreground-biased triggers this app
 * already uses elsewhere (useShiftSync.ts, useKycGate.ts): an AppState
 * "active" transition, and a 60s interval while foregrounded. This will not
 * catch a toggle-off-and-back-on that happens entirely while the phone is
 * screen-off for the whole gap between checks -- a known, accepted limit.
 */
export function useShiftIntegrityWatcher() {
  const isClockedIn = useShiftStore((s) => s.isClockedIn);
  const isOnBreak = useShiftStore((s) => s.isOnBreak);
  const storeCode = useShiftStore((s) => s.storeCode);
  const active = isClockedIn && !isOnBreak;

  // Independent rising/falling-edge tracking per condition -- each
  // continuous "bad" period reports exactly once, and the two conditions
  // are tracked separately so either can fire regardless of the other's
  // state. Flipped to "reported" only on a SUCCESSFUL report, so a failed
  // call (network hiccup) is retried on the next tick rather than silently
  // dropped for the rest of the period.
  const locationOk = useRef(true);
  const devModeOff = useRef(true);

  useEffect(() => {
    if (!active || !storeCode) return;
    let cancelled = false;

    async function report(alertType: AttendanceAlertType, label: string): Promise<boolean> {
      try {
        const result = await reportAttendanceAlert({ store_code: storeCode!, mark_date: today(), alert_type: alertType });
        if (cancelled) return true;
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
        return false; // leave the edge flag unflipped so the next tick retries
      }
    }

    async function check() {
      try {
        const locationEnabled = await Location.hasServicesEnabledAsync();
        if (locationEnabled) {
          locationOk.current = true;
        } else if (locationOk.current) {
          if (await report('location_off', 'Location is off')) locationOk.current = false;
        }
      } catch {
        // Best-effort -- a transient check failure isn't itself a detection.
      }

      try {
        const devModeOn = await JailMonkey.isDevelopmentSettingsMode();
        if (!devModeOn) {
          devModeOff.current = true;
        } else if (devModeOff.current) {
          if (await report('developer_mode', 'Developer Mode is on')) devModeOff.current = false;
        }
      } catch {
        // Android-only check; a failure here (unsupported platform, etc.)
        // is treated the same as "nothing to report", not an error.
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [active, storeCode]);
}
