import { apiClient } from './client';

// The server-side inbox (zip-hrms-backend migration 023, api-contract §6).
// Every authenticated principal has one and each call operates only on the
// caller's own rows -- none of these endpoints takes an employee id, and
// sending one would be ignored.
//
// Distinct from src/stores/notificationsStore.ts, which holds alerts this
// device generated itself (clock-out reminder, geofence, shift-integrity).
// Those have no server counterpart: they are produced by background tasks
// that run while the app may be offline or killed. Both feeds are merged for
// display by src/hooks/useNotificationInbox.ts.
export type ServerNotificationType = 'kudos' | 'regularisation' | 'policy' | 'onboarding' | 'system';

export type ServerNotification = {
  id: string;
  type: ServerNotificationType;
  // Nullable: notification.service.js#emit defaults `title` to null and
  // several callers rely on that, sending only a body.
  title: string | null;
  body: string;
  // An in-app path for the client to navigate to, or null. Written for the
  // web console's router (e.g. '/attendance?x=1'), so it does NOT map onto
  // this app's navigator -- deliberately unused here rather than guessed at.
  linkPath: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPage = {
  notifications: ServerNotification[];
  nextBefore: string | null;
};

/**
 * One page of the caller's inbox, newest first.
 *
 * `nextBefore` is returned for keyset pagination but is not consumed yet: the
 * panel is a fixed-height bottom sheet showing the most recent page, and an
 * infinite-scroll affordance there would be UI with nothing to reveal for any
 * realistic inbox size. Kept in the type so adding it later needs no change
 * here.
 */
export async function listNotifications(params: { unread?: boolean; limit?: number; before?: string } = {}) {
  const res = await apiClient.get<{ success: true; data: NotificationPage }>('/notifications', {
    params: {
      // The server reads the string 'true', not a boolean -- axios would
      // serialize `false` as "false", which is also falsy server-side, but
      // omitting it entirely is what the contract documents.
      ...(params.unread ? { unread: 'true' } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(params.before ? { before: params.before } : {}),
    },
  });
  return res.data.data;
}

/**
 * Marks every unread notification read.
 *
 * The contract also documents `GET /notifications/unread-count` and
 * `POST /notifications/:id/read`; neither is mirrored here because neither has
 * a caller. The badge is derived from the page this module already fetches
 * rather than a second round-trip, and the panel marks the whole inbox read on
 * open (the prototype's mobile panel has no per-row read affordance), so there
 * is no single-row read to express. Both are a small addition if that changes.
 */
export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const res = await apiClient.post<{ success: true; data: { updated: number } }>('/notifications/read-all');
  return res.data.data;
}
