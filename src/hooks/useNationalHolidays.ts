import { useQuery } from '@tanstack/react-query';
import { getHolidays, type Holiday } from '../api/holidays.api';
import { toLocalDateKey } from '../utils/datetime';

/**
 * National holidays (kind 'public': Republic Day, Independence Day, Gandhi
 * Jayanti) from today to a year ahead, soonest first.
 *
 * These are the days that EARN comp off: clocking in on one gives a day back
 * (leave.service.js#compOffBalance). The app shows them wherever comp off is
 * mentioned, so an employee can see the next chance to earn one rather than
 * finding out afterwards. One query, shared by every screen that asks.
 */
export function useNationalHolidays() {
  const today = toLocalDateKey();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const until = toLocalDateKey(nextYear);

  const query = useQuery({
    queryKey: ['national-holidays', today],
    queryFn: () => getHolidays(today, until),
    // A holiday calendar changes a few times a year.
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });

  const upcoming: Holiday[] = (query.data ?? [])
    .filter((h) => h.kind === 'public' && h.isActive !== false)
    // Two rows for one date (a regional copy) are still one holiday.
    .filter((h, i, all) => all.findIndex((x) => String(x.date).slice(0, 10) === String(h.date).slice(0, 10)) === i)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return { upcoming, isLoading: query.isLoading };
}

/** The national holidays that fall inside [from, to] (YYYY-MM-DD, inclusive). */
export function nationalHolidaysIn(holidays: Holiday[], from: string, to: string): Holiday[] {
  return holidays.filter((h) => {
    const d = String(h.date).slice(0, 10);
    return d >= from && d <= to;
  });
}
