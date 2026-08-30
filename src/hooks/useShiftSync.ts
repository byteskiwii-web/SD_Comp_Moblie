import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useShiftStore } from '../stores/shiftStore';
import { getAttendanceHistory } from '../api/attendance.api';
import { getLatestMarkOfTypes, SHIFT_TYPES, BREAK_TYPES } from '../utils/attendanceStatus';

// The server is the source of truth for "am I clocked in" / "am I on
// break" -- reconciled on mount, on every app-foreground transition, and
// callable manually right after a clock-in/out/break mutation succeeds.
// This is what actually gates the background-location effect
// (useLocationPollingEffect), not just the locally-persisted shiftStore
// value, so a killed-and-reopened app or a clock-out/break-start that
// happened elsewhere is always corrected.
export function useShiftSync() {
  const employee = useAuthStore((s) => s.employee);
  const setClockedIn = useShiftStore((s) => s.setClockedIn);
  const setClockedOut = useShiftStore((s) => s.setClockedOut);
  const setOnBreak = useShiftStore((s) => s.setOnBreak);
  const setOffBreak = useShiftStore((s) => s.setOffBreak);

  const sync = useCallback(async () => {
    if (!employee) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      // Marks come back most-recent-first -- with multiple clock-in/out
      // cycles per day (e.g. lunch breaks), only the LATEST mark tells you
      // whether the employee is currently on shift. Checking "does a
      // clock-in exist today" would stay stuck on `true` forever after the
      // first cycle, even after clocking back out. Must also be filtered to
      // shift-type marks specifically -- a break-start/break-end can now be
      // the most recent mark overall without the shift having ended.
      const marks = await getAttendanceHistory(employee.id, today, today);
      const latestShiftMark = getLatestMarkOfTypes(marks, SHIFT_TYPES);
      if (latestShiftMark?.mark_type === 'clock-in') {
        setClockedIn(latestShiftMark.store_code, latestShiftMark.timestamp);
        // Location tracking should only run while the employee is expected
        // to be inside the store -- not while on a break -- so break status
        // is reconciled the same way, but only while actually on shift.
        const latestBreakMark = getLatestMarkOfTypes(marks, BREAK_TYPES);
        if (latestBreakMark?.mark_type === 'break-start') {
          setOnBreak();
        } else {
          setOffBreak();
        }
      } else {
        setClockedOut();
      }
    } catch {
      // Network hiccup -- keep whatever the locally-persisted value was;
      // the next foreground/mount sync will retry.
    }
  }, [employee, setClockedIn, setClockedOut, setOnBreak, setOffBreak]);

  useEffect(() => {
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return { sync };
}
