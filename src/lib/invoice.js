// Pure invoice / payment math and text formatting (BILLING).
import { DEFAULT_LESSON_TYPES } from './constants.js';
import { formatMoney, formatDate, toISODate } from './format.js';

/** Round a money value to cents (avoids 0.1 + 0.2 = 0.30000000000000004). */
export const roundCents = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON * Math.sign(x)) * 100) / 100;
};

/** Sum money values, rounded to cents. */
export const sumCents = (vals) => roundCents(vals.reduce((s, v) => s + (Number(v) || 0), 0));

/** Lesson type by id: custom types first, then built-in, else the first built-in (legacy behavior). */
export const lessonTypeFor = (id, customTypes = []) =>
  (customTypes || []).find((t) => t.id === id) || DEFAULT_LESSON_TYPES.find((t) => t.id === id) || DEFAULT_LESSON_TYPES[0];

/** The rate charged for a lesson: lesson.rate, else its lesson type's rate. */
export const lessonRate = (lesson, customTypes = []) => {
  if (!lesson) return 0;
  const r = Number(lesson.rate);
  if (lesson.rate != null && lesson.rate !== '' && Number.isFinite(r) && r > 0) return roundCents(r);
  return roundCents(Number(lessonTypeFor(lesson.lesson_type, customTypes).rate) || 0);
};

/**
 * Uninvoiced billable bookings for a client: completed bookings and late cancellations
 * (status cancelled + is_late_cancellation) with no invoice_id, for any of the client's students.
 * Returns { completed: [{booking, lesson, student, rate}], late: [...], amount }.
 */
export const billableForClient = ({ clientId, students = [], bookings = [], lessons = [], customTypes = [] }) => {
  if (clientId == null || clientId === '') return { completed: [], late: [], amount: 0 };
  const cid = Number(clientId);
  const studentById = new Map(students.filter((s) => Number(s.client_id) === cid).map((s) => [s.id, s]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const rows = (pred) =>
    bookings
      .filter((b) => studentById.has(b.student_id) && !b.invoice_id && b.lesson_id && lessonById.has(b.lesson_id) && pred(b))
      .map((b) => {
        const lesson = lessonById.get(b.lesson_id);
        return { booking: b, lesson, student: studentById.get(b.student_id), rate: lessonRate(lesson, customTypes) };
      })
      .sort((a, b) => String(a.lesson.date).localeCompare(String(b.lesson.date)));
  const completed = rows((b) => b.status === 'completed');
  const late = rows((b) => b.status === 'cancelled' && b.is_late_cancellation);
  const amount = sumCents([...completed, ...late].map((r) => r.rate));
  return { completed, late, amount };
};

/** total = amount * (1 + tax/100), rounded to cents. */
export const invoiceTotal = (amount, taxRate = 0) =>
  roundCents((Number(amount) || 0) * (1 + (Number(taxRate) || 0) / 100));

/** Total of an invoice row (falls back to amount, as the legacy UI did). */
export const totalOf = (inv) => roundCents(inv?.total != null ? inv.total : inv?.amount || 0);

/** Amount paid: payments recorded for the invoice if provided, else invoices.amount_paid (kept by the DB trigger). */
export const paidOf = (inv, payments = null) => {
  if (Array.isArray(payments)) {
    const mine = payments.filter((p) => p.invoice_id === inv.id);
    if (mine.length) return sumCents(mine.map((p) => p.amount));
  }
  return roundCents(inv?.amount_paid || 0);
};

/** Remaining balance (never negative). */
export const balanceDue = (inv, payments = null) => Math.max(0, roundCents(totalOf(inv) - paidOf(inv, payments)));

/** Status implied by payments: void stays void; fully paid => paid; some paid => partial; else keep draft/sent. */
export const statusFor = (total, paid, current = 'draft') => {
  if (current === 'void') return 'void';
  const t = roundCents(total);
  const p = roundCents(paid);
  if (p > 0 && p >= t) return 'paid';
  if (p > 0) return 'partial';
  return current === 'paid' || current === 'partial' ? 'sent' : current || 'draft';
};

/** Validate a payment amount against the balance. Returns an error message or null. */
export const validatePayment = (amount, balance) => {
  const a = roundCents(amount);
  if (amount === '' || amount == null || !Number.isFinite(Number(amount))) return 'Enter a payment amount';
  if (a <= 0) return 'Payment amount must be greater than $0.00';
  if (a > roundCents(balance)) return `Payment cannot exceed the balance due (${formatMoney(balance)})`;
  return null;
};

/** Preview the effect of a payment. Returns { error, amount, paid, balance, status }. */
export const applyPayment = (inv, amount, payments = null) => {
  const total = totalOf(inv);
  const paidBefore = paidOf(inv, payments);
  const before = Math.max(0, roundCents(total - paidBefore));
  const error = validatePayment(amount, before);
  if (error) return { error, amount: 0, paid: paidBefore, balance: before, status: statusFor(total, paidBefore, inv.status) };
  const a = roundCents(amount);
  const paid = roundCents(paidBefore + a);
  return { error: null, amount: a, paid, balance: Math.max(0, roundCents(total - paid)), status: statusFor(total, paid, inv.status) };
};

/** Due date default: today + 30 days (YYYY-MM-DD). */
export const defaultDueDate = (now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  return toISODate(d);
};

/** Overdue = has a balance, not draft/void/paid, and due date before today. */
export const isOverdue = (inv, today = toISODate(new Date()), payments = null) =>
  !!inv.due_date && ['sent', 'partial'].includes(inv.status) && String(inv.due_date).slice(0, 10) < today && balanceDue(inv, payments) > 0;

/** Payment-method lines from an invoice's snapshot. */
export const paymentMethodLines = (inv, { includeOffline = true, cashAppLabel = 'Cash App' } = {}) => {
  const x = [];
  if (includeOffline && inv.payment_cash) x.push('Cash');
  if (includeOffline && inv.payment_check) x.push('Check');
  if (inv.payment_venmo) x.push('Venmo: ' + inv.payment_venmo);
  if (inv.payment_paypal) x.push('PayPal: ' + inv.payment_paypal);
  if (inv.payment_zelle) x.push('Zelle: ' + inv.payment_zelle);
  if (inv.payment_cashapp) x.push(cashAppLabel + ': ' + inv.payment_cashapp);
  return x;
};

/** Snapshot of the coach's payment settings for a new invoice. */
export const paymentSnapshot = (s = {}) => ({
  payment_cash: !!s.payment_cash,
  payment_check: !!s.payment_check,
  payment_venmo: s.payment_venmo || '',
  payment_paypal: s.payment_paypal || '',
  payment_zelle: s.payment_zelle || '',
  payment_cashapp: s.payment_cashapp || '',
});

export const coachNameOf = (settings, profile) => settings?.coach_name || profile?.name || 'Your Coach';
const dueText = (inv) => (inv.due_date ? formatDate(inv.due_date) : 'Upon receipt');

/** Amount due line(s): balance, plus total/paid when partially paid. */
const amountLines = (inv, payments) => {
  const paid = paidOf(inv, payments);
  const lines = [`Amount Due: ${formatMoney(balanceDue(inv, payments))}`];
  if (paid > 0) lines.push(`(Invoice total ${formatMoney(totalOf(inv))}, paid ${formatMoney(paid)})`);
  return lines;
};

/** Email (mailto fallback) subject + body — legacy wording. */
export const emailText = ({ invoice, client, settings, profile, payments = null }) => {
  const coach = coachNameOf(settings, profile);
  const methods = paymentMethodLines(invoice);
  const subject = `Invoice from ${coach} - ${formatMoney(balanceDue(invoice, payments))}`;
  const body = [
    `Hi ${client?.name || ''},`, '', 'Please find your invoice details below:', '',
    ...amountLines(invoice, payments),
    `Due Date: ${dueText(invoice)}`,
    invoice.notes ? `Notes: ${invoice.notes}` : '', '',
    methods.length ? `Payment Methods:\n${methods.join('\n')}` : '', '',
    'Thank you!', coach,
  ].filter(Boolean).join('\n');
  return { subject, body };
};

export const mailtoHref = (to, { subject, body }) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** SMS body — legacy wording (online methods only, comma-joined). */
export const smsText = ({ invoice, settings, profile, payments = null }) => {
  const methods = paymentMethodLines(invoice, { includeOffline: false, cashAppLabel: 'CashApp' });
  return [
    `Invoice from ${coachNameOf(settings, profile)}: ${formatMoney(balanceDue(invoice, payments))}`,
    `Due: ${dueText(invoice)}`,
    methods.length ? methods.join(', ') : '',
    'Thank you!',
  ].filter(Boolean).join('\n');
};

export const smsHref = (phone, body) => `sms:${String(phone || '').replace(/\D/g, '')}?body=${encodeURIComponent(body)}`;

/** Clipboard text — legacy wording. */
export const clipboardText = ({ invoice, client, settings, profile, payments = null }) => {
  const coach = coachNameOf(settings, profile);
  const methods = paymentMethodLines(invoice);
  return [
    `Invoice from ${coach}`, `To: ${client?.name || 'Client'}`, '',
    ...amountLines(invoice, payments),
    `Due Date: ${dueText(invoice)}`,
    invoice.notes ? `Notes: ${invoice.notes}` : '', '',
    methods.length ? `Payment Methods:\n${methods.join('\n')}` : '', '',
    'Thank you!', coach, settings?.coach_email || '', settings?.coach_phone || '',
  ].filter(Boolean).join('\n');
};

export const escapeHtml = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Printable HTML document for an invoice. All interpolated user text is escaped. */
export const printHtml = ({ invoice, client, settings, profile, items = [], payments = [] }) => {
  const e = escapeHtml;
  const coach = coachNameOf(settings, profile);
  const mine = (payments || []).filter((p) => p.invoice_id === invoice.id);
  const paid = paidOf(invoice, payments);
  const methods = paymentMethodLines(invoice);
  const itemRows = items.map((it) => `<tr><td>${e(formatDate(it.date))}</td><td>${e(it.description)}</td><td class="r">${e(formatMoney(it.rate))}</td></tr>`).join('');
  const payRows = mine.map((p) => `<tr><td>${e(formatDate(p.paid_at))}</td><td>${e(p.method || '')}${p.reference ? ' #' + e(p.reference) : ''}</td><td class="r">${e(formatMoney(p.amount))}</td></tr>`).join('');
  const tax = Number(invoice.tax_rate) || 0;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice #${e(invoice.id)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:760px;margin:24px auto;padding:0 16px}
h1{color:#7c3aed;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}
.r{text-align:right}.muted{color:#64748b;font-size:13px}.tot td{font-weight:600}.grid{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}</style></head><body>
<div class="grid"><div><h1>${e(coach)}</h1><div class="muted">${[settings?.coach_address, settings?.coach_email, settings?.coach_phone].filter(Boolean).map(e).join('<br>')}</div></div>
<div><h2 style="margin:0">INVOICE #${e(invoice.id)}</h2><div class="muted">Date: ${e(formatDate(invoice.created_at))}<br>Due: ${e(dueText(invoice))}<br>Status: ${e(invoice.status)}</div></div></div>
<h3>Bill To</h3><div>${e(client?.name || 'Client')}${client?.address ? '<br>' + e(client.address) : ''}${client?.city || client?.state || client?.zip ? '<br>' + e([client.city, client.state].filter(Boolean).join(', ') + ' ' + (client.zip || '')) : ''}${client?.email ? '<br>' + e(client.email) : ''}</div>
${items.length ? `<table><thead><tr><th>Date</th><th>Description</th><th class="r">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>` : ''}
<table><tbody><tr><td>Subtotal</td><td class="r">${e(formatMoney(invoice.amount))}</td></tr>
${tax ? `<tr><td>Tax (${e(tax)}%)</td><td class="r">${e(formatMoney(totalOf(invoice) - (Number(invoice.amount) || 0)))}</td></tr>` : ''}
<tr class="tot"><td>Total</td><td class="r">${e(formatMoney(totalOf(invoice)))}</td></tr>
${paid > 0 ? `<tr><td>Paid</td><td class="r">${e(formatMoney(paid))}</td></tr>` : ''}
<tr class="tot"><td>Balance Due</td><td class="r">${e(formatMoney(balanceDue(invoice, payments)))}</td></tr></tbody></table>
${payRows ? `<h3>Payments</h3><table><tbody>${payRows}</tbody></table>` : ''}
${invoice.notes ? `<h3>Notes</h3><div>${e(invoice.notes).replace(/\n/g, '<br>')}</div>` : ''}
${methods.length ? `<h3>Payment Methods</h3><div>${methods.map(e).join('<br>')}</div>` : ''}
<p style="margin-top:24px">Thank you!</p></body></html>`;
};

/** Interpret a send-invoice edge function result. Returns { ok, notConfigured, message }. */
export const interpretSendResult = (data, errorBody) => {
  const body = errorBody || data || {};
  const code = body?.code || body?.error;
  if (code === 'email_not_configured') return { ok: false, notConfigured: true, message: body.message || 'Email sending is not configured' };
  if (errorBody || body?.error) return { ok: false, notConfigured: false, message: body.message || body.error || 'Send failed' };
  return { ok: true, notConfigured: false, message: '' };
};
