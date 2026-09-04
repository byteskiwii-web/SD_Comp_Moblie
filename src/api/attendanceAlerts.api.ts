import { apiClient } from './client';

export type AttendanceAlertType = 'location_off' | 'developer_mode';
export type AttendanceAlertStatus = 'tracking' | 'pending' | 'approved' | 'rejected';

export type AttendanceAlertResult = {
  alertCount: number;
  status: AttendanceAlertStatus;
};

// Records one shift-integrity detection (location services off, or Android
// Developer Mode on). employee_id is NOT sent -- the backend's selfSubmit
// guard sources it from the session, same rule as every punch. Both trigger
// types feed one shared per-day counter server-side; see
// attendanceAlert.service.js#recordAlert.
export async function reportAttendanceAlert(input: {
  store_code: string;
  mark_date: string; // YYYY-MM-DD
  alert_type: AttendanceAlertType;
}) {
  const res = await apiClient.post<{ success: true; data: AttendanceAlertResult }>('/attendance-alerts', input);
  return res.data.data;
}
