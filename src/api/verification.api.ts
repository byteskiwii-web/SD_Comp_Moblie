import { apiClient } from './client';
import { API_BASE_URL } from '../constants/config';
import { colors } from '../theme/tokens';

export type KycCheckStatus = 'pending' | 'verified' | 'failed';

export type KycStatus = {
  pan: {
    status: KycCheckStatus;
    verifiedAt: string | null;
    masked: string | null;
    /**
     * PAN-Aadhaar linkage, tri-state.
     *
     * `null` means NOT ESTABLISHED, never "not linked" -- the provider
     * returns an undocumented enum and only a plain yes or no is recorded.
     * Rendering null as unlinked would put a false claim about somebody`s
     * tax compliance on their own profile.
     */
    aadhaarLinked?: boolean | null;
    aadhaarLinkCheckedAt?: string | null;
  };
  aadhaar: { status: KycCheckStatus; verifiedAt: string | null };
  bank: { status: KycCheckStatus; verifiedAt: string | null; masked: string | null; ifsc: string | null };
};

export function isKycComplete(kyc: KycStatus): boolean {
  return kyc.pan.status === 'verified' && kyc.aadhaar.status === 'verified';
}

// Shared label/tone for a KYC check's status -- one source of truth, consumed
// identically by the mandatory KYC gate screen and the Profile screen's KYC
// section, so a "Verified" chip looks and reads the same everywhere.
export const KYC_STATUS_LABEL: Record<KycCheckStatus, string> = {
  verified: 'Verified',
  pending: 'Pending',
  failed: 'Failed',
};

export function kycStatusTone(status: KycCheckStatus): { bg: string; fg: string } {
  if (status === 'verified') return { bg: colors.successBg, fg: colors.success };
  if (status === 'failed') return { bg: colors.dangerBg, fg: colors.danger };
  return { bg: colors.warningBg, fg: colors.warning };
}

export type HealthDepsResponse = {
  status: 'ok';
  dependencies: {
    database: 'connected' | 'unavailable';
    verification: 'enabled' | 'disabled';
    // Drive-backed uploads. The whole /documents router is mounted only
    // when this is enabled, so the UI checks it before offering one.
    documents?: 'enabled' | 'disabled';
  };
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

export type IfscLookupResult = {
  ifsc: string;
  bank: string | null;
  branch: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  address: string | null;
};

/**
 * Resolves an IFSC to its bank and branch.
 *
 * Free — public reference data, no quota, no money. Worth calling before the
 * verify: it turns a typo in the IFSC into "no such code" rather than into a
 * failed account check that has already spent quota (or, in penny-drop mode, a
 * rupee sent somewhere unintended).
 */
export async function lookupIfsc(ifsc: string): Promise<IfscLookupResult> {
  const res = await apiClient.post<{ success: true; data: IfscLookupResult }>('/verification/bank/ifsc', {
    ifsc,
  });
  return res.data.data;
}

/** `penniless` checks without moving money. `pennydrop` deposits ₹1 to prove the account is live. */
export type BankVerifyMode = 'penniless' | 'pennydrop';

export type BankVerifyInput = {
  account_number: string;
  ifsc: string;
  name?: string;
  mobile?: string;
  mode?: BankVerifyMode;
};

export type BankVerifyResult = {
  /**
   * Usable for payroll — NOT the provider's raw `account_exists`.
   *
   * The provider reports an account as existing while also reporting it
   * blocked, or an NRE account. The server collapses that to one honest
   * answer; `accountExists` is kept alongside so a failure can be explained.
   */
  verified: boolean;
  accountExists: boolean;
  outcome: string;
  message: string;
  account: { masked: string; ifsc: string; nameAtBank: string | null };
  mode: BankVerifyMode;
  /** Penny-drop only: proof the rupee actually landed. */
  transfer: { utr: string | null; amountDeposited: number | null } | null;
  meta: Record<string, unknown>;
};

/**
 * Verify a bank account.
 *
 * NOT idempotent in penny-drop mode: the server marks that operation
 * non-replayable and never auto-retries it, because a retry deposits a second
 * rupee. Callers must not retry it either — the screen disables its button on
 * the first press for exactly this reason.
 */
export async function verifyBankAccount(input: BankVerifyInput): Promise<BankVerifyResult> {
  const res = await apiClient.post<{ success: true; data: BankVerifyResult }>(
    '/verification/bank/account',
    input
  );
  return res.data.data;
}

// Shared "is the KYC gate required" fetch, consumed by both useKycGate (the
// mandatory Attendance-blocking gate) and the Profile screen's read-only KYC
// section, so there's exactly one place that decides fail-open vs fail-closed.
export type GateData = { verificationEnabled: false } | { verificationEnabled: true; kyc: KycStatus };

export async function fetchKycGateStatus(): Promise<GateData> {
  let deps;
  try {
    deps = await getHealthDeps();
  } catch {
    // Can't even confirm enforcement is meant to be active -- fail OPEN,
    // matching the un-gated behaviour every employee has today.
    return { verificationEnabled: false };
  }
  if (deps.dependencies.verification !== 'enabled') {
    return { verificationEnabled: false };
  }
  // Verification is confirmed enabled from here on -- this call is
  // deliberately NOT wrapped in try/catch. Letting it throw gives a
  // consuming useQuery's `isError` one unambiguous meaning: "enforcement
  // should apply, but we couldn't confirm completion" -- i.e. fail CLOSED.
  const status = await getKycStatus();
  return { verificationEnabled: true, kyc: status.kyc };
}
