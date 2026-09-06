import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useShiftStore } from '../stores/shiftStore';
import ShiftTimer from '../../modules/shift-timer';
import { LOCATION_POLL_INTERVAL_MS } from '../constants/config';

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
          ShiftTimer.start(LOCATION_POLL_INTERVAL_MS);
        } else {
          ShiftTimer.stop();
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
