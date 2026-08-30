import type { AttendanceMark, MarkType } from '../types/attendance';

// Shift and break are two independent timelines sharing one mark_type column
// (mirrors zip-hrms-backend's attendance.service.js SHIFT_TYPES/BREAK_TYPES).
// A break mark can be the most recent mark of the day without meaning the
// shift ended, so status for each timeline must be derived by filtering to
// that timeline's own types first -- never from the single most recent mark
// overall.
export const SHIFT_TYPES: MarkType[] = ['clock-in', 'clock-out'];
export const BREAK_TYPES: MarkType[] = ['break-start', 'break-end'];

// `marks` must already be most-recent-first (the API returns them that way).
export function getLatestMarkOfTypes(marks: AttendanceMark[], types: MarkType[]): AttendanceMark | undefined {
  return marks.find((m) => types.includes(m.mark_type));
}

export function isOnShift(marks: AttendanceMark[]): boolean {
  return getLatestMarkOfTypes(marks, SHIFT_TYPES)?.mark_type === 'clock-in';
}

export function isOnBreak(marks: AttendanceMark[]): boolean {
  return getLatestMarkOfTypes(marks, BREAK_TYPES)?.mark_type === 'break-start';
}
