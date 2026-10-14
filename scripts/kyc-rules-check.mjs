// Run: node scripts/kyc-rules-check.mjs
import assert from 'node:assert/strict';
import {
  PAN_REGEX, aadhaarProblem, isInputErrorCode, isInputOutcome, isValidAadhaar, verhoeffValid,
} from '../src/utils/kycRules.ts';

// Verhoeff: 236 -> check digit 3 and 12345 -> 1 are the standard published vectors.
assert.ok(verhoeffValid('2363') && verhoeffValid('123451'));
assert.ok(!verhoeffValid('2364') && !verhoeffValid('123415')); // wrong digit, swapped neighbours

// Build a valid 12-digit Aadhaar from an 11-digit stem by finding its check digit.
const stem = '23456789012';
const check = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => verhoeffValid(stem + d));
const valid = stem + check;
assert.ok(isValidAadhaar(valid));
const typo = valid.slice(0, 5) + String((Number(valid[5]) + 1) % 10) + valid.slice(6);
assert.equal(aadhaarProblem(typo), 'checksum');
assert.equal(aadhaarProblem('123456789012'), 'format'); // starts with 1
assert.equal(aadhaarProblem('23456789'), 'format');     // incomplete

assert.ok(PAN_REGEX.test('ABCPE1234F') && PAN_REGEX.test('AAACG1234Z'));
assert.ok(!PAN_REGEX.test('ABCDE1234F')); // D is not a holder type
assert.ok(!PAN_REGEX.test('ABCPE1234') && !PAN_REGEX.test('abcpe1234f'));

// input-vs-system split
for (const c of ['UPSTREAM_VALIDATION_REJECTED', 'VALIDATION_FAILED', 'BANK_IFSC_NOT_FOUND']) assert.ok(isInputErrorCode(c), c);
for (const c of ['UPSTREAM_AUTH_FAILED', 'UPSTREAM_QUOTA_OR_WALLET_EXHAUSTED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_RATE_LIMITED',
  'VERIFICATION_OUTCOME_UNKNOWN', 'QUOTA_EXHAUSTED', 'OTP_RATE_LIMITED', 'UNAUTHORIZED', undefined]) assert.ok(!isInputErrorCode(c), String(c));
for (const o of ['PAN_DETAILS_MISMATCH', 'PAN_NOT_FOUND', 'BANK_ACCOUNT_NOT_FOUND', 'AADHAAR_LINK_MISMATCH']) assert.ok(isInputOutcome(o), o);
for (const o of ['AADHAAR_NOT_LINKED', 'AADHAAR_LINK_UNCONFIRMED', 'AADHAAR_PENDING', 'AADHAAR_VERIFIED', undefined]) assert.ok(!isInputOutcome(o), String(o));

console.log('kyc rules ok');
