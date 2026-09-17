import { t } from '../i18n';

/**
 * Date and time formatting, computed rather than delegated to Intl.
 *
 * WHY NOT toLocaleTimeString: on Hermes it rendered noon-hour times as AM. A
 * punch at 12:21 in the afternoon displayed as "12:21 AM", which put it in the
 * middle of the night on a screen whose whole job is saying when somebody was
 * at work. Every call site was affected, including the bare no-options call, so
 * it was the engine's hour-cycle handling rather than the options passed.
 *
 * Twelve-hour output is computed from getHours() here. It is not localised, and
 * for a single-region product that is the right trade: a time that is correct
 * and plainly formatted beats one that is localisable and twelve hours wrong.
 */

/**
 * Month and weekday names come from the catalogue, not from a constant here.
 *
 * They are content, and a Malayalam screen showing "Tue, 8 Sep" is only half
 * translated. Looked up per call rather than cached in a module constant,
 * because the language can change while the app is running and a captured
 * array would keep painting the language the app started in.
 *
 * Still not Intl: Hermes renders the noon hour as AM, which is the bug this
 * whole file exists to route around. A formatter that cannot be trusted with
 * hours is not one to trust with month names either.
 */
const monthShort = (m: number) => t(('monthShort.' + (m + 1)) as 'monthShort.1');
const dayShort = (d: number) => t(('weekdayShort.' + d) as 'weekdayShort.0');
const dayLong = (d: number) => t(('weekday.' + d) as 'weekday.0');

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * `9:26 AM` / `12:21 PM`. Always 12-hour with AM/PM: a choice of clock was
 * offered once and dropped, because two formats on the same team's phones
 * confused more than it helped. Midnight is 12 AM, noon is 12 PM.
 *
 * Still hand-rolled rather than Intl: Hermes renders the noon hour as AM,
 * which is the bug this function exists to avoid.
 */
export function formatTime(value: string | number | Date, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  const h = d.getHours();
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(d.getMinutes())} ${period}`;
}

/** As formatTime, with seconds — for the diagnostic rows on the punch screen. */
export function formatTimeWithSeconds(value: string | number | Date, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  const h = d.getHours();
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${period}`;
}

/**
 * A roster time as the server sends it -- `"10:00"` or `"19:00:00"` -- as
 * `10:00 AM` / `7:00 PM`. Shift windows arrive as bare wall-clock strings, not
 * instants, and were being printed raw, which is how "10:00 – 19:00" sat on
 * screens where every other time read "5:30 PM".
 */
export function formatClockTime(hhmm: string | null | undefined, fallback = '—'): string {
  if (!hhmm) return fallback;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  const hh = ((h % 24) + 24) % 24;
  const period = hh < 12 ? 'AM' : 'PM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${pad(m)} ${period}`;
}

/**
 * The shift as people say it: `Morning · 11:00 AM – 8:00 PM`. Either half on
 * its own when that is all there is; the fallback when there is neither --
 * which now means HR has not assigned a shift yet (a shift is one of the two
 * templates and nothing else).
 */
export function formatShift(
  name: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
  fallback = '—'
): string {
  const window = formatShiftWindow(start, end, '');
  return [name, window].filter(Boolean).join(' · ') || fallback;
}

/** `10:00 AM – 7:00 PM`, or the fallback when either end is missing. */
export function formatShiftWindow(start: string | null | undefined, end: string | null | undefined, fallback = '—'): string {
  if (!start || !end) return fallback;
  return `${formatClockTime(start)} – ${formatClockTime(end)}`;
}

/** `Tue, 8 Sep`, in the employee's language. */
export function formatDate(value: string | number | Date, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${dayShort(d.getDay())}, ${d.getDate()} ${monthShort(d.getMonth())}`;
}

/** `Tuesday, 8 Sep` — the long form used on the home card. */
export function formatDateLong(value: string | number | Date, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${dayLong(d.getDay())}, ${d.getDate()} ${monthShort(d.getMonth())}`;
}

/**
 * `YYYY-MM-DD` in LOCAL time.
 *
 * Not toISOString().slice(0,10), which converts to UTC first: east of Greenwich
 * that returns yesterday for any time before 05:30, so a morning punch would be
 * filed against the wrong day.
 */
export function toLocalDateKey(value: string | number | Date = new Date()): string {
  const d = toDate(value) ?? new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Newest first, for any list a person reads.
 *
 * Server ordering cannot be relied on for this. GET /regularisation, for
 * example, returns "pending first then oldest first" — correct for a
 * reviewer working a queue, backwards for somebody reading their own history,
 * and the same endpoint serves both. Sorting on the client is what makes the
 * order match what the screen is for.
 *
 * Accepts several keys and uses the first one present, so a row can be dated
 * by whichever field it actually carries.
 */
export function newestFirst<T>(rows: readonly T[], ...keys: (keyof T)[]): T[] {
  const stamp = (row: T): number => {
    for (const k of keys) {
      const v = row[k];
      if (v == null || v === '') continue;
      const t = new Date(v as unknown as string).getTime();
      if (!Number.isNaN(t)) return t;
    }
    return 0;
  };
  return [...rows].sort((a, b) => stamp(b) - stamp(a));
}