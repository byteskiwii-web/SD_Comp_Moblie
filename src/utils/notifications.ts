import { getNotifications } from '../native/notificationsModule';
import { BREAK_REMINDER_ID, CLOCK_OUT_REMINDER_ID } from '../constants/config';
import { useNotificationsStore } from '../stores/notificationsStore';
import { t } from '../i18n';

// The notification handler and Android channel are already registered at
// module scope in notificationSetup.ts (imported once, unconditionally, from
// index.ts). Deliberately NOT repeated here -- two competing
// setNotificationHandler calls would be a bug, not extra safety.


/**
 * Cancel a reminder BY WHAT IT IS, not only by the id we filed it under.
 *
 * Reported from a real shift: clocked out at 5:22 PM, still got "Don't forget
 * to clock out" at 8. The app knew he was off shift -- his own Home screen
 * said so -- so the pending notification was one nothing could reach:
 * cancelling by a fixed identifier only removes a reminder still filed under
 * that identifier, and an OS that assigned its own, or a reminder left by an
 * earlier build, survives every cancel this app makes and fires hours later.
 *
 * So the id is tried first (cheap, exact) and then every pending notification
 * carrying this `kind` is swept. Reminders are the one class of notification
 * where a stale one is worse than none: it tells somebody to do a thing they
 * already did, which teaches them to ignore the next one.
 */
async function cancelByKind(kind: string, identifier: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n: any) => n?.content?.data?.kind === kind)
        .map((n: any) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch {
    // Listing is best-effort; the identifier cancel above already ran.
  }
}

/**
 * "Come back to your shift."
 *
 * Scheduled when the break starts, for the moment it runs out -- which is not
 * a flat fifteen minutes. The allowance is a DAILY total, so a second tea
 * break has less room left than the first, and a reminder that always fired
 * at 15 minutes would be early on one and late on the other. The caller does
 * that arithmetic and passes the instant.
 *
 * A due time already past means the allowance was gone before this break
 * began. Firing immediately would be true but useless -- they are already
 * over, and the extended finish time on screen is the thing that matters --
 * so it gives up quietly, exactly as the clock-out reminder does.
 */
export async function scheduleBreakReminder(dueAt: Date): Promise<void> {
  if (!(dueAt instanceof Date) || Number.isNaN(dueAt.getTime())) return;
  if (dueAt.getTime() <= Date.now()) return;

  const Notifications = getNotifications();
  if (!Notifications) return;

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') return; // best-effort -- never blocks a break
  }

  await cancelBreakReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: BREAK_REMINDER_ID,
    content: {
      title: t('remind.breakTitle'),
      body: t('remind.breakBody'),
      data: { kind: 'break-reminder' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueAt },
  });
}

export async function cancelBreakReminder(): Promise<void> {
  await cancelByKind('break-reminder', BREAK_REMINDER_ID);
}

export async function cancelClockOutReminder(): Promise<void> {
  await cancelByKind('clock-out-reminder', CLOCK_OUT_REMINDER_ID);
}

/**
 * Fires an immediate local notification for a shift-integrity detection
 * (location services off, or Developer Mode on -- see
 * useShiftIntegrityWatcher.ts). Unlike the clock-out reminder, this has no
 * fixed identifier: each one is a distinct, one-off alert, not something a
 * later call should replace.
 */
export async function fireIntegrityAlertNotification(input: {
  title: string;
  body: string;
  escalated: boolean;
}): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') return; // best-effort -- never blocks the shift
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: { kind: input.escalated ? 'integrity-escalated' : 'integrity-warning' },
    },
    trigger: null,
  });
}

/**
 * Captures locally-fired notifications into the on-device history list so
 * the bell panel has something to show. Fires while the app is foregrounded
 * or backgrounded-but-alive; if the OS killed the JS process before the
 * scheduled time, the system notification still appears (that part is
 * OS-level and independent of this app), but it cannot be retroactively
 * added here -- expo-notifications exposes no "everything ever delivered"
 * API. That is the accepted tradeoff of doing notifications locally with no
 * backend.
 *
 * Untagged notifications (no data.kind) fall into 'general' rather than
 * being dropped, so anything unanticipated still shows up in the panel
 * instead of vanishing.
 */
export function registerNotificationHistoryListener(): { remove: () => void } {
  const Notifications = getNotifications();
  // A no-op subscription rather than null: App.tsx unconditionally calls
  // .remove() on teardown, and handing it nothing would trade a missing
  // history for a crash on unmount.
  if (!Notifications) return { remove: () => {} };

  return Notifications.addNotificationReceivedListener((event: import('expo-notifications').NotificationResponse['notification']) => {
    const { title, body, data } = event.request.content;
    // A push from the server is already a row in the inbox the sheet reads
    // (its data carries the row's id); capturing it here too would show it
    // twice. Only locally-fired reminders and alerts belong in this list.
    if (data && typeof (data as { id?: unknown }).id === 'string') return;
    const kind = (data as { kind?: string } | undefined)?.kind;
    const type =
      kind === 'clock-out-reminder' ? 'clock-out-reminder' :
      kind === 'geofence-alert' ? 'geofence-alert' :
      kind === 'integrity-warning' ? 'integrity-warning' :
      kind === 'integrity-escalated' ? 'integrity-escalated' :
      'general';
    useNotificationsStore.getState().add({ type, title: title ?? 'Notification', body: body ?? '' });
  });
}
