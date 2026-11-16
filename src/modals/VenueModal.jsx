import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';

export const DEFAULT_VENUE_COLOR = '#6366f1';

/** Delete a venue (shared by the list and the modal). Returns true when deleted. */
export async function deleteVenue({ supabase, reload, toast }, id) {
  if (!confirm('Delete this venue?')) return false;
  try {
    const { error } = await supabase.from('venues').delete().eq('id', id);
    if (error) throw error;
    await reload();
    toast('Venue deleted');
    return true;
  } catch (e) {
    toast('Error: ' + e.message);
    return false;
  }
}

export default function VenueModal({ venue = null, onClose }) {
  const app = useApp();
  const { styles: l, supabase, reload, toast } = app;
  const [form, setForm] = useState({
    name: venue?.name || '',
    address: venue?.address || '',
    color: venue?.color || DEFAULT_VENUE_COLOR,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const payload = { name: form.name.trim(), address: form.address.trim(), color: form.color || DEFAULT_VENUE_COLOR };
    if (!payload.name) { toast('Please enter a venue name'); return; }
    setBusy(true);
    try {
      if (venue) {
        const { error } = await supabase.from('venues').update(payload).eq('id', venue.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('venues').insert(payload);
        if (error) throw error;
      }
      await reload();
      toast(venue ? 'Venue updated' : 'Venue added');
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => { if (await deleteVenue(app, venue.id)) onClose(); };

  return (
    <Modal
      title={venue ? 'Edit Venue' : 'New Venue'}
      onClose={onClose}
      footer={<>
        {venue && <button style={{ ...l.btn, ...l.btnDanger, marginRight: 'auto' }} onClick={remove}>Delete</button>}
        <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
        <button style={{ ...l.btn, ...l.btnPrimary }} onClick={save} disabled={busy}>Save</button>
      </>}
    >
      <div style={l.formGroup}>
        <label style={l.label}>Venue Name *</label>
        <input type="text" style={l.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Winterland Ice Arena" required />
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Address</label>
        <input type="text" style={l.input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Ice Way, Skating City, ST 12345" />
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Color (for calendar dot)</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" style={{ width: 60, height: 40, border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
            value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <span style={{ fontSize: 13, color: '#64748b' }}>A small dot in this color will appear on lessons at this venue</span>
        </div>
      </div>
    </Modal>
  );
}
