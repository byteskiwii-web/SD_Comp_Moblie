import { apiClient } from './client';

/**
 * Festivals and holidays.
 *
 * Reads our own backend, never a calendar provider. That is what lets HR add a
 * company shutdown day and correct a wrong one, and what keeps this screen
 * working when the upstream feed is down.
 */
const BASE = '/holidays';

export type HolidayKind = 'festival' | 'public' | 'optional' | 'company';

export const HOLIDAY_KIND_LABEL: Record<HolidayKind, string> = {
  festival: 'Festival',
  public: 'Public holiday',
  optional: 'Optional',
  company: 'Company',
};

export type Holiday = {
  id: string;
  date: string;
  name: string;
  kind: HolidayKind;
  region: string | null;
  source: 'import' | 'hr';
  isActive: boolean;
  notes: string | null;
};

/** Defaults to the current calendar year when no window is given. */
export async function getHolidays(from?: string, to?: string): Promise<Holiday[]> {
  const res = await apiClient.get<{ success: true; data: Holiday[] }>(BASE, {
    params: from && to ? { from, to } : undefined,
  });
  return res.data.data ?? [];
}

/**
 * `today` is an ARRAY on purpose — Pongal and Makar Sankranti share
 * 14 January, and showing only the first is wrong twice a year. `next` comes
 * back alongside so the home screen has something on the ~310 days with no
 * festival, rather than an empty card.
 */
export type TodayHolidays = {
  date: string;
  today: Holiday[];
  next: Holiday | null;
};

export async function getTodayHolidays(): Promise<TodayHolidays> {
  const res = await apiClient.get<{ success: true; data: TodayHolidays }>(`${BASE}/today`);
  return res.data.data;
}
