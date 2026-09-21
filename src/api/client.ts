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

    /*
     * THE SERVER SAYS THIS ACCOUNT MUST CHANGE ITS PASSWORD FIRST.
     *
     * It refuses everything but a handful of auth routes until then, so
     * without this the app sits on a screen whose every query fails and says
     * nothing about why -- which is precisely what happened: an account
     * flagged after it had already signed in never learned, because the flag
     * was only ever read from the login response.
     *
     * Flipping it here sends RootNavigator to the set-password screen from
     * whatever request happened to be refused first, so the session heals
     * itself rather than waiting for a fresh sign-in.
     */
    if (
      error.response?.status === 403 &&
      (error.response.data as { error?: { code?: string } } | undefined)?.error?.code ===
        'PASSWORD_CHANGE_REQUIRED'
    ) {
      useAuthStore.getState().requirePasswordChange();
      return Promise.reject(error);
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
  error: {
    code: string;
    message: string;
    /**
     * Which field, and what it needed. Present on VALIDATION_FAILED.
     *
     * The top-level message for those is "Some of the details provided are not
     * valid." -- true, and useless: it names neither the field nor the shape.
     * Somebody signing in as TL-0001 instead of TL-00001 was told only that
     * something was wrong, and read that as a wrong password.
     *
     * NOT EVERY ERROR'S `details` IS THIS SHAPE. AppError.toClientPayload()
     * (backend) passes whatever object a caller gave it straight through --
     * ONBOARDING_INCOMPLETE sends `{ missing: [...] }`, FACE_NOT_RECOGNISED
     * sends `{ attemptsRemaining }`, and there is no server-side guarantee
     * that this array shape is the only one that will ever exist. Typed here
     * as the VALIDATION_FAILED case because that is the one caller below
     * that actually reads it -- getApiErrorMessage below does NOT trust this
     * type and checks Array.isArray() before ever touching it.
     */
    details?: { field?: string; message?: string }[];
  };
};

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    /*
     * The specific complaint beats the general one.
     *
     * A validation failure carries the field that was wrong and what it should
     * look like; the envelope carries only "some of the details are not valid".
     * Showing the envelope turns "your employee ID is one digit short" into a
     * mystery, and the nearest guess is always "wrong password".
     *
     * Only the first: the forms these come from show one line, and a list of
     * every fault at once reads as a wall rather than an instruction.
     *
     * Array.isArray() GUARDS THIS, DELIBERATELY. `details` is only ever this
     * {field,message}[] shape for VALIDATION_FAILED -- every other error code
     * that carries `details` (ONBOARDING_INCOMPLETE's `{missing}`,
     * FACE_NOT_RECOGNISED's `{attemptsRemaining}`, and any future one) sends
     * a plain object. `details?.find` on a plain object is `undefined`, and
     * `undefined(...)` throws "TypeError: undefined is not a function" --
     * uncaught, since this runs inside a mutation's onError handler with
     * nothing downstream to catch it. That crashed the app on a real device
     * the moment a face check correctly refused a mismatch, which is a worse
     * outcome than the punch failure it was reporting.
     */
    const detail = Array.isArray(body?.error?.details)
      ? body.error.details.find((d) => d?.message)?.message
      : undefined;
    if (detail) return detail;
    if (body?.error?.message) return body.error.message;
    if (err.message === 'Network Error') {
      return 'Could not reach the server. Check your Wi-Fi connection and try again.';
    }
    // A timeout is not "something went wrong", which is what this used to fall
    // through to. It is a specific thing with a specific remedy, and on this
    // app it almost always means a punch photo going up a weak uplink.
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) {
      return 'The connection is too slow to finish that right now. Move somewhere with better signal and try again.';
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
