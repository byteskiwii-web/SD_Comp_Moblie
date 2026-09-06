import { apiClient } from './client';

export type AttendanceAlertType = 'location_off' | 'developer_mode';
export type AttendanceAlertStatus = 'tracking' | 'pending' | 'approved' | 'rejected';

// What the CLIENT reports. location_off is OPTIONAL: most reporters (the
// foreground 60s tick) can't reliably know their own location state while
// backgrounded (confirmed on a real OnePlus 11 5G, where a
// WorkManager-scheduled background check registered but was never invoked by
// the OS), so by default the server infers it instead from gaps in the
// location-check pings it already receives via the reliably-scheduled
// foreground-service location task -- see
// attendanceAlert.service.js#checkLocationGap. The native shift-timer's tick
// (src/tasks/shiftTimerTask.ts) DOES attempt a location fix itself on each
// wake, so it can report location_off directly for instant detection instead
// of waiting on the gap inference -- see shiftIntegrityCheck.ts.
export type AttendanceAlertConditions = { developer_mode: boolean; location_off?: boolean };

export type AttendanceAlertResult = {
  alertCount: number;
  status: AttendanceAlertStatus;
  /**
   * Which conditions actually incremented the counter on THIS call.
   * location_off can be true here even though this request said nothing
   * about location -- it reflects whatever the server's gap inference found
   * at the same moment.
   */
  counted: Record<AttendanceAlertType, boolean>;
};

// Reports the device's CURRENT Developer Mode state, every check, whether or
// not it changed. The server owns the decision about what counts as a new
// detection (see attendanceAlert.service.js#recordIntegrityState): it holds
// a per-condition open-period flag, so repeat "still on" reports are no-ops
// and only a false -> true edge increments the day's counter.
//
// Deliberately no client-side "already reported" flag: when the device held
// that, a reinstall lost it and one unbroken outage got counted twice
// against the employee, while a server-side reset left the device silent.
//
// employee_id is NOT sent -- the backend's selfSubmit guard sources it from
// the session, same rule as every punch.
export async function reportIntegrityState(input: {
  store_code: string;
  mark_date: string; // YYYY-MM-DD
  conditions: AttendanceAlertConditions;
}) {
  const res = await apiClient.post<{ success: true; data: AttendanceAlertResult }>('/attendance-alerts', input);
  return res.data.data;
}
