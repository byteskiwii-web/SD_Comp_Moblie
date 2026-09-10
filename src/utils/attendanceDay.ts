import type { AttendanceMark } from '../types/attendance';

/**
 * Turns a flat list of punches into per-day summaries.
 *
 * The API returns marks, not days — there is no server-side notion of a shift,
 * so gross and effective hours are derived here. Both numbers matter and they
 * are not the same thing:
 *
 *   gross      first punch to last punch. Time on site.
 *   effective  gross minus every break. Time actually worked.
 *
 * A day with no clock-out yet (still on shift, or a missed punch) reports what
 * it can and flags itself, rather than inventing an end time — that gap is
 * exactly what regularisation exists to correct.
 */

export type PunchPair = {
  inAt: string;
  outAt: string | null;
};

export type DaySummary = {
  date: string;
  marks: AttendanceMark[];
  /** Chronological in/out pairs, breaks excluded. */
  pairs: PunchPair[];
  firstIn: AttendanceMark | null;
  lastOut: AttendanceMark | null;
  grossMinutes: number | null;
  effectiveMinutes: number | null;
  /** Total minutes spent on CLOSED breaks. An open break counts nothing yet. */
  breakMinutes: number;
  /** A clock-in with no matching clock-out. Either still on shift, or missed. */
  openEnded: boolean;
  /** Any punch the server flagged as outside the fence. */
  hasOutsideFence: boolean;
  storeName: string | null;
};

const SHIFT_IN = 'clock-in';
const SHIFT_OUT = 'clock-out';
const BREAK_IN = 'break-start';
const BREAK_OUT = 'break-end';

const minutesBetween = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

/** Oldest first. The API hands back newest first. */
function chronological(marks: AttendanceMark[]) {
  return [...marks].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Walk the day once, pairing each opening punch with the next closing one of
 * the same kind. Duplicate opens are ignored rather than treated as a new
 * period — two clock-ins with no clock-out between them is a double tap, and
 * counting the second would silently shorten the day.
 */
function pairUp(marks: AttendanceMark[], openType: string, closeType: string): PunchPair[] {
  const pairs: PunchPair[] = [];
  let openAt: string | null = null;

  for (const m of marks) {
    if (m.mark_type === openType) {
      if (openAt === null) openAt = m.timestamp;
    } else if (m.mark_type === closeType && openAt !== null) {
      pairs.push({ inAt: openAt, outAt: m.timestamp });
      openAt = null;
    }
  }
  if (openAt !== null) pairs.push({ inAt: openAt, outAt: null });
  return pairs;
}

export function summariseDay(date: string, dayMarks: AttendanceMark[]): DaySummary {
  const marks = chronological(dayMarks);
  const pairs = pairUp(marks, SHIFT_IN, SHIFT_OUT);
  const breaks = pairUp(marks, BREAK_IN, BREAK_OUT);

  const firstIn = marks.find((m) => m.mark_type === SHIFT_IN) ?? null;
  const lastOut = [...marks].reverse().find((m) => m.mark_type === SHIFT_OUT) ?? null;
  const openEnded = pairs.some((p) => p.outAt === null);

  const grossMinutes =
    firstIn && lastOut ? minutesBetween(firstIn.timestamp, lastOut.timestamp) : null;

  // Only breaks that actually closed are deducted. An unclosed break would
  // otherwise subtract the rest of the day.
  const breakMinutes = breaks.reduce(
    (total, b) => total + (b.outAt ? minutesBetween(b.inAt, b.outAt) : 0),
    0
  );

  return {
    date,
    marks,
    pairs,
    firstIn,
    lastOut,
    grossMinutes,
    breakMinutes,
    effectiveMinutes: grossMinutes === null ? null : Math.max(0, grossMinutes - breakMinutes),
    openEnded,
    hasOutsideFence: marks.some((m) => m.inside_geofence === false),
    storeName: marks.find((m) => m.store_name)?.store_name ?? null,
  };
}

/** Newest day first, which is how the list is read. */
export function summariseDays(marks: AttendanceMark[]): DaySummary[] {
  const byDate = new Map<string, AttendanceMark[]>();
  for (const m of marks) {
    const key = String(m.mark_date).slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(m);
    byDate.set(key, list);
  }
  return Array.from(byDate.entries())
    .map(([date, dayMarks]) => summariseDay(date, dayMarks))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** `8h 38m`, or `—` when the day has no closing punch to measure against. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Late against the rostered start, when one is known.
 *
 * /auth/me carries shiftStart as "HH:MM:SS"; without it there is no roster to
 * judge against and this returns null so the UI can stay silent rather than
 * calling everybody on time.
 */
export function punctuality(
  firstIn: AttendanceMark | null,
  shiftStart: string | null,
  graceMinutes = 10
): 'on-time' | 'late' | null {
  if (!firstIn || !shiftStart) return null;
  const [h, m] = shiftStart.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  const actual = new Date(firstIn.timestamp);
  const rostered = new Date(actual);
  rostered.setHours(h, m, 0, 0);
  return actual.getTime() - rostered.getTime() > graceMinutes * 60000 ? 'late' : 'on-time';
}
