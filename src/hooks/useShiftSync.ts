import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useShiftStore } from '../stores/shiftStore';
import { getAttendanceHistory } from '../api/attendance.api';

// The server is the source of truth for "am I clocked in" -- reconciled on
// mount, on every app-foreground transition, and callable manually right
// after a clock-in/out mutation succeeds. This is what actually gates the
// background-location effect (useLocationPollingEffect), not just the
// locally-persisted shiftStore value, so a killed-and-reopened app or a
// clock-out that happened elsewhere is always corrected.
export function useShiftSync() {
  const employee = useAuthStore((s) => s.employee);
  const setClockedIn = useShiftStore((s) => s.setClockedIn);
  const setClockedOut = useShiftStore((s) => s.setClockedOut);

  const sync = useCallback(async () => {
    if (!employee) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      // Marks come back most-recent-first -- with multiple clock-in/out
      // cycles per day (e.g. lunch breaks), only the LATEST mark tells you
      // whether the employee is currently on shift. Checking "does a
      // clock-in exist today" would stay stuck on `true` forever after the
      // first cycle, even after clocking back out.
      const marks = await getAttendanceHistory(employee.id, today, today);
      const latest = marks[0];
      if (latest?.mark_type === 'clock-in') {
        setClockedIn(latest.store_code, latest.timestamp);
      } else {
        setClockedOut();
      }
    } catch {
      // Network hiccup -- keep whatever the locally-persisted value was;
      // the next foreground/mount sync will retry.
    }
  }, [employee, setClockedIn, setClockedOut]);

  useEffect(() => {
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return { sync };
}
