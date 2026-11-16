import { useEffect, useState } from 'react';
import { useApp } from '../context.jsx';
import MileageModal from '../modals/MileageModal.jsx';
import { formatDate, formatMoney, downloadCSV, toISODate } from '../lib/format.js';
import { entryTypeOf, mileageTotals, rowAmount } from '../lib/mileage.js';
import { mileageCSVRows } from '../lib/reports.js';

export default function MileageView() {
  const { styles: l, data, supabase, reload, toast, settings, consumeNavParams } = useApp();
  const [editing, setEditing] = useState(undefined);
  const [newDate, setNewDate] = useState(null);

  // Deep link from the calendar: {newEntryDate: 'YYYY-MM-DD'} opens a new entry for that date. Read once on mount.
  useEffect(() => {
    const p = consumeNavParams();
    if (p && p.newEntryDate) {
      setNewDate(/^\d{4}-\d{2}-\d{2}$/.test(p.newEntryDate) ? p.newEntryDate : null);
      setEditing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const totals = mileageTotals(data.mileage);
  const actual = settings.vehicle_expense_method === 'actual';

  const remove = async (id) => {
    if (!confirm('Delete this mileage entry?')) return;
    try {
      const { error } = await supabase.from('mileage').delete().eq('id', id);
      if (error) throw error;
      await reload();
      toast('Mileage deleted');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };

  const exportCSV = () => {
    const dates = data.mileage.map((m) => m.date).filter(Boolean).sort();
    const range = { start: dates[0] || toISODate(new Date()), end: dates.at(-1) || toISODate(new Date()) };
    downloadCSV(mileageCSVRows(data.mileage, range), `mileage-log-${toISODate(new Date())}.csv`);
  };

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>Mileage Log</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.mileage.length > 0 && <button style={{ ...l.btn, ...l.btnSecondary }} onClick={exportCSV}>💾 Export CSV</button>}
          <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => { setNewDate(null); setEditing(null); }}>+ Log Mileage</button>
        </div>
      </div>
      <div style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 8, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><strong>Total Miles:</strong> {totals.miles.toFixed(1)}</div>
        <div>
          <strong>{actual ? 'Mileage Value:' : 'Tax Deduction:'}</strong> {formatMoney(totals.amount)}
        </div>
        {actual && (
          <div style={{ fontSize: 13, color: '#92400e' }}>
            Vehicle expense method is set to Actual Expenses — the standard mileage deduction is not used in reports.
          </div>
        )}
      </div>
      {data.mileage.length === 0 ? (
        <div style={l.empty}>No mileage logged yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={l.table}>
            <thead>
              <tr>
                <th style={l.th}>Date</th>
                <th style={l.th}>Description</th>
                <th style={l.th}>Miles</th>
                <th style={l.th}>Rate</th>
                <th style={l.th}>{actual ? 'Value' : 'Deduction'}</th>
                <th style={l.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.mileage.map((m) => (
                <tr key={m.id}>
                  <td style={{ ...l.td, whiteSpace: 'nowrap' }}>{formatDate(m.date)}</td>
                  <td style={l.td}>
                    {m.description}
                    {entryTypeOf(m) === 'odometer' && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>🔢 {m.odometer_start} → {m.odometer_end}</div>
                    )}
                  </td>
                  <td style={l.td}>{(Number(m.miles) || 0).toFixed(1)}</td>
                  <td style={{ ...l.td, whiteSpace: 'nowrap' }}>${Number(m.rate) || 0}/mi</td>
                  <td style={l.td}>{formatMoney(rowAmount(m))}</td>
                  <td style={{ ...l.td, whiteSpace: 'nowrap' }}>
                    <button style={{ ...l.btn, ...l.btnSmall, ...l.btnSecondary, marginRight: 8 }} onClick={() => setEditing(m)}>Edit</button>
                    <button style={{ ...l.btn, ...l.btnSmall, ...l.btnDanger }} onClick={() => remove(m.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && <MileageModal entry={editing} defaultDate={editing ? null : newDate} onClose={() => { setEditing(undefined); setNewDate(null); }} />}
    </div>
  );
}
