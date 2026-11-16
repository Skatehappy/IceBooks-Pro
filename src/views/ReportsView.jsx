import { useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import { formatDate, formatMoney, downloadCSV } from '../lib/format.js';
import { entryTypeOf, rowAmount } from '../lib/mileage.js';
import {
  PERIOD_PRESETS, getPresetRange, defaultRange, matchPreset, comparePeriods, vehicleMethodOf, inRange,
  periodLabel, formatPct, plCSVRows, mileageCSVRows, plPrintHTML, mileagePrintHTML, round2,
} from '../lib/reports.js';

const h3 = { fontSize: 18, fontWeight: 600, marginBottom: 16, borderBottom: '2px solid #e2e8f0', paddingBottom: 8 };
const line = { display: 'flex', justifyContent: 'space-between', padding: '12px 0', gap: 12 };
const totalLine = { ...line, borderTop: '1px solid #e2e8f0', fontWeight: 700 };
const changeColor = (v, invert = false) => (v == null || v === 0 ? '#64748b' : (v > 0) !== invert ? '#22c55e' : '#ef4444');

function printHTML(html) {
  const w = window.open('', '_blank');
  if (!w) { window.print(); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

function PeriodBox({ range }) {
  return (
    <div style={{ marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Report Period</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{periodLabel(range)}</div>
    </div>
  );
}

function ProfitLoss({ cmp, method, onMethod }) {
  const pl = cmp.cur;
  const prev = cmp.prev;
  const income = Object.entries(pl.collectedByMethod).sort((a, b) => b[1] - a[1]);
  const uncollected = round2(pl.billed - pl.collected);
  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #3b82f6' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Vehicle Expense Method</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="vehicleMethod" checked={method === 'standard'} onChange={() => onMethod('standard')} style={{ marginRight: 8 }} />
            <span>Standard Mileage Rate ({pl.miles.toFixed(1)} miles = {formatMoney(pl.mileageDeduction)})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="vehicleMethod" checked={method === 'actual'} onChange={() => onMethod('actual')} style={{ marginRight: 8 }} />
            <span>Actual Vehicle Expenses ({pl.vehicleExpenseCount} entries = {formatMoney(pl.actualVehicle)})</span>
          </label>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
          {method === 'standard'
            ? 'Using IRS standard mileage rate deduction (vehicle-category expenses are excluded)'
            : 'Using actual costs (gas, maintenance, insurance, etc.); standard mileage is not deducted'}
        </div>
      </div>

      <PeriodBox range={pl.range} />

      <div style={{ marginBottom: 32 }}>
        <h3 style={h3}>Income</h3>
        <div style={line}>
          <span style={{ color: '#64748b' }}>Billed ({pl.billedCount} invoices issued)</span>
          <span style={{ fontWeight: 600 }}>{formatMoney(pl.billed)}</span>
        </div>
        <div style={line}>
          <span style={{ color: '#64748b' }}>Collected ({pl.paymentCount} payments)</span>
          <span style={{ fontWeight: 600 }}>{formatMoney(pl.collected)}</span>
        </div>
        {income.length > 0 && (
          <div style={{ marginLeft: 16, borderLeft: '3px solid #e2e8f0', paddingLeft: 16, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Payment Breakdown</div>
            {income.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                <span style={{ color: '#64748b' }}>{k}</span><span>{formatMoney(v)}</span>
              </div>
            ))}
            {uncollected > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Billed but not yet collected</span>
                <span style={{ color: '#94a3b8' }}>{formatMoney(uncollected)}</span>
              </div>
            )}
          </div>
        )}
        <div style={{ ...line, fontSize: 13, color: '#64748b', padding: '4px 0' }}>
          <span>Lessons in period</span><span>{pl.lessonCount}</span>
        </div>
        <div style={totalLine}><span>Total Income (collected)</span><span>{formatMoney(pl.collected)}</span></div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h3 style={h3}>Expenses</h3>
        {Object.entries(pl.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <div key={k} style={line}><span style={{ color: '#64748b' }}>{k}</span><span>{formatMoney(v)}</span></div>
        ))}
        {pl.vehicleDeduction > 0 && (
          <div style={line}>
            <span style={{ color: '#64748b' }}>
              {method === 'standard' ? `Vehicle (Mileage) 🚗 (${pl.miles.toFixed(1)} miles)` : `Vehicle (Actual) 🚗 (${pl.vehicleExpenseCount} expenses)`}
            </span>
            <span>{formatMoney(pl.vehicleDeduction)}</span>
          </div>
        )}
        {pl.totalExpenses === 0 && <div style={{ ...line, color: '#94a3b8' }}>No expenses in this period</div>}
        <div style={totalLine}><span>Total Expenses</span><span>{formatMoney(pl.totalExpenses)}</span></div>
      </div>

      <div style={{ padding: 20, background: pl.net >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, border: `2px solid ${pl.net >= 0 ? '#22c55e' : '#ef4444'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Net Profit</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: pl.net >= 0 ? '#22c55e' : '#ef4444' }}>{formatMoney(pl.net)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Profit Margin</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{pl.margin == null ? '—' : `${pl.margin.toFixed(1)}%`}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#64748b', marginTop: 0 }}>
          Comparison to Previous Period ({periodLabel(cmp.prevRange)})
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            ['Revenue Change', cmp.revenueChange, `${formatMoney(prev.collected)} → ${formatMoney(pl.collected)}`, false],
            ['Expense Change', cmp.expenseChange, `${formatMoney(prev.totalExpenses)} → ${formatMoney(pl.totalExpenses)}`, true],
            ['Profit Change', cmp.profitChange, `${formatMoney(prev.net)} → ${formatMoney(pl.net)}`, false],
          ].map(([label, v, detail, invert]) => (
            <div key={label}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: changeColor(v, invert) }}>{v == null ? 'New' : formatPct(v)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{detail}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Lessons</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{pl.lessonCount} vs {prev.lessonCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MileageReport({ entries, range, settings, styles: l }) {
  const list = entries.filter((m) => inRange(m.date, range)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const miles = round2(list.reduce((s, m) => s + (Number(m.miles) || 0), 0));
  const amount = round2(list.reduce((s, m) => s + rowAmount(m), 0));
  const standard = vehicleMethodOf(settings) === 'standard';
  return (
    <div>
      <PeriodBox range={range} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, background: '#eff6ff', borderRadius: 8, border: '1px solid #3b82f6' }}>
          <div style={{ fontSize: 14, color: '#3b82f6', marginBottom: 4 }}>Total Miles</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{miles.toFixed(1)}</div>
        </div>
        <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #22c55e' }}>
          <div style={{ fontSize: 14, color: '#22c55e', marginBottom: 4 }}>{standard ? 'Total Deduction' : 'Mileage Value (not deducted)'}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d' }}>{formatMoney(amount)}</div>
        </div>
        <div style={{ padding: 16, background: '#faf5ff', borderRadius: 8, border: '1px solid #a855f7' }}>
          <div style={{ fontSize: 14, color: '#a855f7', marginBottom: 4 }}>Method</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#7e22ce' }}>{standard ? `${formatMoney(settings.mileage_rate)}/mi` : 'Actual Costs'}</div>
        </div>
      </div>
      {list.length === 0 ? (
        <div style={l.empty}>No mileage entries for the selected date range.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={l.table}>
            <thead>
              <tr>
                <th style={l.th}>Date</th><th style={l.th}>Description</th><th style={l.th}>Entry Type</th>
                <th style={l.th}>Miles</th><th style={l.th}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td style={{ ...l.td, whiteSpace: 'nowrap' }}>{formatDate(m.date)}</td>
                  <td style={l.td}>{m.description}</td>
                  <td style={l.td}>{entryTypeOf(m) === 'odometer' ? '🔢 Odometer' : '📝 Manual'}</td>
                  <td style={l.td}>{(Number(m.miles) || 0).toFixed(1)}</td>
                  <td style={l.td}>{formatMoney(rowAmount(m))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td style={l.td} colSpan={3}>Total</td>
                <td style={l.td}>{miles.toFixed(1)}</td>
                <td style={l.td}>{formatMoney(amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReportsView() {
  const { styles: l, data, settings, saveSettings, toast, isMobile } = useApp();
  const [view, setView] = useState('pl');
  const [range, setRange] = useState(() => defaultRange());
  const method = vehicleMethodOf(settings);
  const valid = !!range.start && !!range.end && range.start <= range.end;
  const active = valid ? matchPreset(range) : 'custom';

  const cmp = useMemo(() => (valid ? comparePeriods(data, range, method) : null), [data, range, method, valid]);

  const setMethod = async (m) => {
    if (m === method) return;
    try {
      await saveSettings({ vehicle_expense_method: m });
      toast('Settings saved');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };

  const exportCSV = () => {
    if (!valid) { toast('Please choose a valid date range'); return; }
    if (view === 'pl') downloadCSV(plCSVRows(cmp.cur), `pl-report-${range.start}-to-${range.end}.csv`);
    else downloadCSV(mileageCSVRows(data.mileage, range), `mileage-report-${range.start}-to-${range.end}.csv`);
  };

  const print = () => {
    if (!valid) { toast('Please choose a valid date range'); return; }
    const opts = { coachName: settings.coach_name || '' };
    printHTML(view === 'pl' ? plPrintHTML(cmp.cur, cmp, opts) : mileagePrintHTML(data.mileage, range, opts));
  };

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>Reports</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...l.btn, ...l.btnSecondary }} onClick={print}>🖨️ Print</button>
          <button style={{ ...l.btn, ...l.btnSecondary }} onClick={exportCSV}>💾 Export CSV</button>
        </div>
      </div>
      <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button style={{ ...l.btn, ...(view === 'pl' ? l.btnPrimary : l.btnSecondary) }} onClick={() => setView('pl')}>📊 Profit & Loss</button>
        <button style={{ ...l.btn, ...(view === 'mileage' ? l.btnPrimary : l.btnSecondary) }} onClick={() => setView('mileage')}>🚗 Mileage Log</button>
      </div>
      <div style={{ marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...l.label, marginBottom: 8 }}>Quick Date Ranges</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERIOD_PRESETS.map((p) => (
              <button key={p.id} style={{ ...l.btn, ...l.btnSmall, ...(active === p.id ? l.btnPrimary : l.btnSecondary) }}
                onClick={() => setRange(getPresetRange(p.id))}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 200px' }}>
            <label style={l.label}>Start Date</label>
            <input type="date" style={l.input} value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 200px' }}>
            <label style={l.label}>End Date</label>
            <input type="date" style={l.input} value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} />
          </div>
        </div>
        {!valid && <div style={{ ...l.error, marginTop: 12, marginBottom: 0 }}>Start date must be on or before end date.</div>}
      </div>
      {valid && view === 'pl' && <ProfitLoss cmp={cmp} method={method} onMethod={setMethod} />}
      {valid && view === 'mileage' && <MileageReport entries={data.mileage} range={range} settings={settings} styles={l} />}
    </div>
  );
}
