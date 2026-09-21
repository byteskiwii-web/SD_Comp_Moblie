import { apiClient } from './client';
import { API_BASE_URL } from '../constants/config';
import { ColorScheme } from '../theme/tokens';

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
  /**
   * Self-hosted, not a vendor check (src/face/) -- a different status
   * vocabulary from the three above on purpose: `registered` reads honestly
   * for "a template exists" where `verified` would imply a third party
   * confirmed something, which nothing here does. KycCard.tsx maps it onto
   * the shared `verified` tone/label for display rather than this app
   * inventing a fourth chip colour for one row.
   */
  face: { status: 'pending' | 'registered' | 'failed'; registeredAt: string | null };
};

// Shared label/tone for a KYC check's status -- one source of truth, consumed
// identically by the onboarding checklist and the Profile screen's KYC
// section, so a "Verified" chip looks and reads the same everywhere.
/** Catalogue keys, not text -- a module constant would freeze the language. */
export const KYC_STATUS_KEY = {
  verified: 'status.verified',
  pending: 'status.pending',
  failed: 'status.failed',
} as const;

export function kycStatusTone(status: KycCheckStatus, colors: ColorScheme): { bg: string; fg: string } {
  if (status === 'verified') return { bg: colors.successBg, fg: colors.successText };
  if (status === 'failed') return { bg: colors.dangerBg, fg: colors.dangerText };
  return { bg: colors.warningBg, fg: colors.warningText };
}

/**
 * What the ACTIVE KYC provider can do right now -- read this instead of
 * hardcoding which screens exist. `sandbox` (today's default) reports
 * `{ combinedPanAadhaar: false, aadhaarOtp: true, bank: true }`, so nothing
 * visible changes for a deployment that never switches provider.
 */
export type KycCapabilities = {
  /** PAN and Aadhaar are verified together from one PAN screen submission. */
  combinedPanAadhaar: boolean;
  /** The standalone Aadhaar OTP screens (request/verify) are usable. */
  aadhaarOtp: boolean;
  /** Bank account verification is usable at all. */
  bank: boolean;
  /** The money-moving penny-drop mode is usable — false under SurePass, which only has Pennyless wired up. */
  bankPennyDrop: boolean;
  /** The free, pre-submit IFSC branch lookup is usable — false under SurePass (Find IFSC is unapproved). */
  bankIfscLookup: boolean;
};

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

export type KycStatusResponse = { employeeId: string; kyc: KycStatus; capabilities: KycCapabilities };

// No employee_id sent -- a field-employee's subject always resolves to
// themselves server-side regardless of what's passed.
export async function getKycStatus(): Promise<KycStatusResponse> {
  const res = await apiClient.get<{ success: true; data: KycStatusResponse }>('/verification/status');
  return res.data.data;
}

export type PanVerifyInput = {
  pan: string;
  name_as_per_pan?: string;
  date_of_birth?: string;
  /**
   * Only meaningful when `capabilities.combinedPanAadhaar` is true. The raw
   * number is used once for a server-side comparison and never stored or
   * echoed back, masked or otherwise -- see PanVerifyScreen.tsx.
   */
  aadhaar_number?: string;
};
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
  /**
   * Present only under the combined-provider flow (`capabilities.
   * combinedPanAadhaar`). This is the ONLY way Aadhaar gets verified while
   * that provider is active -- there is no separate OTP step to fall back to.
   */
  aadhaar?: { verified: boolean; outcome: string; message: string };
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

