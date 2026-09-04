import * as Notifications from 'expo-notifications';
import { CLOCK_OUT_REMINDER_ID } from '../constants/config';
import { useNotificationsStore } from '../stores/notificationsStore';

// The notification handler and Android channel are already registered at
// module scope in backgroundLocationTask.ts (imported once, unconditionally,
// from App.tsx). Deliberately NOT repeated here -- two competing
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
 * Untagged notifications (no data.kind -- e.g. the existing geofence alert,
 * left completely unmodified in backgroundLocationTask.ts) fall into
 * 'general' rather than being dropped, so today's geofence alert shows up in
 * the panel for free.
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
