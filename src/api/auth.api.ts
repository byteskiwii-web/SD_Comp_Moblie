import { apiClient } from './client';
import type { Employee, StoreSnapshot } from '../stores/authStore';

export type LoginResponse = {
  success: true;
  message: string;
  data: {
    token: string;
    employee: Employee;
    store: StoreSnapshot;
  };
};

export async function login(employee_id: string, password: string) {
  const res = await apiClient.post<LoginResponse>('/auth/login', { employee_id, password });
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
  const res = await apiClient.post<{ success: true; message: string }>(
    '/auth/forgot-password/reset-password',
    { resetToken, new_password }
  );
  return res.data;
}
