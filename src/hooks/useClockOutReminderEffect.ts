import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useShiftStore } from '../stores/shiftStore';
import { getMe } from '../api/auth.api';
import { cancelClockOutReminder, scheduleClockOutReminder, shiftDurationMs } from '../utils/notifications';

// Reacts to shiftStore.isClockedIn transitions to schedule/cancel the local
// "still on shift?" reminder -- the same reactive pattern
// useLocationPollingEffect already uses for background location polling, so
// ClockPanel.tsx needs no changes: its punch mutations already call
// setClockedIn/setClockedOut, which is exactly what this hook watches.
//
// The query key is deliberately identical to ProfileScreen's meExtrasQuery
// (['auth-me-extras', employee?.id]) so the two share one cache entry --
// visiting Profile after clocking in costs no extra request, and vice versa.
/*
 * Schedule and cancel run one after another, never interleaved. Both are
 * chains of awaits (permission read, list pending, cancel, schedule), and a
 * cancel that overlapped a schedule could finish first and leave the
 * reminder it was meant to remove filed behind it.
 */
let queue: Promise<void> = Promise.resolve();
function enqueue(step: () => Promise<void>) {
  queue = queue.then(step, step).catch((err) => console.warn('[useClockOutReminderEffect]', err));
}

export function useClockOutReminderEffect() {
  const employee = useAuthStore((s) => s.employee);
  const isClockedIn = useShiftStore((s) => s.isClockedIn);

  const meQuery = useQuery({
    queryKey: ['auth-me-extras', employee?.id],
    queryFn: getMe,
    enabled: !!employee && isClockedIn,
    staleTime: 5 * 60 * 1000,
  });

  const shiftStart = meQuery.data?.shiftStart ?? null;
  const shiftEnd = meQuery.data?.shiftEnd ?? null;
  const clockInAt = useShiftStore((s) => s.clockInAt);

  useEffect(() => {
    if (isClockedIn && shiftStart && shiftEnd && clockInAt) {
      // 9 hours (or whatever the rostered shift's length is) from the actual
      // punch-in, not from the rostered start time -- an employee who clocks
      // in late or early gets the reminder relative to when they actually
      // started, not a fixed clock time they may not have been on shift for yet.
      const durationMs = shiftDurationMs(shiftStart, shiftEnd);
      // The guard reads the store live rather than closing over `isClockedIn`:
      // the punch that ends the shift can land while this call is still
      // awaiting a permission answer.
      enqueue(() => scheduleClockOutReminder(clockInAt, durationMs, () => useShiftStore.getState().isClockedIn));
    } else if (!isClockedIn) {
      enqueue(() => cancelClockOutReminder());
    }
  }, [isClockedIn, shiftStart, shiftEnd, clockInAt]);
}
