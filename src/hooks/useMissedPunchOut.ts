import { useQuery } from '@tanstack/react-query';
import { getAttendanceHistory, getMyRegularisations } from '../api/attendance.api';
import { useAuthStore } from '../stores/authStore';
import { missedPunchOut } from '../utils/attendanceStatus';
import { toLocalDateKey } from '../utils/datetime';

/**
 * Yesterday's date key when that shift was never punched out and no correction
 * covers it, otherwise null -- including while either answer is unknown, so a
 * slow or failed request never accuses anybody.
 *
 * Same query keys as RegularisePanel, so the two share one cache: raising the
 * request there is what clears this.
 */
export function useMissedPunchOut(): string | null {
  const employee = useAuthStore((s) => s.employee);
  const yesterday = toLocalDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const month = yesterday.slice(0, 7);

  const day = useQuery({
    queryKey: ['attendance-day', employee?.id, yesterday],
    queryFn: () => getAttendanceHistory(employee!.id, yesterday, yesterday),
    enabled: !!employee,
  });
  const requests = useQuery({
    queryKey: ['regularisation-mine', employee?.id, month],
    queryFn: () => getMyRegularisations(employee!.id, month),
    enabled: !!employee,
  });

  if (!day.data || !requests.data) return null;
  return missedPunchOut(day.data, requests.data.items, yesterday) ? yesterday : null;
}
