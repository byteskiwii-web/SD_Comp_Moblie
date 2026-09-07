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
};

/**
 * There is no create endpoint, deliberately: notifications are written by the
 * service that owns the event they describe. For a field employee today that
 * means exactly one source — a manager deciding one of their attendance
 * corrections. Nothing the app does can post one directly.
 */
export async function getNotifications(params?: { unread?: boolean; limit?: number; before?: string }) {
  const res = await apiClient.get<{
    success: true;
    // Note the key is `notifications`, not `items` — unlike the other list
    // endpoints in this API.
    data: { notifications: AppNotification[]; nextBefore: string | null };
  }>('/notifications', {
    params: {
      ...(params?.unread ? { unread: 'true' } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.before ? { before: params.before } : {}),
    },
  });
  return res.data.data;
}

export async function getUnreadCount() {
  const res = await apiClient.get<{ success: true; data: { unread: number } }>('/notifications/unread-count');
  return res.data.data.unread;
}

export async function markNotificationRead(id: string) {
  const res = await apiClient.post<{ success: true; data: AppNotification }>(`/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead() {
  const res = await apiClient.post<{ success: true; data: { updated: number } }>('/notifications/read-all');
  return res.data.data;
}
