import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { ColorScheme, darkColors, lightColors } from '../theme/tokens';

export type ThemeMode = 'light' | 'dark';

type ThemeState = {
  mode: ThemeMode;
  /** Derived from `mode`, not read separately -- see setMode. Storing the
   *  resolved object (not just the mode) means every consumer does
   *  `useThemeStore(s => s.colors)` and never has to know there are two
   *  palettes or which one is active. */
  colors: ColorScheme;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

const resolve = (mode: ThemeMode): ColorScheme => (mode === 'dark' ? darkColors : lightColors);

/**
 * The one toggle for the whole app's colour scheme.
 *
 * Defaults to the device's own appearance setting on first launch -- a
 * fresh install should not assume light, the way the app always silently
 * did before this existed -- but from then on it is a plain user choice,
 * persisted, and does NOT track the device setting afterwards. Reading
 * Appearance.getColorScheme() on every render instead would mean the
 * in-app toggle fights the OS setting for who is in charge; picking a
 * value here and sticking to it until the person changes it again is a
 * decision, not ambient state to keep observing.
 *
 * Persisted with the same store shape used elsewhere in this app
 * (notificationsStore.ts, shiftStore.ts) -- AsyncStorage, so it survives an
 * app restart without needing a server round-trip for something this local.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
      colors: resolve(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'),
      toggle: () =>
        set((s) => {
          const mode: ThemeMode = s.mode === 'dark' ? 'light' : 'dark';
          return { mode, colors: resolve(mode) };
        }),
      setMode: (mode) => set({ mode, colors: resolve(mode) }),
    }),
    {
      name: 'zip_hrms_theme',
      storage: createJSONStorage(() => AsyncStorage),
      // Only `mode` is worth persisting; `colors` is rebuilt from it on
      // rehydration (via onRehydrateStorage below) rather than serialised
      // itself, so a future palette tweak in tokens.ts is picked up by
      // every existing install instead of being frozen into old storage.
      partialize: (s) => ({ mode: s.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) state.colors = resolve(state.mode);
      },
    }
  )
);
