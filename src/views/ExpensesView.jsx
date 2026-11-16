import { useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import ExpenseModal from '../modals/ExpenseModal.jsx';
import { formatDate, formatMoney, downloadCSV, toISODate } from '../lib/format.js';
import { round2 } from '../lib/mileage.js';
import { expensesCSVRows } from '../lib/reports.js';

export default function ExpensesView() {
  const { styles: l, data, supabase, reload, toast, isMobile } = useApp();
  const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit
  const [category, setCategory] = useState('');

  const categories = useMemo(() => [...new Set(data.expenses.map((e) => e.category).filter(Boolean))].sort(), [data.expenses]);
  const list = category ? data.expenses.filter((e) => e.category === category) : data.expenses;
  const total = round2(list.reduce((s, e) => s + (Number(e.amount) || 0), 0));

  const remove = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      await reload();
      toast('Expense deleted');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };

  const exportCSV = () => downloadCSV(expensesCSVRows(list), `expenses-${toISODate(new Date())}.csv`);

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>Expenses</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.expenses.length > 0 && <button style={{ ...l.btn, ...l.btnSecondary }} onClick={exportCSV}>💾 Export CSV</button>}
          <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => setEditing(null)}>+ Add Expense</button>
        </div>
      </div>
      <div style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 8, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><strong>Total Expenses:</strong> {formatMoney(total)}</div>
        {categories.length > 1 && (
          <select style={{ ...l.select, width: isMobile ? '100%' : 220 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      {list.length === 0 ? (
        <div style={l.empty}>No expenses recorded yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={l.table}>
            <thead>
              <tr>
                <th style={l.th}>Date</th>
                <th style={l.th}>Category</th>
                <th style={l.th}>Description</th>
                <th style={l.th}>Amount</th>
                <th style={l.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...l.td, whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td>
                  <td style={l.td}>{e.category}</td>
                  <td style={l.td}>
                    {e.description}
                    {(e.vendor || e.payment_method) && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>{[e.vendor, e.payment_method].filter(Boolean).join(' • ')}</div>
                    )}
                  </td>
                  <td style={l.td}>{formatMoney(e.amount)}</td>
                  <td style={{ ...l.td, whiteSpace: 'nowrap' }}>
                    <button style={{ ...l.btn, ...l.btnSmall, ...l.btnSecondary, marginRight: 8 }} onClick={() => setEditing(e)}>Edit</button>
                    <button style={{ ...l.btn, ...l.btnSmall, ...l.btnDanger }} onClick={() => remove(e.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && <ExpenseModal expense={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
