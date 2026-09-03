import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useShiftStore } from '../stores/shiftStore';
import { getMe } from '../api/auth.api';
import { cancelClockOutReminder, scheduleClockOutReminder } from '../utils/notifications';

// Reacts to shiftStore.isClockedIn transitions to schedule/cancel the local
// "still on shift?" reminder -- the same reactive pattern
// useLocationPollingEffect already uses for background location polling, so
// ClockPanel.tsx needs no changes: its punch mutations already call
// setClockedIn/setClockedOut, which is exactly what this hook watches.
//
// The query key is deliberately identical to ProfileScreen's meExtrasQuery
// (['auth-me-extras', employee?.id]) so the two share one cache entry --
// visiting Profile after clocking in costs no extra request, and vice versa.
export function useClockOutReminderEffect() {
  const employee = useAuthStore((s) => s.employee);
  const isClockedIn = useShiftStore((s) => s.isClockedIn);

  const meQuery = useQuery({
    queryKey: ['auth-me-extras', employee?.id],
    queryFn: getMe,
    enabled: !!employee && isClockedIn,
    staleTime: 5 * 60 * 1000,
  });

  const shiftEnd = meQuery.data?.shiftEnd ?? null;

  useEffect(() => {
    if (isClockedIn && shiftEnd) {
      scheduleClockOutReminder(shiftEnd).catch((err) => console.warn('[useClockOutReminderEffect]', err));
    } else if (!isClockedIn) {
      cancelClockOutReminder().catch(() => {});
    }
  }, [isClockedIn, shiftEnd]);
}
