import axios from 'axios';
import { API_V1 } from '../constants/config';
import { useAuthStore } from '../stores/authStore';

export const apiClient = axios.create({
  baseURL: API_V1,
  timeout: 15000,
});

// Attaches the JWT to every request once one exists. Harmless today since
// no backend route requires it yet — no mobile-side change needed when the
// backend starts enforcing auth on attendance/approval routes.
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
