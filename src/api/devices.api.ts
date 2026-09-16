import { apiClient } from './client';

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
