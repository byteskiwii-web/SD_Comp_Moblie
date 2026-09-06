import { apiClient } from './client';
import type {
  AttendanceMark,
  LocationCheckResult,
  MonthlySummary,
  PunchResult,
  Regularisation,
  RegularisationRequestType,
} from '../types/attendance';

type PunchInput = {
  employee_id: string;
  store_code: string;
  latitude: number;
  longitude: number;
  device_id?: string;
  selfieFilePath: string; // filesystem path from VisionCamera's capturePhotoToFile
};

function buildPunchFormData(input: PunchInput): FormData {
  const form = new FormData();
  form.append('employee_id', input.employee_id);
  form.append('store_code', input.store_code);
  form.append('latitude', String(input.latitude));
  form.append('longitude', String(input.longitude));
  form.append('client_timestamp', new Date().toISOString());
  if (input.device_id) form.append('device_id', input.device_id);

  const uri = input.selfieFilePath.startsWith('file://')
    ? input.selfieFilePath
    : `file://${input.selfieFilePath}`;
  // React Native's multipart file shape — not a real Blob/File, but this is
  // the documented convention RN's networking layer expects.
  form.append('selfie', {
    uri,
    name: `selfie_${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);

  return form;
}

export async function clockIn(input: PunchInput) {
  const res = await apiClient.post<{ success: true; message: string; data: PunchResult }>(
    '/attendance/clock-in',
    buildPunchFormData(input),
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data;
}

export async function clockOut(input: PunchInput) {
  const res = await apiClient.post<{ success: true; message: string; data: PunchResult }>(
    '/attendance/clock-out',
    buildPunchFormData(input),
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data;
}

type BreakInput = {
  employee_id: string;
  store_code: string;
  latitude: number;
  longitude: number;
  device_id?: string;
};

// Breaks are geofence-only -- no selfie, so no multipart/FormData, unlike
// clock-in/clock-out above.
export async function startBreak(input: BreakInput) {
  const res = await apiClient.post<{ success: true; message: string; data: PunchResult }>(
    '/attendance/break-start',
    { ...input, client_timestamp: new Date().toISOString() }
  );
  return res.data.data;
}

export async function endBreak(input: BreakInput) {
  const res = await apiClient.post<{ success: true; message: string; data: PunchResult }>(
    '/attendance/break-end',
    { ...input, client_timestamp: new Date().toISOString() }
  );
  return res.data.data;
}

export async function getAttendanceHistory(employeeId: string, fromDate?: string, toDate?: string) {
  const res = await apiClient.get<{ success: true; data: AttendanceMark[] }>(
    `/attendance/${employeeId}`,
    { params: { from_date: fromDate, to_date: toDate } }
  );
  return res.data.data;
}

export async function locationCheck(input: {
  employee_id: string;
  store_code: string;
  latitude: number;
  longitude: number;
}) {
  const res = await apiClient.post<{ success: true; data: LocationCheckResult; alert: string | null }>(
    '/attendance/location-check',
    {
      ...input,
      client_timestamp: new Date().toISOString(),
    }
  );
  return res.data;
}

// Present/absent day counts for one calendar month. Sunday-exclusion and the
// date_of_joining/today clipping all happen server-side (attendance.service.js
// #getMonthlySummary) -- this call just displays whatever it's given.
export async function getMonthlySummary(employeeId: string, month?: string) {
  const res = await apiClient.get<{ success: true; data: MonthlySummary }>(
    `/attendance/${employeeId}/summary`,
    { params: { month } }
  );
  return res.data.data;
}

type RegularisationInput = {
  store_code: string;
  mark_date: string; // YYYY-MM-DD
  request_type: RegularisationRequestType;
  requested_clock_in?: string; // ISO datetime -- only meaningful for 'adjust'
  requested_clock_out?: string;
  reason: string;
};

// employee_id is NOT sent -- omitting it raises the request under the
// caller's own id. Sending someone else's id here would need reviewer
// authority the mobile app's own employee session never has, so there is
// nothing this app could gain by sending one.
export async function submitRegularisation(input: RegularisationInput) {
  const res = await apiClient.post<{ success: true; data: Regularisation }>('/regularisation', input);
  return res.data.data;
}

// No employeeId param, and no path segment for one: GET /regularisation is
// self-scoped exactly like every other endpoint in this app -- a
// field-employee calling it with no filters gets only their own requests,
// newest-pending-first. `data` is the flat array; paging rides in `meta`
// (this app doesn't page its own request list, so meta is ignored).
export async function getMyRegularisations() {
  const res = await apiClient.get<{ success: true; data: Regularisation[] }>('/regularisation');
  return res.data.data;
}
