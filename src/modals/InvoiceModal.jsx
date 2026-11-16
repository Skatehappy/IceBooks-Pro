import { useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { formatMoney, formatDate } from '../lib/format.js';
import { billableForClient, invoiceTotal, defaultDueDate, paymentSnapshot, lessonTypeFor, roundCents } from '../lib/invoice.js';

/** Create Invoice modal: bills a client's uninvoiced completed lessons + late cancellations. */
export default function InvoiceModal({ clientId = '', onClose }) {
  const { supabase, data, settings, styles: l, reload, toast } = useApp();
  const customTypes = settings.custom_lesson_types || [];
  const [form, setForm] = useState(() => ({
    client_id: clientId ? String(clientId) : '',
    tax_rate: 0,
    notes: '',
    due_date: defaultDueDate(),
    ...paymentSnapshot(settings),
  }));
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const billable = useMemo(
    () => billableForClient({ clientId: form.client_id, students: data.students, bookings: data.bookings, lessons: data.lessons, customTypes }),
    [form.client_id, data.students, data.bookings, data.lessons, customTypes],
  );
  const total = invoiceTotal(billable.amount, form.tax_rate);
  const studentName = (s) => s?.name || 'Student';

  const create = async () => {
    if (!form.client_id) return;
    setBusy(true);
    let created = null;
    try {
      const { data: inv, error } = await supabase.from('invoices').insert({
        client_id: Number(form.client_id),
        amount: billable.amount,
        tax_rate: Number(form.tax_rate) || 0,
        total,
        notes: form.notes,
        due_date: form.due_date || null,
        status: 'draft',
        payment_cash: form.payment_cash, payment_check: form.payment_check,
        payment_venmo: form.payment_venmo, payment_paypal: form.payment_paypal,
        payment_zelle: form.payment_zelle, payment_cashapp: form.payment_cashapp,
      }).select().single();
      if (error) throw error;
      created = inv;
      const ids = [...billable.completed, ...billable.late].map((r) => r.booking.id);
      if (ids.length) {
        const { error: e2 } = await supabase.from('bookings').update({ invoice_id: inv.id }).in('id', ids);
        if (e2) throw e2;
      }
      await reload();
      toast('Invoice created');
      onClose();
    } catch (e) {
      // Don't leave an invoice whose bookings were never linked.
      if (created) await supabase.from('invoices').delete().eq('id', created.id);
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const itemRow = (r, late) => (
    <div key={r.booking.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0', color: late ? '#ef4444' : '#334155' }}>
      <span>{formatDate(r.lesson.date)} · {lessonTypeFor(r.lesson.lesson_type, customTypes).name} · {studentName(r.student)}{late ? ' (late cancel)' : ''}</span>
      <span>{formatMoney(r.rate)}</span>
    </div>
  );

  const footer = (
    <>
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
      <button style={{ ...l.btn, ...l.btnPrimary, opacity: !form.client_id || busy ? 0.6 : 1 }} onClick={create} disabled={!form.client_id || busy}>
        {busy ? 'Creating…' : 'Create Invoice'}
      </button>
    </>
  );

  return (
    <Modal title="Create Invoice" onClose={onClose} footer={footer}>
      <div style={l.formGroup}>
        <label style={l.label}>Client *</label>
        <select style={l.select} value={form.client_id} onChange={(e) => set({ client_id: e.target.value })}>
          <option value="">Select client...</option>
          {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 16 }}>
        <strong>Completed Lessons:</strong> {billable.completed.length}<br />
        {billable.late.length > 0 && (<><strong style={{ color: '#ef4444' }}>Late Cancellations:</strong> {billable.late.length}<br /></>)}
        <strong>Subtotal:</strong> {formatMoney(billable.amount)}
        {(billable.completed.length > 0 || billable.late.length > 0) && (
          <div style={{ marginTop: 8, borderTop: '1px solid #e2e8f0', paddingTop: 8, maxHeight: 180, overflowY: 'auto' }}>
            {billable.completed.map((r) => itemRow(r, false))}
            {billable.late.map((r) => itemRow(r, true))}
          </div>
        )}
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Tax Rate (%)</label>
          <input type="number" style={l.input} step="0.01" min="0" value={form.tax_rate}
            onChange={(e) => set({ tax_rate: e.target.value === '' ? '' : roundCents(parseFloat(e.target.value) || 0) })} />
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Due Date</label>
          <input type="date" style={l.input} value={form.due_date} onChange={(e) => set({ due_date: e.target.value })} />
        </div>
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Accepted Payment Methods</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={!!form.payment_cash} onChange={(e) => set({ payment_cash: e.target.checked })} style={{ marginRight: 6 }} />Cash
          </label>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={!!form.payment_check} onChange={(e) => set({ payment_check: e.target.checked })} style={{ marginRight: 6 }} />Check
          </label>
        </div>
        <div style={l.row}>
          <div style={l.formGroup}>
            <label style={l.label}>Venmo</label>
            <input type="text" style={l.input} value={form.payment_venmo} onChange={(e) => set({ payment_venmo: e.target.value })} placeholder="@username" />
          </div>
          <div style={l.formGroup}>
            <label style={l.label}>PayPal</label>
            <input type="text" style={l.input} value={form.payment_paypal} onChange={(e) => set({ payment_paypal: e.target.value })} placeholder="email@example.com" />
          </div>
        </div>
        <div style={l.row}>
          <div style={l.formGroup}>
            <label style={l.label}>Zelle</label>
            <input type="text" style={l.input} value={form.payment_zelle} onChange={(e) => set({ payment_zelle: e.target.value })} placeholder="phone or email" />
          </div>
          <div style={l.formGroup}>
            <label style={l.label}>Cash App</label>
            <input type="text" style={l.input} value={form.payment_cashapp} onChange={(e) => set({ payment_cashapp: e.target.value })} placeholder="$cashtag" />
          </div>
        </div>
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Notes</label>
        <textarea style={l.textarea} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
      <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8 }}>
        <strong>Total:</strong> {formatMoney(total)}
      </div>
    </Modal>
  );
}
