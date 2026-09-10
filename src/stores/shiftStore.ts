import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local cache of "am I clocked in" / "am I on break" so a killed/reopened
// app doesn't briefly think it's clocked out. This is a HINT, not the
// source of truth -- it's always reconciled against the server (today's
// attendance history) on every app-foreground event and after every
// clock-in/out/break call. See useShiftSync.ts for that reconciliation.
//
// isOnBreak gates the native shift-timer service (useLocationPollingEffect,
// modules/shift-timer): tracking should only run while the employee is
// actually expected to be inside the store, i.e. clocked in AND not on a
// break -- not after break-start, and not after clock-out.
type ShiftState = {
  isClockedIn: boolean;
  storeCode: string | null;
  clockInAt: string | null;
  isOnBreak: boolean;
  /** When the CURRENT break began. Null when not on one. */
  breakStartedAt: string | null;
  setClockedIn: (storeCode: string, clockInAt: string) => void;
  setClockedOut: () => void;
  setOnBreak: () => void;
  setOffBreak: () => void;
};

export const useShiftStore = create<ShiftState>()(
  persist(
    (set) => ({
      isClockedIn: false,
      storeCode: null,
      clockInAt: null,
      isOnBreak: false,
      breakStartedAt: null,
      setClockedIn: (storeCode, clockInAt) => set({ isClockedIn: true, storeCode, clockInAt, isOnBreak: false, breakStartedAt: null }),
      setClockedOut: () => set({ isClockedIn: false, storeCode: null, clockInAt: null, isOnBreak: false, breakStartedAt: null }),
      setOnBreak: () => set({ isOnBreak: true, breakStartedAt: new Date().toISOString() }),
      setOffBreak: () => set({ isOnBreak: false, breakStartedAt: null }),
    }),
    {
      name: 'zip_hrms_shift',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
