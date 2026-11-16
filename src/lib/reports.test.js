import { describe, it, expect } from 'vitest';
import {
  getPresetRange, previousPeriod, defaultRange, matchPreset, computePL, pctChange, comparePeriods, isVehicleCategory,
  localDay, plCSVRows, mileageCSVRows, expensesCSVRows, escapeHtml, plPrintHTML, mileagePrintHTML, formatPct,
} from './reports.js';

const at = (y, m, d) => new Date(y, m - 1, d, 12);

describe('period presets (local dates)', () => {
  it('months', () => {
    expect(getPresetRange('this_month', at(2026, 11, 15))).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(getPresetRange('this_month', at(2028, 2, 10))).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(getPresetRange('last_month', at(2026, 1, 5))).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(getPresetRange('last_month', at(2026, 3, 31))).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
  it('quarters incl. year boundary', () => {
    expect(getPresetRange('this_quarter', at(2026, 1, 1))).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect(getPresetRange('this_quarter', at(2026, 6, 30))).toEqual({ start: '2026-04-01', end: '2026-06-30' });
    expect(getPresetRange('this_quarter', at(2026, 12, 31))).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    expect(getPresetRange('last_quarter', at(2026, 2, 14))).toEqual({ start: '2025-10-01', end: '2025-12-31' });
    expect(getPresetRange('last_quarter', at(2026, 8, 1))).toEqual({ start: '2026-04-01', end: '2026-06-30' });
  });
  it('ytd / last year', () => {
    expect(getPresetRange('ytd', at(2026, 11, 15))).toEqual({ start: '2026-01-01', end: '2026-11-15' });
    expect(getPresetRange('ytd', new Date(2026, 0, 1, 0, 0, 1))).toEqual({ start: '2026-01-01', end: '2026-01-01' });
    expect(getPresetRange('last_year', at(2026, 1, 1))).toEqual({ start: '2025-01-01', end: '2025-12-31' });
    expect(getPresetRange('custom', at(2026, 1, 1))).toBeNull();
  });
  it('late-evening local time does not roll into the next day', () => {
    expect(getPresetRange('ytd', new Date(2026, 11, 31, 23, 59))).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(defaultRange(new Date(2026, 4, 31, 23, 30))).toEqual({ start: '2026-05-01', end: '2026-05-31' });
  });
  it('matches a preset', () => {
    const t = at(2026, 11, 15);
    expect(matchPreset({ start: '2026-10-01', end: '2026-12-31' }, t)).toBe('this_quarter');
    expect(matchPreset({ start: '2026-10-02', end: '2026-12-31' }, t)).toBe('custom');
  });
});

describe('previous period', () => {
  it('whole months -> same number of whole months before', () => {
    expect(previousPeriod({ start: '2026-03-01', end: '2026-03-31' })).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(previousPeriod({ start: '2026-01-01', end: '2026-03-31' })).toEqual({ start: '2025-10-01', end: '2025-12-31' });
    expect(previousPeriod({ start: '2025-01-01', end: '2025-12-31' })).toEqual({ start: '2024-01-01', end: '2024-12-31' });
    expect(previousPeriod({ start: '2026-01-01', end: '2026-01-31' })).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
  it('arbitrary ranges -> same day length ending the day before', () => {
    expect(previousPeriod({ start: '2026-03-10', end: '2026-03-19' })).toEqual({ start: '2026-02-28', end: '2026-03-09' });
    expect(previousPeriod({ start: '2026-01-01', end: '2026-01-01' })).toEqual({ start: '2025-12-31', end: '2025-12-31' });
    // YTD-style range spanning a DST change
    expect(previousPeriod({ start: '2026-01-01', end: '2026-11-15' })).toEqual({ start: '2025-02-16', end: '2025-12-31' });
  });
});

const data = {
  lessons: [{ date: '2026-03-02' }, { date: '2026-03-20' }, { date: '2026-02-10' }],
  invoices: [
    { id: 1, status: 'paid', total: '100', created_at: '2026-03-01T15:00:00Z', paid_at: '2026-03-05T15:00:00Z', paid_via: 'Venmo' },
    { id: 2, status: 'partial', total: 200, created_at: '2026-03-03T15:00:00Z' },
    { id: 3, status: 'void', total: 50, created_at: '2026-03-03T15:00:00Z' },
    { id: 4, status: 'draft', total: 75, created_at: '2026-03-03T15:00:00Z' },
    { id: 5, status: 'paid', amount: 40, total: null, created_at: '2026-02-01T15:00:00Z', paid_at: '2026-02-03T15:00:00Z', paid_via: 'Cash' },
  ],
  invoicePayments: [
    { invoice_id: 2, amount: '80.10', paid_at: '2026-03-10', method: 'Zelle' },
    { invoice_id: 2, amount: 20, paid_at: '2026-04-01', method: 'Zelle' },
    { invoice_id: 3, amount: 50, paid_at: '2026-03-10', method: 'Cash' },
    { invoice_id: 1, amount: 100, paid_at: '2026-03-05', method: 'Venmo' },
  ],
  expenses: [
    { date: '2026-03-01', category: 'Ice Time', amount: '30.25' },
    { date: '2026-03-15', category: 'Ice Time', amount: 10 },
    { date: '2026-03-16', category: 'Car Maintenance', amount: 60 },
    { date: '2026-03-17', category: 'Gas', amount: 20 },
    { date: '2026-02-17', category: 'Costumes', amount: 15 },
  ],
  mileage: [
    { date: '2026-03-04', miles: '10', rate: 0.725, amount: '7.25' },
    { date: '2026-03-31', miles: 20, rate: 0.725, amount: null },
    { date: '2026-04-01', miles: 99, rate: 1, amount: 99 },
  ],
};
const MARCH = { start: '2026-03-01', end: '2026-03-31' };

describe('P&L math', () => {
  it('standard mileage method', () => {
    const pl = computePL(data, MARCH, 'standard');
    expect(pl.collected).toBe(180.1); // 100 (inv1 payment) + 80.10; void invoice payment excluded
    expect(pl.collectedByMethod).toEqual({ Venmo: 100, Zelle: 80.1 });
    expect(pl.billed).toBe(300); // inv 1 + 2 (draft/void excluded)
    expect(pl.billedCount).toBe(2);
    expect(pl.lessonCount).toBe(2);
    expect(pl.expensesByCategory).toEqual({ 'Ice Time': 40.25 });
    expect(pl.actualVehicle).toBe(80);
    expect(pl.miles).toBe(30);
    expect(pl.mileageDeduction).toBe(21.75);
    expect(pl.vehicleDeduction).toBe(21.75);
    expect(pl.totalExpenses).toBe(62);
    expect(pl.net).toBe(118.1);
    expect(pl.margin).toBe(65.57);
  });
  it('actual method excludes standard mileage deduction', () => {
    const pl = computePL(data, MARCH, 'actual');
    expect(pl.vehicleDeduction).toBe(80);
    expect(pl.totalExpenses).toBe(120.25);
    expect(pl.net).toBe(59.85);
  });
  it('falls back to paid invoices with no payment rows', () => {
    const pl = computePL(data, { start: '2026-02-01', end: '2026-02-28' }, 'standard');
    expect(pl.collected).toBe(40);
    expect(pl.collectedByMethod).toEqual({ Cash: 40 });
    expect(pl.net).toBe(25);
  });
  it('no revenue -> margin null; empty data ok', () => {
    const pl = computePL({}, MARCH);
    expect(pl).toMatchObject({ collected: 0, totalExpenses: 0, net: 0, margin: null });
  });
  it('vehicle categories', () => {
    expect(isVehicleCategory('Car Maintenance')).toBe(true);
    expect(isVehicleCategory('Gas')).toBe(true);
    expect(isVehicleCategory('Auto Insurance')).toBe(true);
    expect(isVehicleCategory('Vehicle')).toBe(true);
    expect(isVehicleCategory('Cards & Gifts')).toBe(false);
    expect(isVehicleCategory('Scarves')).toBe(false);
    expect(isVehicleCategory('Ice Time')).toBe(false);
    expect(isVehicleCategory(null)).toBe(false);
  });
  it('localDay keeps plain dates and converts timestamps to local', () => {
    expect(localDay('2026-03-05')).toBe('2026-03-05');
    const ts = new Date(2026, 2, 5, 23, 30).toISOString();
    expect(localDay(ts)).toBe('2026-03-05');
    expect(localDay(null)).toBe('');
  });
});

describe('comparison', () => {
  it('pctChange guards divide by zero', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(-50, -100)).toBe(50);
    expect(formatPct(null)).toBe('—');
    expect(formatPct(-12.345)).toBe('↓ 12.3%');
  });
  it('compares with the previous month using the full P&L', () => {
    const c = comparePeriods(data, MARCH, 'standard');
    expect(c.prevRange).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(c.prev.collected).toBe(40);
    expect(c.prev.net).toBe(25);
    expect(c.revenueChange).toBe(350.25);
    expect(c.profitChange).toBe(372.4);
  });
});

describe('exports', () => {
  it('P&L CSV rows', () => {
    const rows = plCSVRows(computePL(data, MARCH, 'standard'));
    expect(rows).toContainEqual(['Total Collected', '180.10']);
    expect(rows).toContainEqual(['Ice Time', '40.25']);
    expect(rows).toContainEqual(['Vehicle (Mileage, 30.0 mi)', '21.75']);
    expect(rows).toContainEqual(['NET PROFIT', '118.10']);
  });
  it('mileage CSV rows (string numerics ok)', () => {
    const rows = mileageCSVRows(data.mileage, MARCH);
    expect(rows[4]).toEqual(['2026-03-04', '', 'Manual', '', '', '10.0', 0.725, '7.25']);
    expect(rows.at(-1)).toEqual(['', 'TOTAL', '', '', '', '30.0', '', '21.75']);
  });
  it('expenses CSV rows', () => {
    const rows = expensesCSVRows(data.expenses, MARCH);
    expect(rows.length).toBe(6);
    expect(rows.at(-1)).toEqual(['', '', '', '', 'TOTAL', '120.25']);
  });
  it('escapes user text in printed HTML', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    const evil = { ...data, expenses: [{ date: '2026-03-01', category: '<img src=x onerror=alert(1)>', amount: 5 }],
      mileage: [{ date: '2026-03-02', description: '<script>alert(1)</script>', miles: 1, rate: 1, amount: 1 }] };
    const html = plPrintHTML(computePL(evil, MARCH), comparePeriods(evil, MARCH), { coachName: '<i>Coach</i>' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<i>Coach');
    expect(html).toContain('&lt;img src=x');
    const mh = mileagePrintHTML(evil.mileage, MARCH);
    expect(mh).not.toContain('<script>');
  });
});
