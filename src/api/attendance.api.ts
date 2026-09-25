import { Platform } from 'react-native';
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
  /**
   * Sent with a clock-in only. A clock-out carries no location — that is
   * what the permission screen promises ("your location when you clock in")
   * and the server discards coordinates on a clock-out anyway, so sending
   * them would be a request the API is documented to ignore.
   */
  latitude?: number;
  longitude?: number;
  device_id?: string;
  selfieFilePath: string; // filesystem path from VisionCamera's capturePhotoToFile
};

// Async because the web branch has to read the captured image off a
// blob:/data: URL before it can be attached.
/**
 * How long a punch may take.
 *
 * The client's default is 15s, which is right for reading JSON and wrong for
 * pushing a photo off a phone: on shop-floor mobile data a selfie upload
 * regularly runs past it, and an aborted upload looks to the employee exactly
 * like a mark that did not happen -- it IS a mark that did not happen. The
 * request is idempotent enough to be worth waiting for, and waiting beats a
 * missing attendance record.
 */
const PUNCH_TIMEOUT_MS = 60000;

/**
 * The selfie, shrunk before it leaves the phone.
 *
 * A camera frame is 2-5 MB and 3000+ px on a side; the review screen shows
 * it at a few hundred px, and Drive was filling up with originals. 1280 px
 * on the long side at JPEG 0.72 is ~150-300 KB -- more than enough to
 * recognise a face -- and uploads in a fraction of the time on shop-floor
 * data, which is where punches used to time out.
 *
 * Every camera path lands here (VisionCamera, expo-camera, the WebView
 * liveness check), so this is the one place to do it. Best effort: an APK
 * built before expo-image-manipulator had a native half cannot shrink and
 * uploads the original, exactly as before. A file already under the size
 * cap is sent as is rather than re-encoded.
 *
 * Exported for face.api.ts's enrolment upload too: the recognition model
 * compares an enrolment embedding against a punch embedding, and differing
 * compression between the two would shift both and cost accuracy for no
 * reason -- so the same shrink, at the same size and quality, runs before
 * either leaves the phone.
 */
const SELFIE_MAX_PX = 1280;
const SELFIE_QUALITY = 0.72;
const SELFIE_SMALL_ENOUGH_BYTES = 400 * 1024;

export async function shrinkSelfie(uri: string): Promise<string> {
  try {
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const size = new File(uri).size;
    if (typeof size === 'number' && size > 0 && size <= SELFIE_SMALL_ENOUGH_BYTES) return uri;
  } catch {
    // Unknown size: shrink anyway; it is cheap and the upload is not.
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    const { width, height } = probe;
    // Only its size was wanted. Freed now rather than at some later GC, so the
    // decode below is not a second full-resolution bitmap alongside this one.
    try { probe.release(); } catch { /* best effort */ }
    const context = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > SELFIE_MAX_PX) {
      context.resize(width >= height ? { width: SELFIE_MAX_PX } : { height: SELFIE_MAX_PX });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: SELFIE_QUALITY });
    return saved.uri;
  } catch (err) {
    console.warn('[punch] could not shrink the selfie; uploading the original', err);
    return uri;
  }
}

async function buildPunchFormData(input: PunchInput): Promise<FormData> {
  const form = new FormData();
  form.append('employee_id', input.employee_id);
  form.append('store_code', input.store_code);
  if (input.latitude != null && input.longitude != null) {
    form.append('latitude', String(input.latitude));
    form.append('longitude', String(input.longitude));
  }
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

  const original = input.selfieFilePath.startsWith('file://')
    ? input.selfieFilePath
    : `file://${input.selfieFilePath}`;
  const uri = await shrinkSelfie(original);
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
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: PUNCH_TIMEOUT_MS }
  );
  return res.data.data;
}

export async function clockOut(input: PunchInput) {
  const res = await apiClient.post<{ success: true; message: string; data: PunchResult }>(
    '/attendance/clock-out',
    await buildPunchFormData(input),
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: PUNCH_TIMEOUT_MS }
  );
  return res.data.data;
}

/** No location: a break is not judged against the fence — see PunchInput. */
type BreakInput = {
  employee_id: string;
  store_code: string;
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
/**
 * This month's correction allowance, alongside the requests themselves.
 *
 * The cap has always been enforced -- submit() refuses the request that would
 * exceed it -- but the employee only ever met it as a refusal AFTER filling in
 * the form. The server now returns the figures in the list envelope, so the
 * screen can say how many are left before anybody types anything.
 *
 * Optional in the type on purpose: an app on a newer build talking to a server
 * that predates this must show no allowance line, not "undefined of undefined".
 */
export type RegularisationAllowance = {
  monthlyLimit?: number;
  usedThisMonth?: number;
  remainingThisMonth?: number;
};

/**
 * Withdraw a request you raised.
 *
 * The server takes it only while the request is still pending and only from
 * the employee who owns it -- a decided request is part of the attendance
 * record and is not the employee's to remove. A 404 here therefore means
 * "somebody decided it while you were looking at it", not "no such request".
 */
export async function cancelRegularisation(id: string) {
  const res = await apiClient.post<{ success: true; data: Regularisation }>(
    `/regularisation/${id}/cancel`
  );
  return res.data.data;
}

// Same reasoning as getMyLeave: the server scopes by level, so a scoped role
// asking for "my requests" was handed the whole store's.
export async function getMyRegularisations(employeeId: string, month?: string) {
  const res = await apiClient.get<{
    success: true;
    data: Regularisation[];
    meta?: RegularisationAllowance;
  }>('/regularisation', {
    params: month ? { month, employee_id: employeeId } : { employee_id: employeeId },
  });
  return { items: res.data.data, allowance: res.data.meta ?? {} };
}
