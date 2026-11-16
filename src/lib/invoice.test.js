import { describe, it, expect } from 'vitest';
import {
  roundCents, sumCents, invoiceTotal, balanceDue, applyPayment, statusFor, validatePayment, billableForClient,
  lessonRate, defaultDueDate, emailText, smsText, clipboardText, escapeHtml, printHtml, interpretSendResult, isOverdue,
  paymentSnapshot, mailtoHref, smsHref,
} from './invoice.js';

describe('rounding', () => {
  it('0.1 + 0.2 rounds to 0.3', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumCents([0.1, 0.2])).toBe(0.3);
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents('abc')).toBe(0);
  });
});

describe('invoiceTotal', () => {
  it('applies tax', () => {
    expect(invoiceTotal(100, 0)).toBe(100);
    expect(invoiceTotal(100, 7.5)).toBe(107.5);
    expect(invoiceTotal(33.33, 6.25)).toBe(35.41);
  });
});

describe('payments', () => {
  const inv = { id: 1, amount: 100, tax_rate: 5, total: 105, amount_paid: 0, status: 'sent' };
  it('partial then full', () => {
    const p1 = applyPayment(inv, 40);
    expect(p1).toMatchObject({ error: null, amount: 40, paid: 40, balance: 65, status: 'partial' });
    const after1 = { ...inv, amount_paid: 40, status: 'partial' };
    expect(balanceDue(after1)).toBe(65);
    const p2 = applyPayment(after1, balanceDue(after1));
    expect(p2).toMatchObject({ error: null, paid: 105, balance: 0, status: 'paid' });
  });
  it('rounds payment amounts to cents and handles float sums', () => {
    const i = { id: 2, total: 0.3, amount_paid: 0, status: 'sent' };
    const pays = [{ invoice_id: 2, amount: 0.1 }, { invoice_id: 2, amount: 0.2 }];
    expect(balanceDue(i, pays)).toBe(0);
    expect(applyPayment({ ...i, total: 10 }, 3.333).amount).toBe(3.33);
  });
  it('validates', () => {
    expect(validatePayment(0, 10)).toMatch(/greater/);
    expect(validatePayment(-5, 10)).toMatch(/greater/);
    expect(validatePayment('', 10)).toMatch(/Enter/);
    expect(validatePayment(10.01, 10)).toMatch(/exceed/);
    expect(validatePayment(10, 10)).toBeNull();
    expect(applyPayment(inv, 200).error).toMatch(/exceed/);
  });
  it('statusFor', () => {
    expect(statusFor(100, 0, 'draft')).toBe('draft');
    expect(statusFor(100, 0, 'partial')).toBe('sent');
    expect(statusFor(100, 50, 'sent')).toBe('partial');
    expect(statusFor(100, 100, 'partial')).toBe('paid');
    expect(statusFor(100, 50, 'void')).toBe('void');
  });
  it('overdue', () => {
    expect(isOverdue({ ...inv, due_date: '2020-01-01' }, '2026-01-01')).toBe(true);
    expect(isOverdue({ ...inv, due_date: '2020-01-01', status: 'draft' }, '2026-01-01')).toBe(false);
    expect(isOverdue({ ...inv, due_date: '2020-01-01', amount_paid: 105 }, '2026-01-01')).toBe(false);
  });
});

describe('billableForClient', () => {
  const students = [{ id: 10, client_id: 1 }, { id: 11, client_id: 1 }, { id: 20, client_id: 2 }];
  const lessons = [
    { id: 100, date: '2026-01-02', lesson_type: 'private', rate: null },
    { id: 101, date: '2026-01-01', lesson_type: 'group', rate: 40 },
    { id: 102, date: '2026-01-03', lesson_type: 'custom_1', rate: 0 },
  ];
  const bookings = [
    { id: 1, student_id: 10, lesson_id: 100, status: 'completed' },
    { id: 2, student_id: 11, lesson_id: 101, status: 'completed' },
    { id: 3, student_id: 10, lesson_id: 101, status: 'completed', invoice_id: 9 },
    { id: 4, student_id: 10, lesson_id: 102, status: 'cancelled', is_late_cancellation: true },
    { id: 5, student_id: 10, lesson_id: 102, status: 'cancelled', is_late_cancellation: false },
    { id: 6, student_id: 20, lesson_id: 100, status: 'completed' },
    { id: 7, student_id: 10, lesson_id: 100, status: 'confirmed' },
  ];
  const customTypes = [{ id: 'custom_1', name: 'Jumps', rate: 60 }];
  it('collects uninvoiced completed + late cancellations for the client only', () => {
    const r = billableForClient({ clientId: '1', students, bookings, lessons, customTypes });
    expect(r.completed.map((x) => x.booking.id)).toEqual([2, 1]);
    expect(r.late.map((x) => x.booking.id)).toEqual([4]);
    expect(r.amount).toBe(40 + 75 + 60);
  });
  it('empty client', () => {
    expect(billableForClient({ clientId: '', students, bookings, lessons })).toEqual({ completed: [], late: [], amount: 0 });
  });
  it('lessonRate fallback', () => {
    expect(lessonRate({ lesson_type: 'unknown' })).toBe(75);
  });
});

describe('dates', () => {
  it('due date +30 days', () => {
    expect(defaultDueDate(new Date(2026, 0, 15))).toBe('2026-02-14');
  });
});

describe('text bodies', () => {
  const invoice = {
    id: 7, amount: 100, tax_rate: 0, total: 100, amount_paid: 25, status: 'partial', due_date: '2026-03-01', notes: 'Jan lessons',
    payment_cash: true, payment_check: false, payment_venmo: '@coach', payment_paypal: '', payment_zelle: '', payment_cashapp: '$c',
  };
  const settings = { coach_name: 'Coach Kim', coach_email: 'k@x.com', coach_phone: '555' };
  it('email', () => {
    const { subject, body } = emailText({ invoice, client: { name: 'Pat' }, settings });
    expect(subject).toBe('Invoice from Coach Kim - $75.00');
    expect(body).toContain('Hi Pat,');
    expect(body).toContain('Amount Due: $75.00');
    expect(body).toContain('paid $25.00');
    expect(body).toContain('Payment Methods:\nCash\nVenmo: @coach\nCash App: $c');
    expect(body).toContain('Notes: Jan lessons');
    expect(mailtoHref('a@b.com', { subject, body })).toMatch(/^mailto:a%40b\.com\?subject=/);
  });
  it('sms', () => {
    const t = smsText({ invoice, settings });
    expect(t.split('\n')[0]).toBe('Invoice from Coach Kim: $75.00');
    expect(t).toContain('Venmo: @coach, CashApp: $c');
    expect(t).not.toContain('Cash\n');
    expect(smsHref('(555) 123-4567', 'hi')).toBe('sms:5551234567?body=hi');
  });
  it('clipboard falls back to profile name', () => {
    const t = clipboardText({ invoice, client: null, settings: {}, profile: { name: 'P' } });
    expect(t.startsWith('Invoice from P\nTo: Client')).toBe(true);
  });
  it('print escapes user text', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
    const html = printHtml({ invoice: { ...invoice, notes: '<script>x</script>' }, client: { name: '<img onerror=1>' }, settings, items: [{ date: '2026-01-01', description: '<i>', rate: 5 }] });
    expect(html).not.toContain('<script>x');
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;i&gt;');
    expect(html).toContain('Balance Due');
  });
  it('payment snapshot', () => {
    expect(paymentSnapshot({ payment_cash: true, payment_venmo: '@v' })).toEqual({
      payment_cash: true, payment_check: false, payment_venmo: '@v', payment_paypal: '', payment_zelle: '', payment_cashapp: '',
    });
  });
});

describe('interpretSendResult', () => {
  it('handles shapes', () => {
    expect(interpretSendResult({ ok: true })).toMatchObject({ ok: true });
    expect(interpretSendResult(null, { error: 'email_not_configured' })).toMatchObject({ ok: false, notConfigured: true });
    expect(interpretSendResult({ code: 'email_not_configured' })).toMatchObject({ notConfigured: true });
    expect(interpretSendResult(null, { error: 'boom' })).toMatchObject({ ok: false, notConfigured: false, message: 'boom' });
  });
});
