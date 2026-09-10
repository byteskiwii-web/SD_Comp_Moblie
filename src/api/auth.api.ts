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
  /**
   * The rostered shift, when the employee is on a template.
   *
   * NULL breakAllowanceMinutes means NO POLICY, never zero minutes -- an
   * employee on no template must not be told every break is an overrun.
   */
  shift: {
    code: string;
    name: string;
    shortBreakMinutes: number;
    shortBreakCount: number;
    lunchBreakMinutes: number;
    breakAllowanceMinutes: number | null;
  } | null;
  /** null means not asked yet; `undisclosed` means asked and declined. */
  gender: Gender | null;
  /** Contact details, not a link -- this person often has no account here. */
  deptManager: { name: string | null; email: string | null; phone: string | null } | null;

  /**
   * The reporting line, which is NOT deptManager.
   *
   * deptManager is a contact card for somebody who may have no account here.
   * These two are links to real employee records, so they carry an id an
   * escalation can follow, and they routinely name different people.
   *
   * directReports is [] rather than null when nobody reports to this person,
   * so a screen can map it without a guard.
   */
  reportingManager: Colleague | null;
  directReports: Colleague[];

  zoneCode: string | null;
  /** Joining kit. shirtSize is the employee's own; the kit fields are HR's. */
  shirtSize: string | null;
  /**
   * Whether the size has already been submitted.
   *
   * The size is a one-time answer: it drives a purchase order, and changing it
   * after the shirt is bought only makes the record disagree with the garment.
   * The server enforces it; this flag exists so the app can show the reason
   * instead of a selector that would be refused.
   */
  shirtSizeLocked: boolean;
  welcomeKitIssued: boolean;
  welcomeKitIssuedAt: string | null;
};

/** Somebody else on the roster, resolved to a name rather than a bare id. */
export type Colleague = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
/**
 * `undisclosed` is a CHOICE; null means nobody has asked yet. Keeping them
 * apart is what stops an unfilled record reading as a statement the employee
 * never made.
 */
export type Gender = 'male' | 'female' | 'other' | 'undisclosed';

export const GENDERS: Gender[] = ['male', 'female', 'other', 'undisclosed'];

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  undisclosed: 'Prefer not to say',
};

export type ShirtSize = (typeof SHIRT_SIZES)[number];

/**
 * Self-service edit of your own record.
 *
 * On /auth/me, not /users/me: the users router is gated at SITE scope, so a
 * field employee is refused there before any handler runs -- which is exactly
 * how this first shipped, and it returned 403 to the only people who need it.
 */
/**
 * Partial by design -- only what is sent is written, so setting a shirt size
 * does not blank the department manager. Explicit null CLEARS a field; omitting
 * it leaves it alone.
 */
export async function updateMyProfile(input: {
  shirt_size?: ShirtSize | null;
  dept_manager_name?: string | null;
  dept_manager_email?: string | null;
  dept_manager_phone?: string | null;
  gender?: Gender | null;
}) {
  const res = await apiClient.patch<{ success: true; data: unknown }>('/auth/me', input);
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
