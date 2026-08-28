import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useShiftStore } from '../stores/shiftStore';
import { startBackgroundLocationPolling, stopBackgroundLocationPolling } from '../utils/backgroundLocationTask';

// Reacts to shiftStore.isClockedIn transitions (set by useShiftSync, and by
// the clock-in/out mutations directly) to start/stop background polling.
// Location permission is only ever requested here -- i.e. only once the
// user is actually clocked in -- never at app launch or on Home mount.
export function useLocationPollingEffect() {
  const isClockedIn = useShiftStore((s) => s.isClockedIn);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (isClockedIn) {
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
  }, [isClockedIn]);
}
