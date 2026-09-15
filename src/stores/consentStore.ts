import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Consents the employee has given on this device.
 *
 * Kept apart from preferencesStore deliberately. A preference is a taste the
 * employee can flip at will; a consent is a record that something was
 * disclosed and agreed to, it carries a timestamp, and under the DPDP Act it
 * is evidence. Storing the two together would invite someone to add a "reset
 * preferences" button that silently erases a consent record.
 *
 * Device-scoped rather than account-scoped, and that is correct here: the
 * thing being consented to is this device reporting its location. A new phone
 * is a new disclosure, which is also what Play expects.
 */
type ConsentState = {
  /**
   * When the employee accepted the background-location disclosure, ISO-8601,
   * or null if they never have.
   *
   * Google Play requires a prominent in-app disclosure BEFORE the runtime
   * permission prompt for background location — not after a denial, and not
   * only in the privacy policy. This timestamp is what lets the app show that
   * screen once rather than at every clock-in, without losing the record that
   * it was shown.
   */
  backgroundLocationAcceptedAt: string | null;
  acceptBackgroundLocation: () => void;
  /**
   * Clears the record so the disclosure is shown again. Used on sign-out: the
   * next person to use a shared store device must see it for themselves.
   */
  clearConsents: () => void;
};

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      backgroundLocationAcceptedAt: null,
      acceptBackgroundLocation: () =>
        set({ backgroundLocationAcceptedAt: new Date().toISOString() }),
      clearConsents: () => set({ backgroundLocationAcceptedAt: null }),
    }),
    {
      name: 'zip_connect_consents',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
