import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { PAYMENT_METHODS } from '../lib/constants.js';
import { formatMoney, toISODate } from '../lib/format.js';
import { applyPayment, balanceDue, totalOf, paidOf } from '../lib/invoice.js';

/** Record a (partial) payment against an invoice. The DB trigger updates amount_paid/status. */
export default function PaymentModal({ invoice, client, onClose }) {
  const { supabase, data, styles: l, reload, toast } = useApp();
  const balance = balanceDue(invoice, data.invoicePayments);
  const [form, setForm] = useState({
    amount: balance.toFixed(2),
    paid_at: toISODate(new Date()),
    method: invoice.paid_via && PAYMENT_METHODS.includes(invoice.paid_via) ? invoice.paid_via : PAYMENT_METHODS[0],
    reference: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const preview = applyPayment(invoice, form.amount === '' ? '' : Number(form.amount), data.invoicePayments);

  const save = async () => {
    if (preview.error) { toast(preview.error); return; }
    if (!form.paid_at) { toast('Enter a payment date'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('invoice_payments').insert({
        invoice_id: invoice.id,
        amount: preview.amount,
        paid_at: form.paid_at,
        method: form.method,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
      if (preview.status === 'paid') await supabase.from('invoices').update({ paid_via: form.method }).eq('id', invoice.id);
      await reload();
      toast(preview.status === 'paid' ? 'Payment recorded — invoice paid in full' : `Payment of ${formatMoney(preview.amount)} recorded`);
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
      <button style={{ ...l.btn, ...l.btnSuccess, opacity: busy || preview.error ? 0.6 : 1 }} onClick={save} disabled={busy || !!preview.error}>
        {busy ? 'Saving…' : 'Record Payment'}
      </button>
    </>
  );

  return (
    <Modal title={`Record Payment — Invoice #${invoice.id}`} onClose={onClose} footer={footer}>
      <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
        <div><strong>Client:</strong> {client?.name || '-'}</div>
        <div><strong>Total:</strong> {formatMoney(totalOf(invoice))} · <strong>Paid:</strong> {formatMoney(paidOf(invoice, data.invoicePayments))} · <strong>Balance:</strong> {formatMoney(balance)}</div>
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Amount *</label>
          <input type="number" step="0.01" min="0.01" max={balance} style={l.input} value={form.amount}
            onChange={(e) => set({ amount: e.target.value })} />
          <button type="button" style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall, marginTop: 6 }} onClick={() => set({ amount: balance.toFixed(2) })}>
            Full balance
          </button>
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Date *</label>
          <input type="date" style={l.input} value={form.paid_at} onChange={(e) => set({ paid_at: e.target.value })} />
        </div>
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Method</label>
          <select style={l.select} value={form.method} onChange={(e) => set({ method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Reference</label>
          <input type="text" style={l.input} value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Check # / transaction ID" />
        </div>
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Notes</label>
        <textarea style={l.textarea} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
      <div style={{ padding: 12, borderRadius: 8, background: preview.error ? '#fee2e2' : '#dcfce7', color: preview.error ? '#991b1b' : '#166534', fontSize: 14 }}>
        {preview.error
          ? preview.error
          : <>After this payment: paid {formatMoney(preview.paid)}, balance {formatMoney(preview.balance)} — <strong>{preview.status}</strong></>}
      </div>
    </Modal>
  );
}
