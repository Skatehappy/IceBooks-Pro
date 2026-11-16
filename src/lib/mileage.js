// Pure mileage helpers (recovered from the legacy mileage handlers, with bug fixes):
// - odometer entries: miles = end - start, end must be > start
// - amount = miles * rate rounded to cents
// - entry_type is persisted (the old app never saved it)

/** Round half away from zero to cents, robust to binary float noise (2.175 -> 2.18, 1.005 -> 1.01). */
export const round2 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const cents = Math.round(Number((Math.abs(x) * 100).toPrecision(12)));
  return (Math.sign(x) * cents) / 100 || 0;
};

const isBlank = (v) => v === '' || v == null;
const toNum = (v) => (isBlank(v) ? NaN : Number(v));

/** Deduction for miles at rate, rounded to cents. */
export const mileageAmount = (miles, rate) => {
  const m = Number(miles);
  const r = Number(rate);
  if (!Number.isFinite(m) || !Number.isFinite(r)) return 0;
  return round2(m * r);
};

/** 'manual' | 'odometer' for a stored row (old rows have no entry_type; infer from odometer values). */
export const entryTypeOf = (row) => {
  if (row?.entry_type === 'odometer' || row?.entry_type === 'manual') return row.entry_type;
  return row && !isBlank(row.odometer_start) && !isBlank(row.odometer_end) ? 'odometer' : 'manual';
};

/**
 * Miles from a form state. Returns { miles } or { error }.
 * Odometer: both readings required, end > start. Manual: miles > 0.
 */
export const computeMiles = (form) => {
  if (form.entry_type === 'odometer') {
    const start = toNum(form.odometer_start);
    const end = toNum(form.odometer_end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { error: 'Please enter both odometer readings' };
    if (start < 0 || end < 0) return { error: 'Odometer readings cannot be negative' };
    if (end <= start) return { error: 'End odometer must be greater than start' };
    return { miles: round2(end - start) };
  }
  const miles = toNum(form.miles);
  if (!Number.isFinite(miles) || miles <= 0) return { error: 'Please enter valid mileage' };
  return { miles: round2(miles) };
};

/** Live preview { miles, amount } or null when the form is not yet valid. */
export const previewMileage = (form) => {
  const { miles } = computeMiles(form);
  const rate = toNum(form.rate);
  if (!miles || !Number.isFinite(rate) || rate < 0) return null;
  return { miles, amount: mileageAmount(miles, rate) };
};

/** Validate a form and build the DB payload. Returns { payload } or { error }. */
export const buildMileagePayload = (form) => {
  if (!form.date) return { error: 'Please enter a date' };
  const res = computeMiles(form);
  if (res.error) return res;
  const rate = toNum(form.rate);
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Please enter a valid rate' };
  const odo = form.entry_type === 'odometer';
  return {
    payload: {
      date: form.date,
      description: (form.description || '').trim(),
      miles: res.miles,
      rate,
      amount: mileageAmount(res.miles, rate),
      odometer_start: odo ? Number(form.odometer_start) : null,
      odometer_end: odo ? Number(form.odometer_end) : null,
      entry_type: odo ? 'odometer' : 'manual',
    },
  };
};

/** Stored amount, or miles*rate when amount is missing. */
export const rowAmount = (row) =>
  isBlank(row?.amount) ? mileageAmount(row?.miles || 0, row?.rate || 0) : round2(Number(row.amount) || 0);

/** { miles, amount } totals over rows (numeric columns may arrive as strings). */
export const mileageTotals = (rows) => {
  let miles = 0;
  let amount = 0;
  for (const r of rows || []) {
    miles += Number(r.miles) || 0;
    amount += rowAmount(r);
  }
  return { miles: round2(miles), amount: round2(amount) };
};
