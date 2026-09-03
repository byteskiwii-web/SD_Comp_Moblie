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

// Extra self-profile fields not returned by /auth/login -- see
// zip-hrms-backend's auth.controller.js#me / auth.service.js#getProfileExtras.
export type MeResponse = {
  id: string;
  name: string;
  role: string;
  storeCode: string | null;
  dateOfJoining: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

export async function getMe() {
  const res = await apiClient.get<{ success: true; data: MeResponse }>('/auth/me');
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
