import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useShiftStore } from '../stores/shiftStore';
import { checkShiftIntegrity } from '../utils/shiftIntegrityCheck';
import { INTEGRITY_FOREGROUND_CHECK_INTERVAL_MS } from '../constants/config';

/**
 * Detects Developer Mode while the app is open, roughly every 60s
 * (AppState "active" transition + interval, same pattern as
 * useShiftSync.ts / useKycGate.ts). checkShiftIntegrity() reads the location
 * services switch itself, so each report also says whether location is on --
 * which is what keeps an open app, on iOS and Android alike, from being
 * flagged "location off" just because a background ping was missed. The
 * native shift-timer (src/tasks/shiftTimerTask.ts) covers the same checks
 * roughly every 12 min while this app is closed (Android).
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
