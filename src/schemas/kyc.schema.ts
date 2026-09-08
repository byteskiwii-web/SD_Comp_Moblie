import { z } from 'zod';
import { OTP_LENGTH } from '../constants/config';

export const panVerifySchema = z.object({
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { error: 'Enter a valid PAN (e.g. ABCDE1234F)' }),
  // The backend's own schema marks both of these optional, but the live
  // provider rejects a PAN_VERIFY call outright if either is empty --
  // required here so that mismatch is never rediscovered as a failed request.
  name_as_per_pan: z.string().trim().min(1, { error: 'Enter the name exactly as printed on the PAN card' }),
  date_of_birth: z
    .string()
    .trim()
    .regex(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)[0-9]{2}$/, {
      error: 'Enter date of birth as DD/MM/YYYY',
    }),
  consentAccepted: z.literal(true, { error: 'You must give consent to proceed' }),
});
export type PanVerifyFormInput = z.infer<typeof panVerifySchema>;

// First digit 2-9, matching the backend's exact pattern (never 0 or 1) so
// client-side feedback matches what the server will actually accept.
export const aadhaarOtpRequestSchema = z.object({
  aadhaar_number: z.string().trim().regex(/^[2-9][0-9]{11}$/, { error: 'Enter a valid 12-digit Aadhaar number' }),
  consentAccepted: z.literal(true, { error: 'You must give consent to proceed' }),
});
export type AadhaarOtpRequestFormInput = z.infer<typeof aadhaarOtpRequestSchema>;

export const aadhaarOtpVerifySchema = z.object({
  otp: z.string().length(OTP_LENGTH, { error: `Enter the ${OTP_LENGTH}-digit code` }),
});
export type AadhaarOtpVerifyFormInput = z.infer<typeof aadhaarOtpVerifySchema>;

/**
 * Bank account. Patterns match the server's own (`verification.schema.js`)
 * exactly, so a rejection happens here rather than after a billable call.
 *
 * The confirm field has no server counterpart and is not sent. It exists
 * because a mistyped account number is not a validation error — it is a valid
 * account number belonging to somebody else, which no pattern can catch and
 * which, in penny-drop mode, means a rupee lands in a stranger's account.
 */
export const bankVerifySchema = z
  .object({
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, { error: 'Enter a valid IFSC (e.g. HDFC0001234)' }),
    account_number: z
      .string()
      .trim()
      .regex(/^[0-9]{6,18}$/, { error: 'Account number must be 6 to 18 digits' }),
    confirm_account_number: z.string().trim(),
    name: z.string().trim().optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^[6-9][0-9]{9}$/, { error: 'Enter a 10-digit Indian mobile number' })
      .optional()
      .or(z.literal('')),
  })
  .refine((v) => v.account_number === v.confirm_account_number, {
    error: 'The account numbers do not match',
    path: ['confirm_account_number'],
  });
export type BankVerifyFormInput = z.infer<typeof bankVerifySchema>;
