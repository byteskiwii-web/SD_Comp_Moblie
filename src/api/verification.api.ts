import { apiClient } from './client';
import { API_BASE_URL } from '../constants/config';

export type KycCheckStatus = 'pending' | 'verified' | 'failed';

export type KycStatus = {
  pan: { status: KycCheckStatus; verifiedAt: string | null; masked: string | null };
  aadhaar: { status: KycCheckStatus; verifiedAt: string | null };
  bank: { status: KycCheckStatus; verifiedAt: string | null; masked: string | null; ifsc: string | null };
};

export function isKycComplete(kyc: KycStatus): boolean {
  return kyc.pan.status === 'verified' && kyc.aadhaar.status === 'verified';
}

export type HealthDepsResponse = {
  status: 'ok';
  dependencies: { database: 'connected' | 'unavailable'; verification: 'enabled' | 'disabled' };
};

// Unauthenticated, bare-host route -- NOT under /api/v1, so this passes an
// absolute URL to override apiClient's baseURL for this one call. The
// response also carries no {success,data,meta} envelope (src/app.js's
// /health/deps returns {status, dependencies} directly) -- do not add a
// second `.data` unwrap here like every other function in this file does.
export async function getHealthDeps(): Promise<HealthDepsResponse> {
  const res = await apiClient.get<HealthDepsResponse>(`${API_BASE_URL}/health/deps`);
  return res.data;
}

export type KycStatusResponse = { employeeId: string; kyc: KycStatus };

// No employee_id sent -- a field-employee's subject always resolves to
// themselves server-side regardless of what's passed.
export async function getKycStatus(): Promise<KycStatusResponse> {
  const res = await apiClient.get<{ success: true; data: KycStatusResponse }>('/verification/status');
  return res.data.data;
}

export type PanVerifyInput = { pan: string; name_as_per_pan?: string; date_of_birth?: string };
export type PanVerifyResult = {
  verified: boolean;
  outcome: string;
  message: string;
  pan: {
    masked: string;
    status?: string;
    category?: string;
    nameMatches?: boolean | null;
    dateOfBirthMatches?: boolean | null;
    aadhaarLinked?: boolean | null;
    aadhaarLinkConfirmed?: boolean | null;
    remarks?: string | null;
  };
  meta: Record<string, unknown>;
};

// consent is hardcoded here, never a caller-supplied value -- the screen
// that calls this only does so once its own consent checkbox is checked.
export async function verifyPan(input: PanVerifyInput): Promise<PanVerifyResult> {
  const res = await apiClient.post<{ success: true; data: PanVerifyResult }>('/verification/pan', {
    ...input,
    consent: 'y',
  });
  return res.data.data;
}

export type AadhaarOtpRequestInput = { aadhaar_number: string };
export type AadhaarOtpRequestResult = {
  otpSent: boolean;
  outcome: string;
  message: string;
  referenceId: string | null;
  meta: Record<string, unknown>;
};

export async function requestAadhaarOtp(input: AadhaarOtpRequestInput): Promise<AadhaarOtpRequestResult> {
  const res = await apiClient.post<{ success: true; data: AadhaarOtpRequestResult }>('/verification/aadhaar/otp', {
    ...input,
    consent: 'y',
  });
  return res.data.data;
}

export type AadhaarOtpVerifyInput = { reference_id: string; otp: string };
export type AadhaarOtpVerifyResult = {
  verified: boolean;
  outcome: string;
  message: string;
  pending: boolean;
  holder: {
    name: string | null;
    gender: string | null;
    yearOfBirth: number | null;
    state: string | null;
    district: string | null;
    pincode: string | null;
  } | null;
  meta: Record<string, unknown>;
};

export async function verifyAadhaarOtp(input: AadhaarOtpVerifyInput): Promise<AadhaarOtpVerifyResult> {
  const res = await apiClient.post<{ success: true; data: AadhaarOtpVerifyResult }>(
    '/verification/aadhaar/otp/verify',
    input
  );
  return res.data.data;
}
