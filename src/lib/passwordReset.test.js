import { describe, it, expect } from 'vitest';
import { validateNewPassword, isRateLimitError, isRecoveryHash, MIN_PASSWORD_LENGTH, RESET_SENT_MESSAGE } from './passwordReset.js';

describe('validateNewPassword', () => {
  it('rejects passwords shorter than the minimum', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(validateNewPassword('', '')).toMatch(/at least 6/);
    expect(validateNewPassword('12345', '12345')).toMatch(/at least 6/);
    expect(validateNewPassword(undefined, undefined)).toMatch(/at least 6/);
  });
  it('rejects mismatched confirmation', () => {
    expect(validateNewPassword('abcdef', 'abcdeg')).toBe('Passwords do not match.');
    expect(validateNewPassword('abcdef', '')).toBe('Passwords do not match.');
  });
  it('accepts a matching password at or above the minimum', () => {
    expect(validateNewPassword('abcdef', 'abcdef')).toBe('');
    expect(validateNewPassword('a much longer passphrase', 'a much longer passphrase')).toBe('');
  });
  it('length is checked before match', () => {
    expect(validateNewPassword('abc', 'xyz')).toMatch(/at least 6/);
  });
});

describe('isRateLimitError', () => {
  it('detects 429 / rate-limit codes / messages', () => {
    expect(isRateLimitError({ status: 429, message: 'x' })).toBe(true);
    expect(isRateLimitError({ status: 400, code: 'over_email_send_rate_limit' })).toBe(true);
    expect(isRateLimitError({ code: 'over_request_rate_limit' })).toBe(true);
    expect(isRateLimitError({ message: 'Email rate limit exceeded' })).toBe(true);
  });
  it('does not flag other errors (they stay behind the neutral message)', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError({ status: 400, code: 'user_not_found', message: 'User not found' })).toBe(false);
    expect(isRateLimitError({ status: 500, message: 'Error sending recovery email' })).toBe(false);
  });
  it('neutral message text', () => {
    expect(RESET_SENT_MESSAGE).toBe('If that email has an account, a reset link is on its way.');
  });
});

describe('isRecoveryHash', () => {
  it('detects an implicit-flow recovery landing', () => {
    expect(isRecoveryHash('#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery')).toBe(true);
  });
  it('ignores signup confirmations, errors and empty hashes', () => {
    expect(isRecoveryHash('#access_token=abc&type=signup')).toBe(false);
    expect(isRecoveryHash('#error=access_denied&error_code=otp_expired&type=recovery')).toBe(false);
    expect(isRecoveryHash('#')).toBe(false);
    expect(isRecoveryHash('')).toBe(false);
    expect(isRecoveryHash(undefined)).toBe(false);
  });
});
