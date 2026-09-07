import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  markAllNotificationsRead,
  ServerNotification,
  ServerNotificationType,
} from '../api/notifications.api';
import { LocalNotificationType, useNotificationsStore } from '../stores/notificationsStore';
import { useAuthStore } from '../stores/authStore';

export const notificationsQueryKey = (employeeId?: string) => ['notifications', employeeId] as const;

// One page is all the bottom-sheet panel can usefully show. The server clamps
// `limit` to 50; 30 is comfortably more rows than fit on screen, so the list
// scrolls without a "load more" affordance that would reveal nothing new for
// any realistic inbox.
const PAGE_SIZE = 30;

// A stable identity for "the server half has not loaded". Writing `?? []`
// inline would mint a new array on every render before the first fetch
// settles, which is a changed dependency, which re-runs the merge useMemo
// every time -- exactly when there is nothing to merge.
const NO_SERVER_ITEMS: ServerNotification[] = [];

/**
 * A single row in the merged inbox.
 *
 * The two feeds stay distinguishable by `source` rather than being flattened
 * into one shape, because they differ in what can be done to a row: a local
 * alert can be dismissed (it exists only on this device), a server one cannot
 * (there is no delete endpoint, and hiding it here would desync it from the
 * web console's view of the same inbox).
 */
export type InboxItem =
  | {
      source: 'local';
      id: string;
      type: LocalNotificationType;
      title: string;
      body: string;
      timestamp: string;
      read: boolean;
    }
  | {
      source: 'server';
      id: string;
      type: ServerNotificationType;
      title: string | null;
      body: string;
      timestamp: string;
      read: boolean;
    };

/**
 * The notification inbox: this device's own alerts merged with the server's.
 *
 * Two feeds because they have genuinely different origins. Background tasks
 * raise clock-out, geofence and shift-integrity alerts locally, often while
 * the app is killed and sometimes with no connectivity, so those can never be
 * server-sourced. Everything the organisation raises -- a regularisation
 * decided, a policy published, kudos received -- exists only server-side.
 * Showing one list is a display concern; merging them in the store would mean
 * writing server rows into persisted device storage, where they would go stale
 * and could never be reconciled.
 *
 * The server half degrades quietly: if the fetch fails (offline, or the token
 * is being refreshed) the local half still renders, which is the half most
 * likely to matter when a field employee has no signal.
 */
export function useNotificationInbox() {
  const token = useAuthStore((s) => s.token);
  const employeeId = useAuthStore((s) => s.employee?.id);
  const queryClient = useQueryClient();

  const localItems = useNotificationsStore((s) => s.items);
  const markLocalAllRead = useNotificationsStore((s) => s.markAllRead);
  const removeLocal = useNotificationsStore((s) => s.remove);

  const query = useQuery({
    queryKey: notificationsQueryKey(employeeId),
    queryFn: () => listNotifications({ limit: PAGE_SIZE }),
    enabled: Boolean(token),
    // The bell is mounted for as long as Home is, so this would otherwise
    // refetch on every re-render of a parent. Half a minute is fresh enough
    // for an inbox that is also refetched on every foreground.
    staleTime: 30 * 1000,
    // A failed inbox fetch costs the user nothing -- the local half still
    // renders and the next foreground retries. Retrying here would only delay
    // that first render behind a backoff.
    retry: false,
  });

  // This app's QueryClient is constructed with defaults only (App.tsx), so
  // there is no focus-refetch wiring; the same explicit AppState listener
  // useShiftSync and useKycGate already use is what refreshes this after the
  // app has been backgrounded.
  const refetch = query.refetch;
  useEffect(() => {
    if (!token) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    return () => subscription.remove();
  }, [token, refetch]);

  const serverItems = query.data?.notifications ?? NO_SERVER_ITEMS;

  const items = useMemo<InboxItem[]>(() => {
    const merged: InboxItem[] = [
      ...localItems.map(
        (n): InboxItem => ({
          source: 'local',
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          timestamp: n.timestamp,
          read: n.read,
        })
      ),
      ...serverItems.map(
        (n): InboxItem => ({
          source: 'server',
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          timestamp: n.createdAt,
          read: n.isRead,
        })
      ),
    ];
    // Newest first. Both feeds carry ISO-8601 UTC timestamps, which sort
    // correctly as strings, but Date comparison states the intent and is
    // robust to a server that ever returns an offset instead of 'Z'.
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [localItems, serverItems]);

  const unreadCount = items.filter((i) => !i.read).length;
  const hasUnreadServer = serverItems.some((n) => !n.isRead);

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey(employeeId) }),
  });

  /**
   * Marks both halves read.
   *
   * The server call is guarded on there actually being an unread server row.
   * Opening the panel is what triggers this, the write endpoints are
   * rate-limited per principal (429), and a user flicking the panel open and
   * shut would otherwise spend that budget on a no-op.
   */
  const mutateAllRead = markAllReadMutation.mutate;
  const markAllRead = useCallback(() => {
    markLocalAllRead();
    if (hasUnreadServer) mutateAllRead();
  }, [markLocalAllRead, hasUnreadServer, mutateAllRead]);

  return {
    items,
    unreadCount,
    markAllRead,
    removeLocal,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
