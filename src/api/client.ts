import axios from 'axios';
import { API_V1 } from '../constants/config';
import { useAuthStore } from '../stores/authStore';

export const apiClient = axios.create({
  baseURL: API_V1,
  timeout: 15000,
});

// Attaches the JWT to every request once one exists. Every attendance route
// now requires it (backend enforces via authenticate() + attendance.authz.js,
// which also overwrites employee_id/approved_by from the session regardless
// of what's in the request body -- so no other mobile-side change was needed
// when that enforcement landed).
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string };
};

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (err.message === 'Network Error') {
      return 'Could not reach the server. Check your Wi-Fi connection and try again.';
    }
  }
  return fallback;
}

export function getApiErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    return body?.error?.code;
  }
  return undefined;
}
