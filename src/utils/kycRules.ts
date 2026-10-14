/**
 * KYC input rules and the input-vs-system error split. Pure on purpose (no
 * React Native imports) so scripts/kyc-rules-check.ts can run it under plain Node.
 */

// 4th character is the holder type: A AOP, B BOI, C company, F firm/LLP,
// G government, H HUF, L local authority, J artificial juridical person,
// P individual, T trust.
export const PAN_REGEX = /^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$/;

// First digit is never 0 or 1; the 12th digit is a Verhoeff check digit.
export const AADHAAR_REGEX = /^[2-9][0-9]{11}$/;

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
  return c === 0;
}

export const isValidAadhaar = (v: string) => AADHAAR_REGEX.test(v) && verhoeffValid(v);

/** Why an Aadhaar number is not acceptable, or null if it is. 'checksum' = well-formed but a digit is wrong. */
export function aadhaarProblem(v: string): 'format' | 'checksum' | null {
  if (!AADHAAR_REGEX.test(v)) return 'format';
  return verhoeffValid(v) ? null : 'checksum';
}

/**
 * Errors that are about what the person TYPED, so resending the same values
 * can only fail the same way. An allowlist on purpose: anything not listed
 * (401, 5xx, wallet/subscription exhausted, rate limits, network) is treated
 * as a system problem and never locks the form.
 */
const INPUT_ERROR_CODES = new Set(['VALIDATION_FAILED', 'UPSTREAM_VALIDATION_REJECTED', 'BANK_IFSC_NOT_FOUND']);

/**
 * Business outcomes (HTTP 200, verified:false) that are about the details
 * entered. Deliberately absent: AADHAAR_NOT_LINKED (fixed on the income-tax
 * site, then the same details work) and AADHAAR_LINK_UNCONFIRMED (the check
 * itself could not conclude).
 */
const INPUT_OUTCOMES = new Set([
  'PAN_NOT_FOUND', 'PAN_NOT_VALID', 'PAN_DETAILS_MISMATCH', 'AADHAAR_INVALID', 'AADHAAR_LINK_MISMATCH',
  'BANK_ACCOUNT_NOT_FOUND', 'BANK_IFSC_INVALID', 'BANK_ACCOUNT_BLOCKED', 'BANK_ACCOUNT_NRE', 'BANK_IMPS_UNSUPPORTED',
]);

export const isInputErrorCode = (code?: string | null) => !!code && INPUT_ERROR_CODES.has(code);
export const isInputOutcome = (outcome?: string | null) => !!outcome && INPUT_OUTCOMES.has(outcome);
