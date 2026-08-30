import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useShiftStore } from '../stores/shiftStore';
import { startBackgroundLocationPolling, stopBackgroundLocationPolling } from '../utils/backgroundLocationTask';

// Reacts to shiftStore.isClockedIn/isOnBreak transitions (set by
// useShiftSync, and by the clock-in/out and break mutations directly) to
// start/stop background polling. Tracking should only run while the
// employee is expected to be inside the store: clocked in AND not on a
// break. Location permission is only ever requested here -- i.e. only once
// the user actually starts a shift -- never at app launch or on Home mount.
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
          await startBackgroundLocationPolling();
        } else {
          await stopBackgroundLocationPolling();
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
