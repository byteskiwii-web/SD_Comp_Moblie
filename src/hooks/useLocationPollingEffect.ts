import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useShiftStore } from '../stores/shiftStore';
import { hasShiftTimer } from '../native/runtime';
import { LOCATION_POLL_INTERVAL_MS } from '../constants/config';

// Loaded through require(), never a static import. modules/shift-timer is
// Android-only native code, so on iOS or in Expo Go the import itself throws
// at module evaluation -- and this hook is in the eager graph, so that took
// the whole app down before the first render rather than merely disabling
// the feature. A module factory only runs on first require, which on those
// runtimes is never.
type ShiftTimerModule = { start: (intervalMs: number) => void; stop: () => void };
let shiftTimer: ShiftTimerModule | null = null;
function getShiftTimer(): ShiftTimerModule | null {
  if (!hasShiftTimer) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  if (!shiftTimer) shiftTimer = require('../../modules/shift-timer').default as ShiftTimerModule;
  return shiftTimer;
}

// Reacts to shiftStore.isClockedIn/isOnBreak transitions (set by
// useShiftSync, and by the clock-in/out and break mutations directly) to
// start/stop the native shift-timer service. Tracking should only run while
// the employee is expected to be inside the store: clocked in AND not on a
// break. Location permission is only ever requested here -- i.e. only once
// the user actually starts a shift -- never at app launch or on Home mount.
//
// ShiftTimer (modules/shift-timer) replaced expo-location's
// startLocationUpdatesAsync + TaskManager here: that mechanism is driven by
// GPS fixes arriving, so on a real device it never invoked its callback at
// all once Location was switched off -- the one condition this whole feature
// exists to catch. ShiftTimer instead runs on an AlarmManager wake-up alarm
// that fires on a timer regardless of location availability; each tick
// attempts its own fix (src/tasks/shiftTimerTask.ts) and reports directly
// when that fails.
export function useLocationPollingEffect() {
  const isClockedIn = useShiftStore((s) => s.isClockedIn);
  const isOnBreak = useShiftStore((s) => s.isOnBreak);
  const shouldTrack = isClockedIn && !isOnBreak;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (shouldTrack) {
          const fg = await Location.requestForegroundPermissionsAsync();
          if (cancelled || fg.status !== 'granted') return;
          await Location.requestBackgroundPermissionsAsync();
          if (cancelled) return;
          getShiftTimer()?.start(LOCATION_POLL_INTERVAL_MS);
        } else {
          getShiftTimer()?.stop();
        }
      } catch (err) {
        console.warn('[useLocationPollingEffect]', err);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [shouldTrack]);
}
