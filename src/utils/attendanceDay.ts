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
  /** Kept beside the name so the day can be labelled "Name (CODE)". */
  storeCode: string | null;
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

/**
 * `asOf` makes a RUNNING shift measurable.
 *
 * Without it gross needs both a first-in and a last-out, so a day still in
 * progress reported nothing at all -- somebody four hours into a shift saw a
 * dash where their hours should be. Passing the current time measures the
 * open period up to now instead.
 *
 * Only ever pass it for TODAY. Handing it to a past day with a missing
 * clock-out would silently accrue hours forever against a shift that ended
 * weeks ago, turning a forgotten punch into a growing overtime claim.
 */
export function summariseDay(date: string, dayMarks: AttendanceMark[], asOf?: Date): DaySummary {
  const marks = chronological(dayMarks);
  const pairs = pairUp(marks, SHIFT_IN, SHIFT_OUT);
  const breaks = pairUp(marks, BREAK_IN, BREAK_OUT);

  const firstIn = marks.find((m) => m.mark_type === SHIFT_IN) ?? null;
  const lastOut = [...marks].reverse().find((m) => m.mark_type === SHIFT_OUT) ?? null;
  const openEnded = pairs.some((p) => p.outAt === null);

  const grossMinutes =
    firstIn && lastOut
      ? minutesBetween(firstIn.timestamp, lastOut.timestamp)
      : firstIn && openEnded && asOf
        ? minutesBetween(firstIn.timestamp, asOf.toISOString())
        : null;

  // Only breaks that actually closed are deducted. An unclosed break would
  // otherwise subtract the rest of the day.
  const breakMinutes = breaks.reduce(
    (total, b) =>
      total +
      (b.outAt
        ? minutesBetween(b.inAt, b.outAt)
        : // A break still running counts up to now, but only when a clock is
          // supplied. Otherwise effective hours would keep climbing while
          // somebody is sitting on their break.
          asOf
          ? minutesBetween(b.inAt, asOf.toISOString())
          : 0),
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
    storeCode: marks.find((m) => m.store_code)?.store_code ?? null,
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

/**
 * What is wrong with a finished day, if anything -- the same two rules the
 * server's register applies, so the phone and the console agree.
 *
 *   breakOverrunMinutes  closed break time beyond the shift's allowance
 *   shortByMinutes       rostered hours (shift length minus the allowance)
 *                        the effective time fell short of, by more than the
 *                        tolerance -- nobody leaves to the minute
 *
 * Both are 0 unless the day is complete (both punches) and the person is on
 * a shift: an open day is regularisation's problem, and no shift means no
 * expectation to fall short of.
 */
export const SHORT_DAY_TOLERANCE_MIN = 30;

export function dayDiscrepancies(
  day: Pick<DaySummary, 'grossMinutes' | 'effectiveMinutes' | 'breakMinutes' | 'openEnded'>,
  shift: { shiftStart: string | null | undefined; shiftEnd: string | null | undefined; breakAllowanceMinutes: number | null | undefined }
): { breakOverrunMinutes: number; shortByMinutes: number; expectedMinutes: number | null } {
  const start = minutesOfDay(shift.shiftStart);
  const end = minutesOfDay(shift.shiftEnd);
  const allowance = shift.breakAllowanceMinutes ?? null;
  const expectedMinutes =
    start === null || end === null ? null : ((end - start + 1440) % 1440) - (allowance ?? 0);
  if (day.openEnded || day.effectiveMinutes === null) return { breakOverrunMinutes: 0, shortByMinutes: 0, expectedMinutes };
  const breakOverrunMinutes = allowance !== null && day.breakMinutes > allowance ? day.breakMinutes - allowance : 0;
  const shortByMinutes =
    expectedMinutes !== null && expectedMinutes - day.effectiveMinutes > SHORT_DAY_TOLERANCE_MIN
      ? expectedMinutes - day.effectiveMinutes
      : 0;
  return { breakOverrunMinutes, shortByMinutes, expectedMinutes };
}

/**
 * Where "now" sits against the shift, for the Clock In button: open, not yet
 * (with when it opens), or over. Mirrors the server's rule; the server is
 * still the one that refuses. null when there is no shift -- never gated.
 */
export function clockInWindow(
  shiftStart: string | null | undefined,
  shiftEnd: string | null | undefined,
  now: Date = new Date(),
  leadInMinutes = 30
): { state: 'open' | 'not-started' | 'over'; opensAt: string | null } | null {
  const start = minutesOfDay(shiftStart);
  const end = minutesOfDay(shiftEnd);
  if (start === null || end === null) return null;
  const openMin = (start - leadInMinutes + 1440) % 1440;
  const span = (end - openMin + 1440) % 1440;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const elapsed = (nowMin - openMin + 1440) % 1440;
  const opensAt = `${String(Math.floor(openMin / 60)).padStart(2, '0')}:${String(openMin % 60).padStart(2, '0')}`;
  if (elapsed <= span) return { state: 'open', opensAt };
  /*
   * Closed -- but for which shift? For a shift that runs inside one day
   * (11:00-20:00) the closed stretch runs OVER MIDNIGHT, so the calendar day
   * decides, not whichever edge is nearer in minutes: at 00:33 the nearer
   * edge is last night's ending, which had the app announcing "your shift for
   * today is over" ten hours before that day's shift opened. A night shift
   * (22:00-06:00) has its closed stretch inside one day, with no midnight in
   * it to be wrong about, so there the nearer edge still answers.
   *
   * Mirrors assertClockInAllowed on the server, which is the rule that
   * actually refuses -- this is only what the screen says.
   */
  const sinceEnd = elapsed - span;
  const untilOpen = (openMin - nowMin + 1440) % 1440;
  const runsInOneDay = start < end;
  const notStarted = runsInOneDay ? nowMin < openMin : untilOpen < sinceEnd;
  return { state: notStarted ? 'not-started' : 'over', opensAt };
}

/**
 * Is the rostered shift window open right now?
 *
 * The geo-fence is a question about a punch that is about to happen. Off
 * shift there is no such punch, so "Outside geo-fence, 6.5 km away, needs HR
 * approval" read at home in the evening is not a warning about anything -- it
 * is a fact about where somebody lives, styled as a problem with their
 * attendance.
 *
 * Returns null, not false, when there is no roster. No shift template means
 * there is no window to be outside of, and a caller that gates on this must
 * be able to tell "closed" from "not applicable" -- treating the second as
 * the first would hide the fence permanently from everyone unrostered, who
 * are exactly the people whose punches get judged on location alone.
 *
 * LEAD-IN, because arriving early is normal. Somebody standing outside the
 * gate at five to ten is deciding where to be when the shift starts, and the
 * fence line is the answer to that. Ending exactly on the rostered end is
 * fine by contrast: an employee still clocked in past it is on shift by the
 * only measure that counts, and callers check that separately.
 *
 * Wrap is measured forward from the opening edge rather than by comparing
 * "now" to two endpoints, because a night shift's window crosses midnight and
 * so can the lead-in on its own -- a 00:00 start opens at 23:30 the day
 * before. One forward distance against one length handles both without the
 * endpoint comparison quietly inverting.
 */
export function isWithinShiftWindow(
  shiftStart: string | null | undefined,
  shiftEnd: string | null | undefined,
  now: Date = new Date(),
  leadInMinutes = 30
): boolean | null {
  const start = minutesOfDay(shiftStart);
  const end = minutesOfDay(shiftEnd);
  if (start === null || end === null) return null;

  const overnight = end <= start;
  const spanMinutes = (overnight ? end + 1440 - start : end - start) + leadInMinutes;
  const opensAt = (start - leadInMinutes + 1440) % 1440;
  const sinceOpen = (now.getHours() * 60 + now.getMinutes() - opensAt + 1440) % 1440;
  return sinceOpen <= spanMinutes;
}

/** "HH:MM:SS" (or "HH:MM") to minutes past midnight; null if unparseable. */
function minutesOfDay(hhmmss: string | null | undefined): number | null {
  if (!hhmmss) return null;
  const [h, m] = String(hhmmss).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

