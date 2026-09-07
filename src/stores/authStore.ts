import { create } from 'zustand';
import { saveAuth, loadAuth, clearAuth } from '../utils/secureStorage';
import { getMe, type Me } from '../api/auth.api';

export type Employee = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  phone: string;
  role: string;
  store_code: string | null;
};

export type StoreSnapshot = {
  store_code: string;
  name: string;
  lat: string | null;
  lng: string | null;
  geofence_radius_m: number;
} | null;

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  employee: Employee | null;
  store: StoreSnapshot;
  /** Refreshed from /auth/me; null until the first successful read. */
  profile: Me | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setAuth: (auth: { token: string; refreshToken: string; employee: Employee; store: StoreSnapshot }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  refreshToken: null,
  employee: null,
  store: null,
  profile: null,
  hydrated: false,

  hydrate: async () => {
    const saved = await loadAuth();
    if (saved) {
      set({
        token: saved.token,
        refreshToken: saved.refreshToken,
        employee: saved.employee as unknown as Employee,
        store: saved.store as StoreSnapshot,
        hydrated: true,
      });
      // Fire and forget: a failed refresh must not block boot, and the cached
      // record is still the best answer available until it succeeds.
      void get().refreshProfile();
    } else {
      set({ hydrated: true });
    }
  },

  setAuth: async (auth) => {
    await saveAuth(auth);
    set({ token: auth.token, refreshToken: auth.refreshToken, employee: auth.employee, store: auth.store });
    void get().refreshProfile();
  },

  /**
   * Re-read the record the server holds.
   *
   * The app used to keep whatever login returned and never ask again, so an
   * employee moved to another store, or given a different role, kept seeing
   * the old one until they signed out and back in.
   *
   * Only the fields /auth/me actually answers for are merged. Phone and email
   * are not in that response, and overwriting them with undefined would trade
   * a stale value for a missing one.
   */
  refreshProfile: async () => {
    try {
      const me = await getMe();
      const current = get().employee;
      set({
        profile: me,
        employee: current
          ? { ...current, role: me.role ?? current.role, store_code: me.storeCode ?? current.store_code }
          : current,
      });
    } catch {
      // Offline, or the session expired and the interceptor is already
      // handling it. Either way the cached record stays.
    }
  },

  signOut: async () => {
    await clearAuth();
    set({ token: null, refreshToken: null, employee: null, store: null, profile: null });
  },
}));
