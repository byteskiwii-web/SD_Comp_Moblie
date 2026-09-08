import { apiClient } from './client';
import type { Employee, StoreSnapshot } from '../stores/authStore';

// Backend's raw session shape (src/modules/auth/auth.service.js#issueSession).
type SessionResponse = {
  success: true;
  data: {
    sessionId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    employee: Employee;
    store: StoreSnapshot;
  };
  meta: { requestId: string; timestamp: string };
};

export async function login(employee_id: string, password: string) {
  const res = await apiClient.post<SessionResponse>('/auth/login', { employee_id, password });
  const { accessToken, refreshToken, employee, store } = res.data.data;
  // Normalized to {token, ...} here so the rest of the app (authStore, the
  // axios interceptor) doesn't need to know the backend calls it accessToken.
  return { token: accessToken, refreshToken, employee, store };
}

/**
 * The acting principal, straight from the session.
 *
 * Deliberately NOT the same shape as login's `employee`: this returns a single
 * `name` and carries the shift window and joining date, but no phone or email.
 * So it refreshes what it can answer for and leaves the rest of the cached
 * record alone rather than blanking fields it was never asked about.
 */
export type Me = {
  id: string;
  name: string | null;
  role: string;
  storeCode: string | null;
  dateOfJoining: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  zoneCode: string | null;
  /** Joining kit. shirtSize is the employee's own; the kit fields are HR's. */
  shirtSize: string | null;
  welcomeKitIssued: boolean;
  welcomeKitIssuedAt: string | null;
};

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];

/**
 * Self-service edit of your own record. Deliberately one field on the server
 * too -- PATCH /users/:id is administrative and a field employee cannot use it
 * on themselves.
 */
export async function updateMyProfile(input: { shirt_size: ShirtSize | null }) {
  const res = await apiClient.patch<{ success: true; data: unknown }>('/users/me', input);
  return res.data.data;
}

export async function getMe() {
  const res = await apiClient.get<{ success: true; data: Me }>('/auth/me');
  return res.data.data;
}

export async function requestPasswordResetOtp(employee_id: string) {
  const res = await apiClient.post<{ success: true; data: { maskedEmail: string } }>(
    '/auth/forgot-password/request-otp',
    { employee_id }
  );
  return res.data.data;
}

export async function verifyPasswordResetOtp(employee_id: string, otp: string) {
  const res = await apiClient.post<{ success: true; data: { resetToken: string } }>(
    '/auth/forgot-password/verify-otp',
    { employee_id, otp }
  );
  return res.data.data;
}

export async function resetPassword(resetToken: string, new_password: string) {
  const res = await apiClient.post<{ success: true; data: { employeeId: string } }>(
    '/auth/forgot-password/reset-password',
    { reset_token: resetToken, new_password }
  );
  return res.data;
}
