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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `9:26 AM`, `12:21 PM`. Midnight is 12 AM, noon is 12 PM. */
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

/** `Tue, 8 Sep`. */
export function formatDate(value: string | number | Date, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** `Tuesday, 8 Sep` — the long form used on the home card. */
export function formatDateLong(value: string | number | Date, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${long[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
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
