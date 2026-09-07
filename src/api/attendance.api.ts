import { Platform } from 'react-native';
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

// Async because the web branch has to read the captured image off a
// blob:/data: URL before it can be attached.
async function buildPunchFormData(input: PunchInput): Promise<FormData> {
  const form = new FormData();
  form.append('employee_id', input.employee_id);
  form.append('store_code', input.store_code);
  form.append('latitude', String(input.latitude));
  form.append('longitude', String(input.longitude));
  form.append('client_timestamp', new Date().toISOString());
  if (input.device_id) form.append('device_id', input.device_id);

  const filename = `selfie_${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    // In a browser this is the real DOM FormData, which stringifies anything
    // that isn't a Blob -- RN's {uri,name,type} shape would be sent as the
    // literal "[object Object]". That uploads silently and succeeds, so the
    // damage only shows up later as a stored selfie that isn't an image.
    // expo-camera hands back a blob:/data: URL on web; fetch resolves both
    // locally without a network round-trip.
    const blob = await (await fetch(input.selfieFilePath)).blob();
    form.append('selfie', blob, filename);
    return form;
  }

  const uri = input.selfieFilePath.startsWith('file://')
    ? input.selfieFilePath
    : `file://${input.selfieFilePath}`;
  // React Native's multipart file shape — not a real Blob/File, but this is
  // the documented convention RN's networking layer expects.
  form.append('selfie', {
    uri,
    name: filename,
    type: 'image/jpeg',
  } as unknown as Blob);

  return form;
}

export async function clockIn(input: PunchInput) {
  const res = await apiClient.post<{ success: true; message: string; data: PunchResult }>(
    '/attendance/clock-in',
    await buildPunchFormData(input),
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data;
}

export async function clockOut(input: PunchInput) {
  const res = await apiClient.post<{ success: true; message: string; data: PunchResult }>(
    '/attendance/clock-out',
    await buildPunchFormData(input),
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
