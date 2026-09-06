import { apiClient } from './client';

export type AttendanceAlertType = 'location_off' | 'developer_mode';
export type AttendanceAlertStatus = 'tracking' | 'pending' | 'approved' | 'rejected';

// What the CLIENT reports. location_off is deliberately absent: a device
// with location off can't reliably report that while backgrounded (confirmed
// on a real OnePlus 11 5G, where a WorkManager-scheduled background check
// registered but was never invoked by the OS), so the server infers it
// instead from gaps in the location-check pings it already receives via the
// existing, reliably-scheduled foreground-service location task -- see
// attendanceAlert.service.js#checkLocationGap.
export type AttendanceAlertConditions = { developer_mode: boolean };

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
