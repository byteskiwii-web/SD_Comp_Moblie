import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local cache of "am I clocked in" so a killed/reopened app doesn't briefly
// think it's clocked out. This is a HINT, not the source of truth -- it's
// always reconciled against the server (today's attendance history) on
// every app-foreground event and after every clock-in/out call. See
// useShiftSync.ts for that reconciliation.
type ShiftState = {
  isClockedIn: boolean;
  storeCode: string | null;
  clockInAt: string | null;
  setClockedIn: (storeCode: string, clockInAt: string) => void;
  setClockedOut: () => void;
};

export const useShiftStore = create<ShiftState>()(
  persist(
    (set) => ({
      isClockedIn: false,
      storeCode: null,
      clockInAt: null,
      setClockedIn: (storeCode, clockInAt) => set({ isClockedIn: true, storeCode, clockInAt }),
      setClockedOut: () => set({ isClockedIn: false, storeCode: null, clockInAt: null }),
    }),
    {
      name: 'zip_hrms_shift',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
