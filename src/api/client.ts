import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { API_V1 } from '../constants/config';
import { useAuthStore } from '../stores/authStore';
import { currentLanguage } from '../stores/preferencesStore';
import { useConnectivityStore } from '../stores/connectivityStore';
import { t, hasTranslation } from '../i18n';
import { adoptPhoneKey, getPhoneKey, phoneHeaders } from '../utils/phoneKey';

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

  /* Which build this is, so the server can refuse a punch from one older than
     app.json's minAppVersion (backend middleware/appVersion.js). */
  const version = installedAppVersion();
  if (version) {
    config.headers['X-App-Version'] = version;
    config.headers['X-App-Platform'] = Platform.OS;
  }

  return config;
});

/**
 * The installed BUILD's version. runtimeVersion is the build's app version
 * (app.config.js: policy 'appVersion' for every native build), and unlike the
 * JS config it does not move with an over-the-air update. null where updates
 * are off (Expo Go, development, web) -- the version gate does not apply there.
 */
export function installedAppVersion(): string | null {
  if (!Updates.isEnabled || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return null;
  const v = Updates.runtimeVersion ?? '';
  return /^\d+(\.\d+){0,2}$/.test(v) ? v : null;
}

/**
 * This phone's key, platform and model, on the routes the phone check reads
 * (backend: modules/devices/phone.check.js) and on nothing else. One place for
 * every punch, the status call and the background location check alike -- the
 * headless shift-timer task goes through this client too. Best effort: a key
 * that cannot be read is simply not sent, and the server answers that.
 */
const PHONE_CHECKED = /^\/(attendance\/(clock-in|clock-out|break-start|break-end|location-check|sync)|devices\/phone)(\/|$)/;
const PUNCH = /^\/attendance\/(clock-in|clock-out|break-start|break-end|sync)(\/|$)/;

/**
 * A punch about to leave with no key -- the status call at app start had not
 * answered yet, or the phone was offline then -- asks for one first, so the
 * first clock-in always registers the phone. Its own plain request, not this
 * client, so it can never loop through this interceptor. When the server
 * hands out no key (phone check off, or an exempt account) it is not asked
 * again for ten minutes, so a punch never waits on it twice.
 */
let ensuringKey: Promise<void> | null = null;
let noKeyUntil = 0;
async function ensurePhoneKey(): Promise<void> {
  if (Date.now() < noKeyUntil || (await getPhoneKey())) return;
  ensuringKey ??= (async () => {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;
      const res = await axios.post(`${API_V1}/devices/phone`, {}, {
        timeout: 8000,
        headers: { Authorization: `Bearer ${token}`, ...(await phoneHeaders()) },
      });
      const key = res.data?.data?.key;
      if (typeof key === 'string') await adoptPhoneKey(key);
      else noKeyUntil = Date.now() + 10 * 60 * 1000;
    } catch {
      // No key this time; the punch goes as it would have.
    } finally {
      ensuringKey = null;
    }
  })();
  await ensuringKey;
}

apiClient.interceptors.request.use(async (config) => {
  if (!PHONE_CHECKED.test(config.url ?? '')) return config;
  try {
    if (PUNCH.test(config.url ?? '')) await ensurePhoneKey();
    const headers = await phoneHeaders();
    for (const [name, value] of Object.entries(headers)) config.headers[name] = value;
  } catch {
    // Never let the phone headers stop a punch from being sent.
  }
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
/**
 * Did the server actually REFUSE the session (a 4xx), rather than fail to
 * answer -- no signal, a 5xx, a timeout or a 429? Only a refusal signs out.
 * Signing out on a busy server is what turned a rate limit into a
 * company-wide lock-out (30 Oct 2026): everyone was sent to a login that was
 * refused for the same reason.
 */
let refreshRefused = true;

async function performRefresh(): Promise<string | null> {
  refreshRefused = true;
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
    const status = (err as AxiosError).response?.status;
    refreshRefused = !!status && status >= 400 && status < 500 && status !== 408 && status !== 429;
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
      // Not refused, only unanswered: stay signed in; the next request retries.
      if (!refreshRefused) return Promise.reject(error);
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

/** Codes that mean the same thing to the employee share one string. */
const ERROR_ALIASES: Record<string, string> = {
  UNAUTHENTICATED: 'INVALID_REFRESH_TOKEN',
  FACE_PHOTO_STORE_FAILED: 'FACE_PHOTO_NOT_SAVED',
  EMAIL_SEND_FAILED: 'EMAIL_NOT_CONFIGURED',
  BANK_SOURCE_DECLINED: 'BANK_UNAVAILABLE',
  BANK_BENEFICIARY_OFFLINE: 'BANK_UNAVAILABLE',
  BANK_NETWORK_UNAVAILABLE: 'BANK_UNAVAILABLE',
  BANK_IMPS_FAILED: 'BANK_UNAVAILABLE',
  BANK_UPSTREAM_FAILED: 'BANK_UNAVAILABLE',
  BANK_TRANSACTION_FAILED: 'BANK_UNAVAILABLE',
  UPSTREAM_AUTH_FAILED: 'UPSTREAM_UNAVAILABLE',
  UPSTREAM_UNRECOGNISED_RESPONSE: 'UPSTREAM_UNAVAILABLE',
  UPSTREAM_QUOTA_OR_WALLET_EXHAUSTED: 'QUOTA_EXHAUSTED',
  PENNY_DROP_NOT_ENABLED: 'PROVIDER_UNSUPPORTED_OPERATION',
};

/**
 * The server's words are English only, so a known code is shown from the
 * phone's own catalogue, in the language the employee picked. Undefined for an
 * unknown code (the server's text is used, as before) or when a placeholder
 * could not be filled -- half a sentence is worse than the English one.
 */
function translatedError(code: string | undefined, details: unknown): string | undefined {
  if (!code) return undefined;
  const plain = details && typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, unknown>) : {};
  const missing = plain.missing;
  const onlyApproval = Array.isArray(missing) && missing.length === 1 && missing[0] === 'approval';
  const key = 'err.' + (code === 'ONBOARDING_INCOMPLETE' && onlyApproval ? 'ONBOARDING_WAITING_HR' : ERROR_ALIASES[code] ?? code);
  if (!hasTranslation(key)) return undefined;
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(plain)) {
    if (typeof v === 'string' || typeof v === 'number') vars[k] = v;
  }
  const text = t(key, vars);
  return /\{\w+\}/.test(text) ? undefined : text;
}

export function getApiErrorMessage(err: unknown, fallback = t('err.generic')): string {
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
    const translated = translatedError(body?.error?.code, body?.error?.details);
    if (translated) return translated;
    if (body?.error?.message) return body.error.message;
    if (err.message === 'Network Error') return t('err.network');
    // A timeout is not "something went wrong", which is what this used to fall
    // through to. It is a specific thing with a specific remedy, and on this
    // app it almost always means a punch photo going up a weak uplink.
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) return t('err.timeout');
  }
  return fallback;
}

/**
 * The verification provider's own words for a failure ("Beneficiary bank
 * offline", "Invalid PAN"), when the server passed them on in
 * `details.providerMessage`. Shown NEXT TO getApiErrorMessage's line, never
 * instead of it. Undefined for anything else -- and never trusts `details`'
 * shape, for the reason given on ApiErrorBody above.
 */
export function getProviderMessage(err: unknown): string | undefined {
  const details = getApiErrorDetails<unknown>(err);
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const said = (details as { providerMessage?: unknown }).providerMessage;
    if (typeof said === 'string' && said.trim()) return said.trim();
  }
  return undefined;
}

export function getApiErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    return body?.error?.code;
  }
  return undefined;
}

/**
 * The raw `details` object for a non-VALIDATION_FAILED error code -- see the
 * comment above on `details`'s shape not being one fixed thing. Typed `T` by
 * the caller, who already knows which code they checked for and what that
 * code's own AppError call site put there (e.g. FACE_CHANGE_PENDING's
 * `{ requestedAt }`). Never assume this exists without checking the code first.
 */
export function getApiErrorDetails<T = unknown>(err: unknown): T | undefined {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    return body?.error?.details as unknown as T | undefined;
  }
  return undefined;
}
