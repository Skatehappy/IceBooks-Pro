import { describe, it, expect } from 'vitest';
import { round2, mileageAmount, entryTypeOf, computeMiles, buildMileagePayload, previewMileage, mileageTotals, rowAmount } from './mileage.js';

describe('mileage math', () => {
  it('rounds to cents', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(mileageAmount(25.5, 0.725)).toBe(18.49); // 18.4875
    expect(mileageAmount(10, 0.67)).toBe(6.7);
    expect(mileageAmount('x', 1)).toBe(0);
  });

  it('manual miles must be > 0', () => {
    expect(computeMiles({ entry_type: 'manual', miles: '' }).error).toBe('Please enter valid mileage');
    expect(computeMiles({ entry_type: 'manual', miles: '0' }).error).toBe('Please enter valid mileage');
    expect(computeMiles({ entry_type: 'manual', miles: '-3' }).error).toBeTruthy();
    expect(computeMiles({ entry_type: 'manual', miles: '12.3' })).toEqual({ miles: 12.3 });
  });

  it('odometer: end must be greater than start, miles = end - start', () => {
    expect(computeMiles({ entry_type: 'odometer', odometer_start: '100', odometer_end: '90' }).error).toBe('End odometer must be greater than start');
    expect(computeMiles({ entry_type: 'odometer', odometer_start: '100', odometer_end: '100' }).error).toBe('End odometer must be greater than start');
    expect(computeMiles({ entry_type: 'odometer', odometer_start: '', odometer_end: '100' }).error).toBeTruthy();
    expect(computeMiles({ entry_type: 'odometer', odometer_start: '45230.5', odometer_end: '45256.0' })).toEqual({ miles: 25.5 });
    // floating point noise is removed
    expect(computeMiles({ entry_type: 'odometer', odometer_start: '0.1', odometer_end: '0.3' })).toEqual({ miles: 0.2 });
    // a 0 start is valid (old app treated 0 as "no reading")
    expect(computeMiles({ entry_type: 'odometer', odometer_start: '0', odometer_end: '15' })).toEqual({ miles: 15 });
  });

  it('builds payloads with entry_type and rounded amount', () => {
    const { payload } = buildMileagePayload({ entry_type: 'odometer', date: '2026-03-01', odometer_start: '100', odometer_end: '125.5', rate: '0.725', description: ' Rink ' });
    expect(payload).toEqual({ date: '2026-03-01', description: 'Rink', miles: 25.5, rate: 0.725, amount: 18.49, odometer_start: 100, odometer_end: 125.5, entry_type: 'odometer' });
    const m = buildMileagePayload({ entry_type: 'manual', date: '2026-03-01', miles: '10', rate: '0.7', odometer_start: '5', odometer_end: '9' }).payload;
    expect(m).toMatchObject({ miles: 10, amount: 7, odometer_start: null, odometer_end: null, entry_type: 'manual' });
    expect(buildMileagePayload({ entry_type: 'manual', date: '', miles: '1', rate: '1' }).error).toBe('Please enter a date');
    expect(buildMileagePayload({ entry_type: 'manual', date: '2026-01-01', miles: '1', rate: '' }).error).toBe('Please enter a valid rate');
    expect(buildMileagePayload({ entry_type: 'manual', date: '2026-01-01', miles: '1', rate: '-1' }).error).toBe('Please enter a valid rate');
  });

  it('preview and entry type inference', () => {
    expect(previewMileage({ entry_type: 'manual', miles: '10', rate: '0.5' })).toEqual({ miles: 10, amount: 5 });
    expect(previewMileage({ entry_type: 'manual', miles: '', rate: '0.5' })).toBeNull();
    expect(entryTypeOf({ entry_type: 'odometer' })).toBe('odometer');
    expect(entryTypeOf({ odometer_start: 0, odometer_end: 5 })).toBe('odometer');
    expect(entryTypeOf({ odometer_start: null, odometer_end: null })).toBe('manual');
  });

  it('totals handle numeric strings and missing amounts', () => {
    expect(mileageTotals([{ miles: '10.5', amount: '7.35' }, { miles: 4, rate: 0.5, amount: null }])).toEqual({ miles: 14.5, amount: 9.35 });
    expect(rowAmount({ miles: 3, rate: 0.725 })).toBe(2.18);
  });
});
