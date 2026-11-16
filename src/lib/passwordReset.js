/** Minimum password length (matches the Supabase project default and the sign-up form). */
export const MIN_PASSWORD_LENGTH = 6;

/** Neutral reset-request message: shown whether or not the email has an account (no enumeration). */
export const RESET_SENT_MESSAGE = 'If that email has an account, a reset link is on its way.';

/**
 * Validate a new password + confirmation. Returns an error message, or '' when valid.
 * @param {string} password
 * @param {string} confirm
 */
export function validateNewPassword(password, confirm) {
  const p = password || '';
  if (p.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (p !== (confirm || '')) return 'Passwords do not match.';
  return '';
}

/**
 * True when a Supabase auth error is a rate limit (the only reset-request error surfaced to the user;
 * anything else is swallowed behind the neutral message so it can't reveal whether an account exists).
 * @param {{status?: number, code?: string, message?: string} | null | undefined} err
 */
export function isRateLimitError(err) {
  if (!err) return false;
  if (err.status === 429) return true;
  if (typeof err.code === 'string' && /rate_limit/i.test(err.code)) return true;
  return typeof err.message === 'string' && /rate limit|too many requests/i.test(err.message);
}

/**
 * True when a URL hash is a Supabase implicit-flow recovery landing (#access_token=...&type=recovery).
 * Read before supabase-js clears the hash so the reset screen wins from the first render.
 * @param {string} hash  window.location.hash
 */
export function isRecoveryHash(hash) {
  if (!hash || hash.length < 2) return false;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('type') === 'recovery' && params.has('access_token');
}
