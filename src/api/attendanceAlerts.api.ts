import { apiClient } from './client';

export type AttendanceAlertType = 'location_off' | 'developer_mode';
export type AttendanceAlertStatus = 'tracking' | 'pending' | 'approved' | 'rejected';

export type AttendanceAlertConditions = Record<AttendanceAlertType, boolean>;

export type AttendanceAlertResult = {
  alertCount: number;
  status: AttendanceAlertStatus;
  /** Which conditions actually incremented the counter on THIS call. */
  counted: AttendanceAlertConditions;
};

// Reports the device's CURRENT integrity state -- both conditions, every
// check, whether or not anything changed. The server owns the decision about
// what counts as a new detection (see attendanceAlert.service.js
// #recordIntegrityState): it holds a per-condition open-period flag, so
// repeat "still off" reports are no-ops and only a false -> true edge
// increments the day's counter.
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
