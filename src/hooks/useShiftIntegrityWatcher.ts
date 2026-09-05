import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useShiftStore } from '../stores/shiftStore';
import { checkShiftIntegrity } from '../utils/shiftIntegrityCheck';
import { INTEGRITY_FOREGROUND_CHECK_INTERVAL_MS } from '../constants/config';
import { startBackgroundIntegrityChecks, stopBackgroundIntegrityChecks } from '../utils/backgroundIntegrityTask';

/**
 * Detects two shift-integrity conditions while clocked in: location services
 * turned off, and Android Developer Mode turned on. Both feed one shared
 * per-day counter server-side (attendanceAlert.service.js) -- 3 detections
 * (of either kind, in any mix) warn locally, the 4th escalates the day to
 * the site-manager and HR.
 *
 * Two complementary paths, both calling the same checkShiftIntegrity()
 * (shiftIntegrityCheck.ts) so there is exactly one place deciding what
 * counts as a new detection:
 *
 *   - Foreground: an AppState "active" transition, and a 60s interval,
 *     while the app is open -- the same pattern this app already uses
 *     elsewhere (useShiftSync.ts, useKycGate.ts).
 *   - Background: a registered expo-background-task, so a check still
 *     happens after the app is fully closed. Android enforces a 15-minute
 *     floor on this and does not guarantee even that -- it is not, and
 *     cannot be made into, a 60-second cadence. This is the fix for a real
 *     reported gap: with only the foreground path, disabling location while
 *     the app was closed produced no alert until the app was reopened.
 */
export function useShiftIntegrityWatcher() {
  const isClockedIn = useShiftStore((s) => s.isClockedIn);
  const isOnBreak = useShiftStore((s) => s.isOnBreak);
  const active = isClockedIn && !isOnBreak;

  useEffect(() => {
    if (!active) {
      stopBackgroundIntegrityChecks().catch(() => {});
      return;
    }

    checkShiftIntegrity();
    startBackgroundIntegrityChecks().catch((err) => console.warn('[useShiftIntegrityWatcher]', err));

    const interval = setInterval(checkShiftIntegrity, INTEGRITY_FOREGROUND_CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkShiftIntegrity();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [active]);
}
