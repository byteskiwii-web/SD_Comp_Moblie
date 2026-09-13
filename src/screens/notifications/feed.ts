/**
 * One list out of two sources.
 *
 * The inbox has always had two halves that never met:
 *
 *   SERVER  things the org did to your record — a correction decided, a policy
 *           published, kudos received. Read state lives in Postgres and
 *           follows you between devices.
 *
 *   DEVICE  things this phone noticed — a clock-out reminder, a geofence
 *           alert, an integrity warning. Raised by the OS while the app is in
 *           the foreground and captured by registerNotificationHistoryListener.
 *           They cannot be server rows: the backend never learns of them.
 *
 * The device half used to render in NotificationPanel, which nothing has
 * imported since the sheet replaced it — so those alerts were still being
 * recorded and no screen showed them. A geofence warning that nothing displays
 * is worse than one that was never raised, because the code reads as though
 * the feature works.
 *
 * This module normalises both into one shape so the sheet can sort them
 * together by time. The `source` discriminator survives into the row, because
 * the two halves genuinely behave differently: a device item has no link to
 * follow, no action to owe, and marks itself read in AsyncStorage rather than
 * over the network.
 */
import type { AppNotification, NotificationType } from '../../api/notifications.api';
import type { LocalNotification } from '../../stores/notificationsStore';

export type FeedItem = {
  id: string;
  source: 'server' | 'device';
  /** Server types, plus the device kinds, kept distinct so icons can differ. */
  kind: NotificationType | LocalNotification['type'];
  title: string | null;
  body: string;
  /** ISO. Named for what it is rather than createdAt/timestamp per source. */
  at: string;
  isRead: boolean;
  linkPath: string | null;
  needsAction: boolean;
};

export function fromServer(n: AppNotification): FeedItem {
  return {
    id: n.id,
    source: 'server',
    kind: n.type,
    title: n.title,
    body: n.body,
    at: n.createdAt,
    isRead: n.isRead,
    linkPath: n.linkPath,
    // Defaulted, not assumed: a phone updated ahead of the server sees these
    // fields missing, and `undefined` would render as a permanent "needs you"
    // pill on every row.
    needsAction: n.needsAction === true,
  };
}

export function fromDevice(n: LocalNotification): FeedItem {
  return {
    id: `local:${n.id}`,
    source: 'device',
    kind: n.type,
    title: n.title,
    body: n.body,
    at: n.timestamp,
    isRead: n.read,
    linkPath: null,
    needsAction: false,
  };
}

/**
 * Newest first, across both sources.
 *
 * Ties break on id so the order is total and stable — two alerts raised in the
 * same millisecond must not swap places between renders, which is visible as a
 * flicker on a list that re-sorts every poll.
 */
export function mergeFeed(server: AppNotification[], device: LocalNotification[]): FeedItem[] {
  return [...server.map(fromServer), ...device.map(fromDevice)].sort((a, b) => {
    const d = Date.parse(b.at) - Date.parse(a.at);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

/**
 * Day buckets for the list's section headers.
 *
 * Compared on the DEVICE's calendar day, deliberately. Elsewhere in this
 * product "today" means the IST business day and is computed on the server,
 * because attendance is an org fact. A notification header is not: it answers
 * "was this while I was awake today", which is the phone's own midnight even
 * for someone travelling.
 */
export type FeedBucket = 'today' | 'yesterday' | 'earlier';

export function bucketOf(iso: string, now = new Date()): FeedBucket {
  const d = new Date(iso);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (t >= midnight) return 'today';
  if (t >= midnight - 86400000) return 'yesterday';
  return 'earlier';
}

/** The feed split into its buckets, each preserving the merged order. */
export function groupByDay(items: FeedItem[], now = new Date()) {
  const out: { bucket: FeedBucket; items: FeedItem[] }[] = [];
  for (const item of items) {
    const bucket = bucketOf(item.at, now);
    const last = out[out.length - 1];
    if (last && last.bucket === bucket) last.items.push(item);
    else out.push({ bucket, items: [item] });
  }
  return out;
}
