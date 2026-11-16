import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { toISODate, formatMoney } from '../lib/format.js';
import { DEFAULT_MILEAGE_RATE } from '../lib/constants.js';
import { buildMileagePayload, entryTypeOf, previewMileage } from '../lib/mileage.js';

const str = (v) => (v == null ? '' : String(v));

export default function MileageModal({ entry = null, defaultDate = null, onClose }) {
  const { styles: l, supabase, reload, toast, settings } = useApp();
  const defaultRate = settings.mileage_rate != null ? Number(settings.mileage_rate) : DEFAULT_MILEAGE_RATE;
  const [form, setForm] = useState(() => (entry ? {
    date: entry.date,
    description: entry.description || '',
    miles: str(entry.miles),
    rate: str(entry.rate ?? defaultRate),
    odometer_start: str(entry.odometer_start),
    odometer_end: str(entry.odometer_end),
    entry_type: entryTypeOf(entry),
  } : {
    date: defaultDate || toISODate(new Date()), description: '', miles: '', rate: str(defaultRate),
    odometer_start: '', odometer_end: '', entry_type: 'manual',
  }));
  const [busy, setBusy] = useState(false);
  const preview = previewMileage(form);

  const setType = (t) => setForm({ ...form, entry_type: t, miles: '', odometer_start: '', odometer_end: '' });

  const save = async () => {
    const { payload, error: invalid } = buildMileagePayload(form);
    if (invalid) { toast(invalid); return; }
    setBusy(true);
    try {
      if (entry) {
        const { error } = await supabase.from('mileage').update(payload).eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('mileage').insert(payload);
        if (error) throw error;
      }
      await reload();
      toast(entry ? 'Mileage updated' : 'Mileage logged');
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={entry ? 'Edit Mileage' : 'Log Mileage'}
      onClose={onClose}
      footer={<>
        <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
        <button style={{ ...l.btn, ...l.btnPrimary }} onClick={save} disabled={busy}>Save</button>
      </>}
    >
      <div style={l.formGroup}>
        <label style={l.label}>Entry Type</label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="entry_type" value="manual" checked={form.entry_type === 'manual'} onChange={() => setType('manual')} style={{ marginRight: 6 }} />
            Manual Entry
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="entry_type" value="odometer" checked={form.entry_type === 'odometer'} onChange={() => setType('odometer')} style={{ marginRight: 6 }} />
            Odometer Reading
          </label>
        </div>
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Date *</label>
        <input type="date" style={l.input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
      </div>
      {form.entry_type === 'manual' ? (
        <div style={l.formGroup}>
          <label style={l.label}>Miles *</label>
          <input type="number" style={l.input} step="0.1" min="0" value={form.miles} onChange={(e) => setForm({ ...form, miles: e.target.value })} required placeholder="e.g., 25.5" />
        </div>
      ) : (
        <div style={l.row}>
          <div style={l.formGroup}>
            <label style={l.label}>Start Odometer *</label>
            <input type="number" style={l.input} step="0.1" min="0" value={form.odometer_start} onChange={(e) => setForm({ ...form, odometer_start: e.target.value })} required placeholder="e.g., 45230.5" />
          </div>
          <div style={l.formGroup}>
            <label style={l.label}>End Odometer *</label>
            <input type="number" style={l.input} step="0.1" min="0" value={form.odometer_end} onChange={(e) => setForm({ ...form, odometer_end: e.target.value })} required placeholder="e.g., 45256.0" />
          </div>
        </div>
      )}
      <div style={l.formGroup}>
        <label style={l.label}>Description</label>
        <input type="text" style={l.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., Round trip to Winterland Arena" />
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>IRS Rate ($/mile)</label>
        <input type="number" style={l.input} step="0.005" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Your default rate: {formatMoney(defaultRate)}/mile (change it in Settings)
          {settings.vehicle_expense_method === 'actual' && ' • Vehicle method is Actual Expenses, so mileage is not deducted in the P&L.'}
        </div>
      </div>
      {preview && (
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginTop: 8 }}>
          <strong>Miles:</strong> {preview.miles.toFixed(1)}<br />
          <strong>Deduction:</strong> {formatMoney(preview.amount)}
        </div>
      )}
      {form.entry_type === 'odometer' && form.odometer_start !== '' && form.odometer_end !== '' && !preview && (
        <div style={l.error}>End odometer must be greater than start</div>
      )}
    </Modal>
  );
}
