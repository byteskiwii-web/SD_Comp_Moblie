const AUTH_KEY = 'zip_hrms_auth';

// Web sibling of secureStorage.ts. expo-secure-store is Keychain/Keystore only
// -- it ships no web implementation, and every method throws in a browser,
// which would break authStore.hydrate() on boot and login immediately after.
// Metro resolves this file ahead of the bare name on web, so expo-secure-store
// never enters the web bundle at all.
//
// This is deliberately NOT secure storage: localStorage is readable by any
// script on the origin. Acceptable only because web is a review surface, not a
// shipping target -- real devices go through the native module above.
export type StoredAuth = {
  token: string;
  refreshToken: string;
  employee: Record<string, unknown>;
  store: Record<string, unknown> | null;
};

// Every access is wrapped: localStorage throws (not returns null) when the
// browser blocks site data -- Safari private mode, third-party iframe, or a
// "block cookies" setting -- and an unhandled throw here would fail the boot.
export async function saveAuth(auth: StoredAuth): Promise<void> {
  try {
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {
    console.warn('[secureStorage.web] could not persist auth; session is this-tab only');
  }
}

export async function loadAuth(): Promise<StoredAuth | null> {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  try {
    window.localStorage.removeItem(AUTH_KEY);
  } catch {
    // Nothing stored means nothing to clear -- logout should still succeed.
  }
}
