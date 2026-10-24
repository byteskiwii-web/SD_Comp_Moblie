import { apiClient } from './client';
import { adoptPhoneKey } from '../utils/phoneKey';

export type PushPlatform = 'android' | 'ios';

export type RegisteredPushToken = {
  token: string;
  platform: PushPlatform;
  appVersion: string | null;
  registeredAt: string;
  lastSeenAt: string;
};

/**
 * Tell the server how to reach this phone while the app is closed.
 *
 * An idempotent upsert, so it is safe — and intended — to call on every
 * launch once signed in. The token registers under the CURRENT session:
 * signing out revokes the session and with it the token's place in the
 * send path, so there is nothing to undo at sign-out and no call here for it.
 */
export async function registerPushToken(input: {
  token: string;
  platform: PushPlatform;
  appVersion?: string | null;
}) {
  const res = await apiClient.post<{ success: true; data: RegisteredPushToken }>('/devices/push-token', {
    token: input.token,
    platform: input.platform,
    ...(input.appVersion ? { app_version: input.appVersion } : {}),
  });
  return res.data.data;
}

/**
 * Stop pushes to this phone while staying signed in — a preference, not a
 * sign-out. Idempotent; `revoked: false` means the server did not have it.
 */
export async function revokePushToken(token: string) {
  const res = await apiClient.delete<{ success: true; data: { revoked: boolean } }>('/devices/push-token', {
    data: { token },
  });
  return res.data.data;
}

/* ── Phone check (backend: modules/devices/phone.service.js) ────────────────── */

export type PhoneMode = 'off' | 'record' | 'enforce';
export type PhoneState = 'exempt' | 'unregistered' | 'registered' | 'other-phone' | 'other-employee';
export type PhoneChangeReason = 'new-phone' | 'reinstalled' | 'lost-or-broken' | 'other';

export type PhoneChangeRequest = {
  id: string;
  platform: PushPlatform | null;
  model: string | null;
  reason: PhoneChangeReason;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type PhoneStatus = {
  mode: PhoneMode;
  state: PhoneState;
  registeredPhone?: { platform: PushPlatform | null; model: string | null; registeredAt: string } | null;
  request?: PhoneChangeRequest | null;
};

/**
 * Where this phone stands for the signed-in employee. A POST because a phone
 * with no key is given one in the answer -- kept here and never returned to
 * the caller. The phone headers (key, platform, model) are added by the API
 * client's interceptor, like on every punch.
 */
export async function getPhoneStatus(): Promise<PhoneStatus> {
  const res = await apiClient.post<{ success: true; data: PhoneStatus & { key?: string } }>('/devices/phone', {});
  const { key, ...status } = res.data.data;
  if (key) await adoptPhoneKey(key);
  return status;
}

/** Ask HR to make THIS phone the registered one. */
export async function requestPhoneChange(input: { reason: PhoneChangeReason; note?: string }) {
  const res = await apiClient.post<{ success: true; data: PhoneChangeRequest }>('/devices/phone/change-requests', {
    reason: input.reason,
    ...(input.note ? { note: input.note } : {}),
  });
  return res.data.data;
}

export async function cancelPhoneChange(id: string) {
  const res = await apiClient.post<{ success: true; data: PhoneChangeRequest }>(
    `/devices/phone/change-requests/${encodeURIComponent(id)}/cancel`,
    {}
  );
  return res.data.data;
}
