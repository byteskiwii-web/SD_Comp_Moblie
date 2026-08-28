import { apiClient } from './client';
import type { AttendanceMark, LocationCheckResult, PunchResult } from '../types/attendance';

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
