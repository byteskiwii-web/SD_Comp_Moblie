import { create } from 'zustand';
import { saveAuth, loadAuth, clearAuth } from '../utils/secureStorage';

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
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setAuth: (auth: { token: string; refreshToken: string; employee: Employee; store: StoreSnapshot }) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  refreshToken: null,
  employee: null,
  store: null,
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
    } else {
      set({ hydrated: true });
    }
  },

  setAuth: async (auth) => {
    await saveAuth(auth);
    set({ token: auth.token, refreshToken: auth.refreshToken, employee: auth.employee, store: auth.store });
  },

  signOut: async () => {
    await clearAuth();
    set({ token: null, refreshToken: null, employee: null, store: null });
  },
}));
