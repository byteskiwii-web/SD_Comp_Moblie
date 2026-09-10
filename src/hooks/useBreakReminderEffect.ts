import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useShiftStore } from '../stores/shiftStore';
import { getMe } from '../api/auth.api';
import { getAttendanceHistory } from '../api/attendance.api';
import { summariseDay } from '../utils/attendanceDay';
import { toLocalDateKey } from '../utils/datetime';
import { cancelBreakReminder, scheduleBreakReminder } from '../utils/notifications';

/**
 * Schedules "come back to your shift" for the moment the break runs out.
 *
 * Reacts to shiftStore.isOnBreak the same way useClockOutReminderEffect reacts
 * to isClockedIn, so ClockPanel needs no changes: its break mutations already
 * call setOnBreak/setOffBreak, which is exactly what this watches.
 *
 * THE DUE TIME IS NOT A FLAT FIFTEEN MINUTES. The allowance is a daily total —
 * two tea breaks and a lunch, sixty minutes between them — so what is left
 * depends on what has already been taken today. A reminder that always fired
 * fifteen minutes in would be early on the first break and late on the last.
 * So this reads today's closed breaks and subtracts them.
 *
 * An employee on no shift template has no allowance, and gets no reminder
 * rather than an immediate one: `null` there means "no policy", and treating
 * it as zero would buzz the moment anybody stepped away.
 */
export function useBreakReminderEffect() {
  const employee = useAuthStore((s) => s.employee);
  const isOnBreak = useShiftStore((s) => s.isOnBreak);
  const breakStartedAt = useShiftStore((s) => s.breakStartedAt);

  // Shares the cache entry ProfileScreen and the clock-out reminder already
  // use, so being on break costs no extra request.
  const meQuery = useQuery({
    queryKey: ['auth-me-extras', employee?.id],
    queryFn: getMe,
    enabled: !!employee && isOnBreak,
    staleTime: 5 * 60 * 1000,
  });

  // Today's marks, for the breaks already spent. Only fetched while on a
  // break, and refetched on each one so a second break sees the first.
  const todayQuery = useQuery({
    queryKey: ['attendance-today', employee?.id],
    queryFn: () => getAttendanceHistory(employee!.id, toLocalDateKey(), toLocalDateKey()),
    enabled: !!employee && isOnBreak,
  });

  const allowance = meQuery.data?.shift?.breakAllowanceMinutes ?? null;

  useEffect(() => {
    if (!isOnBreak || !breakStartedAt) {
      cancelBreakReminder().catch(() => {});
      return;
    }
    if (allowance === null || allowance === undefined) return;

    // Closed breaks only. The one running now has not been spent yet, and
    // counting it would subtract the same minutes twice.
    const day = summariseDay(toLocalDateKey(), todayQuery.data ?? []);
    const remaining = Math.max(0, allowance - (day.breakMinutes ?? 0));

    const dueAt = new Date(new Date(breakStartedAt).getTime() + remaining * 60_000);
    scheduleBreakReminder(dueAt).catch((err) => console.warn('[useBreakReminderEffect]', err));
  }, [isOnBreak, breakStartedAt, allowance, todayQuery.data]);
}
