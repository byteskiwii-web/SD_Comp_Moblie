import * as Notifications from 'expo-notifications';
import { BREAK_REMINDER_ID, CLOCK_OUT_REMINDER_ID } from '../constants/config';
import { useNotificationsStore } from '../stores/notificationsStore';

// The notification handler and Android channel are already registered at
// module scope in notificationSetup.ts (imported once, unconditionally, from
// index.ts). Deliberately NOT repeated here -- two competing
// setNotificationHandler calls would be a bug, not extra safety.

function parseHHMMSS(t: string): { h: number; m: number; s: number } {
  const [h, m, s] = t.split(':').map(Number);
  return { h, m: m || 0, s: s || 0 };
}

/**
 * Schedules (or reschedules) a single local reminder for shiftEnd, today.
 *
 * If shiftEnd has already passed today, rolls forward one day once -- this
 * handles an overnight shift (e.g. shiftStart 22:00 / shiftEnd 06:00), where
 * "today's" shiftEnd instant is earlier than the clock-in instant that
 * triggered this call. If even that rolled-forward instant is already in the
 * past, this gives up quietly rather than firing a stale, confusing reminder.
 *
 * The fixed CLOCK_OUT_REMINDER_ID means only one of these is ever pending:
 * cancel-then-schedule leaves nothing to accumulate across repeated clock-ins.
 */
export async function scheduleClockOutReminder(shiftEnd: string): Promise<void> {
  const { h, m, s } = parseHHMMSS(shiftEnd);
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);
  if (target.getTime() <= now.getTime()) {
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }
  if (target.getTime() <= now.getTime()) return; // still in the past -- give up quietly

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') return; // best-effort -- never blocks a shift
  }

  await cancelClockOutReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: CLOCK_OUT_REMINDER_ID,
    content: {
      title: 'Still on shift?',
      body: "It's past your shift end time. Don't forget to clock out.",
      data: { kind: 'clock-out-reminder' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
  });
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

  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') return; // best-effort -- never blocks a break
  }

  await cancelBreakReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: BREAK_REMINDER_ID,
    content: {
      title: 'Break is over',
      body: 'Time to come back to your shift. Going over extends your shift by the same amount.',
      data: { kind: 'break-reminder' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueAt },
  });
}

export async function cancelBreakReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BREAK_REMINDER_ID).catch(() => {});
}
export async function cancelClockOutReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(CLOCK_OUT_REMINDER_ID).catch(() => {});
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
export function registerNotificationHistoryListener() {
  return Notifications.addNotificationReceivedListener((event) => {
    const { title, body, data } = event.request.content;
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
