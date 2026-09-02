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
