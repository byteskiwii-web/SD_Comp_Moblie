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

/**
 * The locales the backend actually serves. Asking for one it does not have
 * would silently fall back to English.
 *
 * Ordered by (approximate) native speaker count, matching the web app's
 * language switcher -- the top 10 languages in India by that measure, which
 * is what "top 10 Indian languages" was taken to mean when this list grew
 * from six to ten.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

type PreferencesState = {
  /** 12-hour is the default because it is what the shift rosters are written in. */
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'zip_hrms_preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);


export const currentLanguage = (): LanguageCode => {
  try {
    return usePreferencesStore.getState().language;
  } catch {
    return 'en';
  }
};
