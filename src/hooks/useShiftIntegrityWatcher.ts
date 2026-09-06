import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useShiftStore } from '../stores/shiftStore';
import { checkShiftIntegrity } from '../utils/shiftIntegrityCheck';
import { INTEGRITY_FOREGROUND_CHECK_INTERVAL_MS } from '../constants/config';

/**
 * Detects Developer Mode while clocked in, roughly every 60s while the app
 * is open (AppState "active" transition + interval, same pattern as
 * useShiftSync.ts / useKycGate.ts). Location-off detection is handled
 * entirely server-side now (attendanceAlert.service.js#checkLocationGap),
 * inferred from gaps in the existing background-location-task pings rather
 * than a client-side background check -- see backgroundLocationTask.ts,
 * which also piggybacks a Developer Mode report onto that same reliable
 * channel for coverage while this app is closed.
 */
export function useShiftIntegrityWatcher() {
  const isClockedIn = useShiftStore((s) => s.isClockedIn);
  const isOnBreak = useShiftStore((s) => s.isOnBreak);
  const active = isClockedIn && !isOnBreak;

  useEffect(() => {
    if (!active) return;

    checkShiftIntegrity();

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
