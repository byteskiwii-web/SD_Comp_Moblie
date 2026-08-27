import * as SecureStore from 'expo-secure-store';

const AUTH_KEY = 'zip_hrms_auth';

export type StoredAuth = {
  token: string;
  employee: Record<string, unknown>;
  store: Record<string, unknown> | null;
};

export async function saveAuth(auth: StoredAuth): Promise<void> {
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(auth));
}

export async function loadAuth(): Promise<StoredAuth | null> {
  const raw = await SecureStore.getItemAsync(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_KEY);
}
