import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_V1 } from '../constants/config';
import { useAuthStore } from '../stores/authStore';
import { currentLanguage } from '../stores/preferencesStore';
import { useConnectivityStore } from '../stores/connectivityStore';

export const apiClient = axios.create({
  baseURL: API_V1,
  timeout: 15000,
});

// Attaches the JWT to every request once one exists. Every attendance route
// now requires it (backend enforces via authenticate() + attendance.authz.js,
// which also overwrites employee_id/approved_by from the session regardless
// of what's in the request body -- so no other mobile-side change was needed
// when that enforcement landed).
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * The employee`s chosen language, on every request.
   *
   * The backend serves six locales and picks from this header, so validation
   * failures, refusals and notification text come back translated without any
   * endpoint needing a parameter. Set here rather than per call for the same
   * reason the token is: one place, no call site to forget.
   */
  config.headers["Accept-Language"] = currentLanguage();

  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

// Backend's refresh session shape (auth.service.js#issueSession) -- same
// envelope /auth/login returns, deliberately not imported from auth.api.ts
// to avoid a circular import (that file imports apiClient from here).
type RefreshResponse = {
  success: true;
  data: { accessToken: string; refreshToken: string };
};

// Refresh tokens are SINGLE USE and rotated server-side (auth.service.js#refresh)
// -- presenting an already-rotated one a second time is treated as token theft
// and revokes every session on the account. So at most one refresh call may
// ever be in flight: concurrent 401s queue behind it instead of each redeeming
// the refresh token themselves.
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Why the last refresh failed, if the server said something worth repeating.
 *
 * The refresh path deliberately swallows errors — a failed refresh is a
 * sign-out, not a screenful of red — but "you signed in on another device" is
 * the one ending an employee needs to be told, or a phone that went quiet
 * because they logged in on a new handset looks like the app losing their
 * session at random. Module-scoped rather than thrown, because the caller of
 * performRefresh is an interceptor whose job is to retry, not to explain.
 */
let lastRefreshFailure: string | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const res = await axios.post<RefreshResponse>(
      `${API_V1}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 15000 }
    );
    const { accessToken, refreshToken: newRefreshToken } = res.data.data;
    const { employee, store } = useAuthStore.getState();
    if (!employee) return null;
    await useAuthStore.getState().setAuth({ token: accessToken, refreshToken: newRefreshToken, employee, store });
    return accessToken;
  } catch (err) {
    lastRefreshFailure = getApiErrorCode(err) ?? null;
    return null;
  }
}

// A 401 past this point means the access token expired mid-session (30 min
// lifetime) -- every screen that was open keeps working by transparently
// refreshing once and replaying the failed request, instead of surfacing
// "Could not load..." for something the user did nothing wrong to cause.
// Excluded entirely for /auth/* calls: a wrong password on /auth/login is
// not an expired session, and /auth/refresh failing must never try to
// refresh itself.
/**
 * Every response is also evidence about reachability.
 *
 * A response of ANY status -- including a 401 or a 500 -- means the server
 * answered, so the phone is online in the only sense that matters here. Only
 * an error carrying no response at all is a network failure; a request that
 * was cancelled is neither, and must not be read as one.
 */
apiClient.interceptors.response.use(
  (response) => {
    useConnectivityStore.getState().markReached();
    return response;
  },
  async (error: AxiosError) => {
    if (error.response) {
      useConnectivityStore.getState().markReached();
    } else if (error.code !== 'ERR_CANCELED') {
      useConnectivityStore.getState().markUnreachable();
    }

    const config = error.config as RetriableConfig | undefined;
    const isAuthRoute = config?.url?.startsWith('/auth/');
    if (error.response?.status !== 401 || !config || config._retriedAfterRefresh || isAuthRoute) {
      return Promise.reject(error);
    }
    config._retriedAfterRefresh = true;

    if (!refreshInFlight) {
      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    const newToken = await refreshInFlight;

    if (!newToken) {
      const reason = lastRefreshFailure;
      lastRefreshFailure = null;
      await useAuthStore.getState().signOut(
        reason === 'SIGNED_IN_ELSEWHERE' ? { reason } : undefined
      );
      return Promise.reject(error);
    }
    config.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(config);
  }
);

export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string };
};

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (err.message === 'Network Error') {
      return 'Could not reach the server. Check your Wi-Fi connection and try again.';
    }
  }
  return fallback;
}

export function getApiErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    return body?.error?.code;
  }
  return undefined;
}
