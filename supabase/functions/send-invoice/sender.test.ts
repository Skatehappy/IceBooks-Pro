import { describe, it, expect } from 'vitest';
import {
  buildFromHeader, sanitizeDisplayName, pickReplyTo, isPlainEmail, toCents, formatCents,
  DEFAULT_FROM_ADDRESS, stripHeaderUnsafe,
} from './sender.ts';

describe('sanitizeDisplayName / buildFromHeader', () => {
  it('builds the expected From header', () => {
    expect(buildFromHeader('Coach Jane')).toBe('Coach Jane <invoices@mail.sk8happy.com>');
  });

  it('blocks CRLF header injection', () => {
    const h = buildFromHeader('Evil\r\nBcc: x@y.com');
    expect(h).not.toMatch(/[\r\n]/);
    // ':' / '@' / '.' remain, so the name is quoted and cannot become an address
    expect(h).toBe('"Evil Bcc: x@y.com" <invoices@mail.sk8happy.com>');
  });

  it('strips other control chars and unicode line separators', () => {
    expect(sanitizeDisplayName('A\u0000B\tC D\u0085E')).toBe('A B C D E');
  });

  it('removes quotes, angle brackets, backslash, comma, semicolon (address-list injection)', () => {
    expect(sanitizeDisplayName('"Jane" <a@b.com>, Bob; \\x')).toBe('Jane a@b.com Bob x');
    expect(buildFromHeader('Smith, John')).toBe('Smith John <invoices@mail.sk8happy.com>');
    expect(buildFromHeader('Jane <evil@x.com>')).toBe('"Jane evil@x.com" <invoices@mail.sk8happy.com>');
  });

  it('quotes names with remaining specials', () => {
    expect(buildFromHeader('J. Smith')).toBe('"J. Smith" <invoices@mail.sk8happy.com>');
    expect(buildFromHeader('Jane (Skate)')).toBe('"Jane (Skate)" <invoices@mail.sk8happy.com>');
  });

  it('keeps unicode names', () => {
    expect(buildFromHeader('Zoë Müller 滑冰')).toBe('Zoë Müller 滑冰 <invoices@mail.sk8happy.com>');
  });

  it('falls back to IceBooks when empty or nothing survives', () => {
    expect(buildFromHeader('')).toBe('IceBooks <invoices@mail.sk8happy.com>');
    expect(buildFromHeader(null)).toBe('IceBooks <invoices@mail.sk8happy.com>');
    expect(buildFromHeader('  "<>,;\\ \r\n ')).toBe('IceBooks <invoices@mail.sk8happy.com>');
  });

  it('collapses whitespace and caps long names at 60 code points', () => {
    expect(sanitizeDisplayName('  a   b  ')).toBe('a b');
    const long = sanitizeDisplayName('x'.repeat(200));
    expect(long).toBe('x'.repeat(60));
    const emoji = sanitizeDisplayName('😀'.repeat(70));
    expect(Array.from(emoji)).toHaveLength(60);
    expect(emoji).toBe('😀'.repeat(60)); // no split surrogate
  });

  it('uses env address only when it is a plain email', () => {
    expect(buildFromHeader('A', 'billing@example.org')).toBe('A <billing@example.org>');
    expect(buildFromHeader('A', undefined)).toBe(`A <${DEFAULT_FROM_ADDRESS}>`);
    expect(buildFromHeader('A', 'x@y.com>\r\nBcc: z@w.com')).toBe(`A <${DEFAULT_FROM_ADDRESS}>`);
  });
});

describe('pickReplyTo', () => {
  it('uses settings email first', () => {
    expect(pickReplyTo('coach@x.com', 'p@x.com', 'u@x.com')).toBe('coach@x.com');
    expect(pickReplyTo('  coach@x.com ', null)).toBe('coach@x.com');
  });
  it('rejects garbage and falls through / omits', () => {
    expect(pickReplyTo('a@x.com\r\nBcc: z@w.com', 'p@x.com')).toBe('p@x.com');
    expect(pickReplyTo('a@x.com, b@y.com')).toBeUndefined();
    expect(pickReplyTo('Jane <a@x.com>')).toBeUndefined();
    expect(pickReplyTo('not-an-email', '', null, undefined)).toBeUndefined();
    expect(pickReplyTo('a@@x.com')).toBeUndefined();
    expect(pickReplyTo('a@x')).toBeUndefined();
  });
  it('isPlainEmail accepts normal addresses', () => {
    expect(isPlainEmail('first.last+tag@sub.example.co.uk')).toBe(true);
  });
});

describe('money in cents', () => {
  it('no float drift', () => {
    expect(toCents('0.29')).toBe(29);
    expect(toCents(1.1) - toCents(0.3)).toBe(80);
    expect(formatCents(toCents(100.1) - toCents(33.37))).toBe('$66.73');
    expect(formatCents(toCents(0.3) - toCents(0.1))).toBe('$0.20');
  });
  it('formats', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(123456)).toBe('$1234.56');
    expect(formatCents(-250)).toBe('-$2.50');
    expect(toCents('abc')).toBe(0);
    expect(toCents(null)).toBe(0);
  });
});

describe('stripHeaderUnsafe', () => {
  it('removes CR/LF from subject text', () => {
    expect(stripHeaderUnsafe('Invoice #1 from A\r\nBcc: x@y.com')).toBe('Invoice #1 from A Bcc: x@y.com');
  });
});
