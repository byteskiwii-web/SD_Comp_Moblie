import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Persisted rising/falling-edge state for the two shift-integrity checks
// (location services, Developer Mode). Persisted -- not a plain useRef, like
// shiftStore.ts and unlike the original in-memory version of this watcher --
// because TWO independent code paths now need to agree on "have we already
// reported this off-period": the foreground hook (useShiftIntegrityWatcher,
// checks every ~60s while the app is open) and the background task
// (backgroundIntegrityTask.ts, checks roughly every 15+ min while it isn't).
// Without a shared, durable flag, each path would treat the SAME continuous
// off-period as new the first time it sees it, double-reporting whichever
// one happens to run second.
//
// Scoped to a single calendar day (forDate), matching the server's own
// per-day counter (attendance_alerts) -- a new day means a fresh count, on
// both sides, without carrying yesterday's "already reported" state into
// today's tracking.
type IntegrityAlertState = {
  forDate: string | null;
  locationOk: boolean;
  devModeOff: boolean;
  setLocationOk: (ok: boolean, date: string) => void;
  setDevModeOff: (off: boolean, date: string) => void;
};

function withDayReset(
  state: IntegrityAlertState,
  date: string,
  patch: Partial<Pick<IntegrityAlertState, 'locationOk' | 'devModeOff'>>
): Partial<IntegrityAlertState> {
  if (state.forDate !== date) {
    return { forDate: date, locationOk: true, devModeOff: true, ...patch };
  }
  return patch;
}

export const useIntegrityAlertStore = create<IntegrityAlertState>()(
  persist(
    (set) => ({
      forDate: null,
      locationOk: true,
      devModeOff: true,
      setLocationOk: (ok, date) => set((state) => withDayReset(state, date, { locationOk: ok })),
      setDevModeOff: (off, date) => set((state) => withDayReset(state, date, { devModeOff: off })),
    }),
    {
      name: 'zip_hrms_integrity_alerts',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
