import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Display preferences the employee sets and the app remembers.
 *
 * Persisted because both of these are standing choices, not session state —
 * somebody who wants a 24-hour clock wants it tomorrow too, and being asked
 * again after every cold start would make the setting feel broken.
 */

/** The locales the backend actually serves. Asking for one it does not have would silently fall back to English. */
export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export type ClockFormat = '12h' | '24h';

type PreferencesState = {
  /** 12-hour is the default because it is what the shift rosters are written in. */
  clock: ClockFormat;
  language: LanguageCode;
  setClock: (clock: ClockFormat) => void;
  setLanguage: (language: LanguageCode) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      clock: '12h',
      language: 'en',
      setClock: (clock) => set({ clock }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'zip_hrms_preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * The clock format, readable from outside React.
 *
 * datetime.ts's formatters are plain functions called from dozens of places,
 * and threading a parameter through all of them would mean touching every
 * call site for a setting that changes twice a year. Reading the store
 * directly keeps them one-argument functions.
 *
 * The cost is that a formatter is no longer pure, so a component showing a
 * time has to SUBSCRIBE to the store for the change to appear without a
 * remount — the screens that display times do exactly that.
 */
export const currentClockFormat = (): ClockFormat => {
  try {
    return usePreferencesStore.getState().clock;
  } catch {
    // Before hydration, or in a headless task with no store: 12-hour is the
    // default everywhere else, so it is the right answer here too.
    return '12h';
  }
};

export const currentLanguage = (): LanguageCode => {
  try {
    return usePreferencesStore.getState().language;
  } catch {
    return 'en';
  }
};
