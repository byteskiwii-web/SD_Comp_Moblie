import { apiClient } from './client';

export type NotificationType = 'kudos' | 'regularisation' | 'policy' | 'onboarding' | 'system';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string | null;
  body: string;
  /** An in-app path, never a full URL, or null. */
  linkPath: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  /** The row asks the employee to DO something, not merely to know it. */
  actionRequired: boolean;
  resolvedAt: string | null;
  /**
   * actionRequired AND not yet resolved — the only one of the three a screen
   * should branch on. Reading such a row does not clear this; only the action
   * does, and only the server may record it.
   */
  needsAction: boolean;
};

/**
 * There is no create endpoint, deliberately: notifications are written by the
 * service that owns the event they describe. For a field employee today that
 * means exactly one source — a manager deciding one of their attendance
 * corrections. Nothing the app does can post one directly.
 */
export async function getNotifications(params?: {
  unread?: boolean;
  needsAction?: boolean;
  limit?: number;
  before?: string;
}) {
  const res = await apiClient.get<{
    success: true;
    // Note the key is `notifications`, not `items` — unlike the other list
    // endpoints in this API.
    data: { notifications: AppNotification[]; nextBefore: string | null };
  }>('/notifications', {
    params: {
      ...(params?.unread ? { unread: 'true' } : {}),
      ...(params?.needsAction ? { needsAction: 'true' } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.before ? { before: params.before } : {}),
    },
  });
  return res.data.data;
}

/**
 * How often the badge is re-read.
 *
 * 20s rather than the 60s this shipped with. The badge is the cheapest query
 * in the app -- two FILTERed counts over a partial index scoped to one
 * employee -- and it is the only thing that tells a client anything changed,
 * so it is the right place to spend request budget. The inbox LIST is no
 * longer on a timer of its own; it refetches when this number moves, which
 * is both more responsive and half the traffic the two separate polls cost.
 */
export const NOTIFICATION_POLL_MS = 20_000;

export type NotificationCounts = { unread: number; needsAction: number };

/**
 * Both badge numbers in one request.
 *
 * `needsAction` is not a subset of `unread`: an acknowledgement read on Monday
 * and still unsigned on Friday counts in one and not the other.
 */
export async function getUnreadCount(): Promise<NotificationCounts> {
  const res = await apiClient.get<{ success: true; data: Partial<NotificationCounts> }>(
    '/notifications/unread-count'
  );
  // Defaulted rather than asserted: a phone on an old build talking to a new
  // server, or the reverse, should show a sane badge instead of NaN. This app
  // has already crashed once on a response shape it assumed.
  return {
    unread: res.data.data?.unread ?? 0,
    needsAction: res.data.data?.needsAction ?? 0,
  };
}

export async function markNotificationRead(id: string) {
  const res = await apiClient.post<{ success: true; data: AppNotification }>(`/notifications/${id}/read`);
  return res.data.data;
}

/** Put one back to unread — the employee's own correction to a stray tap. */
export async function markNotificationUnread(id: string) {
  const res = await apiClient.delete<{ success: true; data: AppNotification }>(`/notifications/${id}/read`);
  return res.data.data;
}

/**
 * @returns `updated` moved to read, and `skipped` — left unread because they
 *   still owe an action. A non-zero `skipped` is worth telling the user about,
 *   or the badge not reaching zero looks like a bug.
 */
export async function markAllNotificationsRead() {
  const res = await apiClient.post<{ success: true; data: { updated: number; skipped: number } }>(
    '/notifications/read-all'
  );
  return res.data.data;
}
