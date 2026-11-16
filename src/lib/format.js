// Pure formatting/date helpers (recovered from the legacy bundle).
export const pad2 = (n) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD for a Date or date-like value. */
export const toISODate = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

/** "13:30:00" or "13:30" -> "1:30 PM" */
export const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

export const formatMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

/** Parse a YYYY-MM-DD string as a LOCAL date (avoids the UTC off-by-one of new Date('2026-01-05')). */
export const parseLocalDate = (s) => {
  if (s instanceof Date) return s;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const formatDate = (s) => (s ? parseLocalDate(s).toLocaleDateString() : '');

/** The 7 days (Sun..Sat) of the week containing d. */
export const weekDays = (d) => {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x;
  });
};

/** 42-cell month grid: [{date, outside}] */
export const monthGrid = (d) => {
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const cells = [];
  for (let i = first.getDay() - 1; i >= 0; i--) cells.push({ date: new Date(y, m, -i), outside: true });
  for (let i = 1; i <= last.getDate(); i++) cells.push({ date: new Date(y, m, i), outside: false });
  while (cells.length < 42) {
    cells.push({ date: new Date(y, m + 1, cells.length - last.getDate() - first.getDay() + 1), outside: true });
  }
  return cells;
};

/** Download rows (array of arrays) as a CSV file. Values are quoted/escaped. */
export const downloadCSV = (rows, filename) => {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  downloadBlob(new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
