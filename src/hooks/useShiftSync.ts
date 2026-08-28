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
      const marks = await getAttendanceHistory(employee.id, today, today);
      const clockIn = marks.find((m) => m.mark_type === 'clock-in');
      const clockOut = marks.find((m) => m.mark_type === 'clock-out');
      if (clockIn && !clockOut) {
        setClockedIn(clockIn.store_code, clockIn.timestamp);
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
