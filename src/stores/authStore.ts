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
  /**
   * Why the last session ended, when it was not the employee's own doing.
   *
   * Read once by the login screen and cleared. Without it a phone displaced by
   * a sign-in on another device just lands back on an empty login form, which
   * reads as the app having logged them out for no reason.
   */
  endedReason: string | null;
  hydrate: () => Promise<void>;
  setAuth: (
    auth: { token: string; refreshToken: string; employee: Employee; store: StoreSnapshot },
    opts?: { remember?: boolean }
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: (opts?: { reason?: string }) => Promise<void>;
  clearEndedReason: () => void;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  refreshToken: null,
  employee: null,
  store: null,
  profile: null,
  hydrated: false,
  endedReason: null,

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

  /**
   * @param opts.remember persist to the device keychain so the next launch
   *   opens straight into the app. Defaults to TRUE, which is what the app has
   *   always done — the flag exists so somebody on a borrowed or shared
   *   handset can decline, not to change the default for everyone.
   *
   * When false the tokens live in memory only: the session still works for as
   * long as the app is open, and closing it is a sign-out. Nothing is written,
   * so there is nothing left behind to remove.
   *
   * A refresh rotation calls this with no options, so it inherits `true` and
   * an already-remembered session keeps being remembered. That is why the
   * default is the permissive one: the alternative silently forgets a session
   * half an hour after the employee asked for it to be kept.
   */
  setAuth: async (auth, opts) => {
    if (opts?.remember === false) {
      // Clear anything a previous "remember me" left, or declining now would
      // leave the last session's tokens sitting in the keychain.
      await clearAuth();
    } else {
      await saveAuth(auth);
    }
    set({
      token: auth.token, refreshToken: auth.refreshToken,
      employee: auth.employee, store: auth.store, endedReason: null,
    });
    void get().refreshProfile();
  },

  clearEndedReason: () => set({ endedReason: null }),

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

  /**
   * @param opts.reason why the session ended, when the employee did not choose
   *   it — surfaced once on the login screen. A plain sign-out passes nothing,
   *   which is correct: nobody needs telling why they are signed out after
   *   pressing Sign out.
   *
   * Always clears the keychain, whatever the reason. A displaced session's
   * tokens are dead server-side and keeping them would only make the next
   * launch spend a request discovering that.
   */
  signOut: async (opts) => {
    await clearAuth();
    set({
      token: null, refreshToken: null, employee: null, store: null, profile: null,
      endedReason: opts?.reason ?? null,
    });
  },
}));
