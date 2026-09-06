import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useShiftStore } from '../stores/shiftStore';
import { checkShiftIntegrity } from '../utils/shiftIntegrityCheck';
import { INTEGRITY_FOREGROUND_CHECK_INTERVAL_MS } from '../constants/config';

/**
 * Detects Developer Mode while the app is open, roughly every 60s
 * (AppState "active" transition + interval, same pattern as
 * useShiftSync.ts / useKycGate.ts). Calls checkShiftIntegrity() with no
 * known location state -- this watcher can't tell whether location is off
 * any more reliably than the old design could, so it leaves that to the
 * server's gap inference. The native shift-timer (src/tasks/shiftTimerTask.ts)
 * covers the same Developer Mode check independently, roughly every 12 min
 * including while this app is closed, and DOES know its location state
 * directly on each tick.
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
