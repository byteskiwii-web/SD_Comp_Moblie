import { Platform } from 'react-native';
import { apiClient } from './client';
import { shrinkSelfie } from './attendance.api';

/**
 * Face enrolment.
 *
 * Mirrors attendance.api.ts's punch upload shape (multipart, RN's
 * {uri,name,type} file part on native, a real Blob on web) rather than
 * introducing a second convention -- the two are the same kind of request,
 * a live selfie captured under the same liveness check going to a self-hosted
 * model. What differs is the endpoint and that this one carries an explicit
 * consent flag, which the server stamps into an audited, withdrawable
 * consent row (src/face/face.service.js) rather than trusting the client's
 * word for it at verify time.
 */

export type FaceStatus = 'pending' | 'registered' | 'failed';

export type FaceStatusResponse = {
  employeeId: string;
  status: FaceStatus;
  registeredAt: string | null;
};

// No employee_id sent -- like getKycStatus, a field-employee's subject
// always resolves to themselves server-side regardless of what's passed.
export async function getFaceStatus(): Promise<FaceStatusResponse> {
  const res = await apiClient.get<{ success: true; data: FaceStatusResponse }>('/face/status');
  return res.data.data;
}

export type FaceEnrolResult = {
  registered: boolean;
  qualityScore: number | null;
  registeredAt: string;
};

/**
 * Enrols (or re-enrols) the caller's face template from a freshly captured
 * selfie. `consent` must be explicitly true -- the server refuses the
 * request otherwise (VALIDATION_FAILED) rather than treating a missing flag
 * as an assumed yes.
 */
export async function enrolFace(input: { selfieFilePath: string; consent: true }): Promise<FaceEnrolResult> {
  const form = new FormData();
  form.append('consent', 'true');

  const filename = `face_enrol_${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    // See attendance.api.ts's buildPunchFormData: the browser's real
    // FormData stringifies anything that isn't a Blob, so RN's {uri,name,
    // type} shape would upload as the literal text "[object Object]".
    const blob = await (await fetch(input.selfieFilePath)).blob();
    form.append('photo', blob, filename);
  } else {
    const original = input.selfieFilePath.startsWith('file://')
      ? input.selfieFilePath
      : `file://${input.selfieFilePath}`;
    const uri = await shrinkSelfie(original);
    form.append('photo', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
  }

  const res = await apiClient.post<{ success: true; data: FaceEnrolResult }>('/face/enrol', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Same reasoning as PUNCH_TIMEOUT_MS in attendance.api.ts: this uploads a
    // photo over the same shop-floor connections a punch does.
    timeout: 60000,
  });
  return res.data.data;
}

export async function withdrawFaceConsent(): Promise<{ withdrawn: boolean }> {
  const res = await apiClient.delete<{ success: true; data: { withdrawn: boolean } }>('/face/consent');
  return res.data.data;
}
