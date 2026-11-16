// Pure helpers for send-invoice (no Deno / network deps so they are unit-testable under vitest).

export const DEFAULT_FROM_ADDRESS = 'invoices@mail.sk8happy.com';
export const DEFAULT_DISPLAY_NAME = 'IceBooks';
const MAX_DISPLAY_NAME = 60;

// One plain addr-spec: no whitespace/CR/LF, no list or angle/quote/comment specials, exactly one '@', dotted domain.
const PLAIN_EMAIL = /^[^\s@<>,;:"'()[\]\\]+@[^\s@<>,;:"'()[\]\\.]+(\.[^\s@<>,;:"'()[\]\\.]+)+$/;

export function isPlainEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && PLAIN_EMAIL.test(v);
}

/** First candidate that is a single plain email address (trimmed), else undefined (omit Reply-To). */
export function pickReplyTo(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    const v = typeof c === 'string' ? c.trim() : c;
    if (isPlainEmail(v)) return v;
  }
  return undefined;
}

/** Strip anything that could break out of a header: control chars (incl. CR/LF/TAB), Unicode line/para separators. */
export function stripHeaderUnsafe(s: unknown): string {
  return String(s ?? '').replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Display name safe for a From header: no injection, no address-list specials, collapsed, capped. */
export function sanitizeDisplayName(name: unknown): string {
  let s = stripHeaderUnsafe(name).replace(/["<>\\,;]/g, '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(s); // cap by code point so surrogate pairs are not split
  if (chars.length > MAX_DISPLAY_NAME) s = chars.slice(0, MAX_DISPLAY_NAME).join('').trim();
  return s || DEFAULT_DISPLAY_NAME;
}

/** `Display Name <address>`; name is quoted when it still contains RFC 5322 specials. */
export function buildFromHeader(name: unknown, address?: unknown): string {
  const addr = typeof address === 'string' && isPlainEmail(address.trim()) ? address.trim() : DEFAULT_FROM_ADDRESS;
  const display = sanitizeDisplayName(name);
  const needsQuote = /[()[\]:@.]/.test(display);
  return `${needsQuote ? `"${display}"` : display} <${addr}>`;
}

/** Money value (number or numeric string) -> integer cents, no float drift. */
export function toCents(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Integer cents -> "$1234.56" (same format as before, no thousands separator), exact to the cent. */
export function formatCents(cents: number): string {
  const c = Math.round(cents);
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
