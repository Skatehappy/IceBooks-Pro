// Pure report logic: period presets, P&L, previous-period comparison, CSV rows, printable HTML.
// All dates are LOCAL 'YYYY-MM-DD' strings (the old app used toISOString(), which shifted dates by a day
// for anyone west/east of UTC).
import { toISODate, parseLocalDate, formatMoney } from './format.js';
import { round2, rowAmount, entryTypeOf } from './mileage.js';

export { round2 };

const num = (v) => Number(v) || 0;

export const PERIOD_PRESETS = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'last_quarter', label: 'Last Quarter' },
  { id: 'ytd', label: 'YTD' },
  { id: 'last_year', label: 'Last Year' },
];

const d = (y, m, day) => toISODate(new Date(y, m, day));

/** {start,end} for a preset relative to `today` (local). Unknown preset -> null (custom). */
export const getPresetRange = (preset, today = new Date()) => {
  const y = today.getFullYear();
  const m = today.getMonth();
  const q = Math.floor(m / 3) * 3;
  switch (preset) {
    case 'this_month': return { start: d(y, m, 1), end: d(y, m + 1, 0) };
    case 'last_month': return { start: d(y, m - 1, 1), end: d(y, m, 0) };
    case 'this_quarter': return { start: d(y, q, 1), end: d(y, q + 3, 0) };
    case 'last_quarter': return { start: d(y, q - 3, 1), end: d(y, q, 0) };
    case 'ytd': return { start: d(y, 0, 1), end: toISODate(today) };
    case 'last_year': return { start: d(y - 1, 0, 1), end: d(y - 1, 11, 31) };
    default: return null;
  }
};

/** Default report range (as the old app): first of this month through today. */
export const defaultRange = (today = new Date()) => ({ start: d(today.getFullYear(), today.getMonth(), 1), end: toISODate(today) });

/** Which preset (if any) a range matches, for highlighting the active button. */
export const matchPreset = (range, today = new Date()) =>
  PERIOD_PRESETS.find((p) => {
    const r = getPresetRange(p.id, today);
    return r.start === range.start && r.end === range.end;
  })?.id || 'custom';

const DAY = 86400000;
/** Whole days between two local date strings (DST-safe). */
const daysBetween = (a, b) => {
  const x = parseLocalDate(a);
  const y = parseLocalDate(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / DAY);
};

/**
 * The comparison period immediately before `range`.
 * - Whole calendar months (start = 1st, end = last day of a month): the same number of whole months before it
 *   (so "This Quarter" compares to last quarter, "Last Year" to the year before, a month to the previous month).
 * - Otherwise: the same number of days ending the day before `start`.
 */
export const previousPeriod = (range) => {
  const s = parseLocalDate(range.start);
  const e = parseLocalDate(range.end);
  const endIsMonthEnd = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1).getDate() === 1;
  if (s.getDate() === 1 && endIsMonthEnd && e >= s) {
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
    return { start: d(s.getFullYear(), s.getMonth() - months, 1), end: d(s.getFullYear(), s.getMonth(), 0) };
  }
  const len = Math.max(0, daysBetween(range.start, range.end)) + 1;
  return {
    start: d(s.getFullYear(), s.getMonth(), s.getDate() - len),
    end: d(s.getFullYear(), s.getMonth(), s.getDate() - 1),
  };
};

/** Local YYYY-MM-DD of a date or timestamptz string. Plain dates pass through unshifted. */
export const localDay = (v) => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const x = new Date(s);
  return Number.isNaN(x.getTime()) ? s.slice(0, 10) : toISODate(x);
};

export const inRange = (day, range) => !!day && day >= range.start && day <= range.end;

const VEHICLE_RE = /\b(vehicles?|gas|gasoline|fuel|cars?|auto|autos|automobile|automotive)\b/i;
/** Expense categories treated as actual vehicle costs (old: vehicle/gas/fuel/car/auto substring match). */
export const isVehicleCategory = (cat) => !!cat && VEHICLE_RE.test(cat);

/** 'standard' | 'actual' from settings.vehicle_expense_method. */
export const vehicleMethodOf = (settings) => (settings?.vehicle_expense_method === 'actual' ? 'actual' : 'standard');

const invoiceTotal = (inv) => num(inv.total != null && inv.total !== '' ? inv.total : inv.amount);

/**
 * Profit & loss for a range.
 * Revenue = money collected: invoice_payments dated in range (payments on void invoices excluded), plus — for paid
 * invoices that have no payment rows at all (legacy / marked paid directly) — the invoice total on its paid_at date.
 * Billed = non-draft, non-void invoices created in range.
 * Vehicle: 'standard' deducts mileage and ignores vehicle-category expenses; 'actual' deducts the vehicle-category
 * expenses and NOT the mileage (exactly as the old Reports did).
 */
export const computePL = ({ lessons = [], invoices = [], invoicePayments = [], expenses = [], mileage = [] } = {}, range, method = 'standard') => {
  const invById = new Map(invoices.map((i) => [i.id, i]));
  const hasPayments = new Set(invoicePayments.map((p) => p.invoice_id));

  const byMethod = {};
  let collected = 0;
  let paymentCount = 0;
  for (const p of invoicePayments) {
    const inv = invById.get(p.invoice_id);
    if (inv && inv.status === 'void') continue;
    if (!inRange(localDay(p.paid_at), range)) continue;
    const amt = num(p.amount);
    const k = p.method || 'Unspecified';
    byMethod[k] = round2((byMethod[k] || 0) + amt);
    collected += amt;
    paymentCount++;
  }
  for (const inv of invoices) {
    if (inv.status !== 'paid' || hasPayments.has(inv.id)) continue;
    if (!inRange(localDay(inv.paid_at), range)) continue;
    const amt = invoiceTotal(inv);
    const k = inv.paid_via || 'Unspecified';
    byMethod[k] = round2((byMethod[k] || 0) + amt);
    collected += amt;
    paymentCount++;
  }

  let billed = 0;
  let billedCount = 0;
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'void') continue;
    if (!inRange(localDay(inv.created_at), range)) continue;
    billed += invoiceTotal(inv);
    billedCount++;
  }

  const lessonsInRange = lessons.filter((l) => inRange(l.date, range));

  const expensesInRange = expenses.filter((e) => inRange(e.date, range));
  const vehicleRows = expensesInRange.filter((e) => isVehicleCategory(e.category));
  const byCategory = {};
  for (const e of expensesInRange) {
    if (vehicleRows.includes(e)) continue;
    const k = e.category || 'Uncategorized';
    byCategory[k] = round2((byCategory[k] || 0) + num(e.amount));
  }
  const actualVehicle = round2(vehicleRows.reduce((s, e) => s + num(e.amount), 0));

  const mileageInRange = mileage.filter((m) => inRange(m.date, range));
  const miles = round2(mileageInRange.reduce((s, m) => s + num(m.miles), 0));
  const mileageDeduction = round2(mileageInRange.reduce((s, m) => s + rowAmount(m), 0));

  const vehicleDeduction = method === 'actual' ? actualVehicle : mileageDeduction;
  const categoryTotal = round2(Object.values(byCategory).reduce((s, v) => s + v, 0));
  const totalExpenses = round2(categoryTotal + vehicleDeduction);
  collected = round2(collected);
  const net = round2(collected - totalExpenses);

  return {
    range, method,
    lessonCount: lessonsInRange.length,
    collected, collectedByMethod: byMethod, paymentCount,
    billed: round2(billed), billedCount,
    expensesByCategory: byCategory, categoryTotal,
    vehicleExpenseCount: vehicleRows.length, actualVehicle,
    miles, mileageCount: mileageInRange.length, mileageDeduction,
    vehicleDeduction, totalExpenses, net,
    margin: collected > 0 ? round2((net / collected) * 100) : null,
  };
};

/** % change cur vs prev; null when prev is 0 and cur is not (undefined %), 0 when both 0. */
export const pctChange = (cur, prev) => {
  const c = num(cur);
  const p = num(prev);
  if (p === 0) return c === 0 ? 0 : null;
  return round2(((c - p) / Math.abs(p)) * 100);
};

/** Comparison of the P&L for `range` with the previous period. */
export const comparePeriods = (data, range, method) => {
  const prevRange = previousPeriod(range);
  const cur = computePL(data, range, method);
  const prev = computePL(data, prevRange, method);
  return {
    prevRange, cur, prev,
    revenueChange: pctChange(cur.collected, prev.collected),
    expenseChange: pctChange(cur.totalExpenses, prev.totalExpenses),
    profitChange: pctChange(cur.net, prev.net),
  };
};

export const formatPct = (v) => (v == null ? '—' : `${v >= 0 ? '↑' : '↓'} ${Math.abs(v).toFixed(1)}%`);

const fmtDay = (s) => (s ? parseLocalDate(s).toLocaleDateString() : '');
export const periodLabel = (range) => `${fmtDay(range.start)} - ${fmtDay(range.end)}`;

const money2 = (n) => round2(num(n)).toFixed(2);

/** CSV rows for the P&L. */
export const plCSVRows = (pl) => {
  const rows = [
    ['Profit & Loss Report'],
    [`Period: ${periodLabel(pl.range)}`],
    [''],
    ['INCOME'],
    ['Category', 'Amount'],
  ];
  for (const [k, v] of Object.entries(pl.collectedByMethod).sort((a, b) => b[1] - a[1])) rows.push([`Collected - ${k}`, money2(v)]);
  rows.push(['Total Collected', money2(pl.collected)]);
  rows.push(['Billed (invoices issued)', money2(pl.billed)]);
  rows.push([''], ['EXPENSES'], ['Category', 'Amount']);
  for (const [k, v] of Object.entries(pl.expensesByCategory)) rows.push([k, money2(v)]);
  if (pl.vehicleDeduction > 0) {
    rows.push([pl.method === 'actual' ? 'Vehicle (Actual)' : `Vehicle (Mileage, ${pl.miles.toFixed(1)} mi)`, money2(pl.vehicleDeduction)]);
  }
  rows.push(['Total Expenses', money2(pl.totalExpenses)]);
  rows.push([''], ['NET PROFIT', money2(pl.net)]);
  return rows;
};

/** CSV rows for the mileage log over a range. */
export const mileageCSVRows = (entries, range) => {
  const list = entries.filter((m) => inRange(m.date, range)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rows = [
    ['Mileage Log Report'],
    [`Period: ${periodLabel(range)}`],
    [''],
    ['Date', 'Description', 'Entry Type', 'Odometer Start', 'Odometer End', 'Miles', 'Rate', 'Amount'],
  ];
  let miles = 0;
  let amount = 0;
  for (const m of list) {
    const t = entryTypeOf(m);
    const a = rowAmount(m);
    miles += num(m.miles);
    amount += a;
    rows.push([m.date, m.description || '', t === 'odometer' ? 'Odometer' : 'Manual',
      t === 'odometer' ? m.odometer_start : '', t === 'odometer' ? m.odometer_end : '',
      num(m.miles).toFixed(1), num(m.rate), a.toFixed(2)]);
  }
  rows.push(['', 'TOTAL', '', '', '', round2(miles).toFixed(1), '', round2(amount).toFixed(2)]);
  return rows;
};

/** CSV rows for expenses over an optional range. */
export const expensesCSVRows = (expenses, range = null) => {
  const list = range ? expenses.filter((e) => inRange(e.date, range)) : expenses;
  const rows = [['Date', 'Category', 'Description', 'Vendor', 'Payment Method', 'Amount']];
  let total = 0;
  for (const e of list) {
    total += num(e.amount);
    rows.push([e.date, e.category || '', e.description || '', e.vendor || '', e.payment_method || '', money2(e.amount)]);
  }
  rows.push(['', '', '', '', 'TOTAL', money2(total)]);
  return rows;
};

export const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const row = (label, value, strong = false) =>
  `<tr${strong ? ' class="t"' : ''}><td>${escapeHtml(label)}</td><td class="r">${escapeHtml(value)}</td></tr>`;

/** Printable HTML for the P&L (all interpolated text escaped). */
export const plPrintHTML = (pl, cmp, { coachName = '' } = {}) => {
  const inc = Object.entries(pl.collectedByMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => row(k, formatMoney(v))).join('');
  const exp = Object.entries(pl.expensesByCategory).map(([k, v]) => row(k, formatMoney(v))).join('');
  const veh = pl.vehicleDeduction > 0
    ? row(pl.method === 'actual' ? `Vehicle (Actual, ${pl.vehicleExpenseCount} expenses)` : `Vehicle (Mileage, ${pl.miles.toFixed(1)} miles)`, formatMoney(pl.vehicleDeduction))
    : '';
  const comp = cmp
    ? `<h2>Comparison to Previous Period (${escapeHtml(periodLabel(cmp.prevRange))})</h2><table>
${row('Revenue', `${formatMoney(cmp.prev.collected)} → ${formatMoney(pl.collected)} (${formatPct(cmp.revenueChange)})`)}
${row('Expenses', `${formatMoney(cmp.prev.totalExpenses)} → ${formatMoney(pl.totalExpenses)} (${formatPct(cmp.expenseChange)})`)}
${row('Net Profit', `${formatMoney(cmp.prev.net)} → ${formatMoney(pl.net)} (${formatPct(cmp.profitChange)})`)}
${row('Lessons', `${cmp.prev.lessonCount} → ${pl.lessonCount}`)}</table>`
    : '';
  return printShell('Profit & Loss Report', coachName, pl.range, `
<h2>Income</h2><table>${inc || row('No payments collected', formatMoney(0))}${row('Total Collected', formatMoney(pl.collected), true)}
${row(`Billed (${pl.billedCount} invoices issued)`, formatMoney(pl.billed))}</table>
<h2>Expenses</h2><table>${exp}${veh}${row('Total Expenses', formatMoney(pl.totalExpenses), true)}</table>
<table>${row('Net Profit', formatMoney(pl.net), true)}${row('Profit Margin', pl.margin == null ? '—' : `${pl.margin.toFixed(1)}%`)}</table>
${comp}`);
};

/** Printable HTML for the mileage log. */
export const mileagePrintHTML = (entries, range, { coachName = '' } = {}) => {
  const rows = mileageCSVRows(entries, range).slice(4);
  const body = rows.map((r, i) => `<tr${i === rows.length - 1 ? ' class="t"' : ''}>${[r[0], r[1], r[2], r[5], r[7]].map((c, j) => `<td${j >= 3 ? ' class="r"' : ''}>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  return printShell('Mileage Log Report', coachName, range,
    `<table><tr><th>Date</th><th>Description</th><th>Entry Type</th><th class="r">Miles</th><th class="r">Amount</th></tr>${body}</table>`);
};

const printShell = (title, coachName, range, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px}h1{margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}td,th{padding:6px 4px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}.r{text-align:right}.t td{font-weight:700;border-top:2px solid #94a3b8}.m{color:#64748b}</style>
</head><body><h1>${escapeHtml(title)}</h1>${coachName ? `<div class="m">${escapeHtml(coachName)}</div>` : ''}<div class="m">Period: ${escapeHtml(periodLabel(range))}</div>${body}</body></html>`;
