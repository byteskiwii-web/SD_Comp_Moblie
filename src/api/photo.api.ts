import { apiClient } from './client';
import { API_V1 } from '../constants/config';
import type { PickedFile } from './documents.api';

/**
 * The employee's profile picture.
 *
 * NOT the punch selfie. That one is evidence — captured live under a liveness
 * challenge, bound to an attendance mark, and deleted on a retention schedule.
 * This one is identity: chosen, replaceable, kept with the employment record.
 * They are separate columns server-side for exactly that reason.
 */

export type ProfilePhoto = { photoFileId: string | null; photoUpdatedAt?: string };

/**
 * The URL the app renders.
 *
 * Proxied through the API rather than a Drive link, so every read carries the
 * session and passes the same authority check. `v` busts the cache after a
 * replacement — without it the old picture persists until the cache expires,
 * which reads as the upload having silently failed.
 */
export function profilePhotoUrl(employeeId: string, version?: string | null): string {
  const v = version ? `?v=${encodeURIComponent(version)}` : '';
  return `${API_V1}/users/${encodeURIComponent(employeeId)}/photo${v}`;
}

export async function uploadProfilePhoto(employeeId: string, file: PickedFile): Promise<ProfilePhoto> {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for a file part — not a
  // Blob — which is why this is cast rather than constructed properly.
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

  const res = await apiClient.post<{ success: true; data: ProfilePhoto }>(
    `/users/${encodeURIComponent(employeeId)}/photo`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data;
}

export async function removeProfilePhoto(employeeId: string): Promise<ProfilePhoto> {
  const res = await apiClient.delete<{ success: true; data: ProfilePhoto }>(
    `/users/${encodeURIComponent(employeeId)}/photo`
  );
  return res.data.data;
}
