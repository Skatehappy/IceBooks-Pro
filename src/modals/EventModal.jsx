import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { toISODate } from '../lib/format.js';
import { EVENT_TYPES } from '../lib/constants.js';

/** Delete an event (shared by the list and the modal). Returns true when deleted. */
export async function deleteEvent({ supabase, reload, toast }, id) {
  if (!confirm('Delete this event?')) return false;
  try {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
    await reload();
    toast('Event deleted');
    return true;
  } catch (e) {
    toast('Error: ' + e.message);
    return false;
  }
}

/** Validate an event form and build its payload. Returns { payload } or { error }. */
export const buildEventPayload = (form) => {
  const name = (form.name || '').trim();
  if (!name) return { error: 'Please enter an event name' };
  if (!form.start_date) return { error: 'Please enter a start date' };
  const end = form.end_date || form.start_date;
  if (end < form.start_date) return { error: 'End date must be on or after the start date' };
  return {
    payload: {
      name,
      event_type: form.event_type || 'competition',
      start_date: form.start_date,
      end_date: end,
      venue_id: form.venue_id === '' || form.venue_id == null ? null : Number(form.venue_id),
      notes: (form.notes || '').trim(),
      is_registrable: !!form.is_registrable,
    },
  };
};

export default function EventModal({ event = null, defaultDate = null, onClose }) {
  const app = useApp();
  const { styles: l, supabase, reload, toast, data } = app;
  const [form, setForm] = useState(() => {
    if (event) {
      return {
        name: event.name || '', event_type: event.event_type || 'competition', start_date: event.start_date,
        end_date: event.end_date || event.start_date, venue_id: event.venue_id ?? '', notes: event.notes || '',
        is_registrable: !!event.is_registrable,
      };
    }
    const d = defaultDate || toISODate(new Date());
    return { name: '', event_type: 'competition', start_date: d, end_date: d, venue_id: '', notes: '', is_registrable: false };
  });
  const [busy, setBusy] = useState(false);

  const setStart = (v) => setForm((f) => ({ ...f, start_date: v, end_date: !f.end_date || f.end_date < v ? v : f.end_date }));

  const save = async () => {
    const { payload, error: invalid } = buildEventPayload(form);
    if (invalid) { toast(invalid); return; }
    setBusy(true);
    try {
      if (event) {
        const { error } = await supabase.from('events').update(payload).eq('id', event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
      }
      await reload();
      toast(event ? 'Event updated' : 'Event created');
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => { if (await deleteEvent(app, event.id)) onClose(); };

  return (
    <Modal
      title={event ? 'Edit Event' : 'New Event'}
      onClose={onClose}
      footer={<>
        {event && <button style={{ ...l.btn, ...l.btnDanger, marginRight: 'auto' }} onClick={remove}>Delete</button>}
        <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
        <button style={{ ...l.btn, ...l.btnPrimary }} onClick={save} disabled={busy}>Save</button>
      </>}
    >
      <div style={l.formGroup}>
        <label style={l.label}>Event Name</label>
        <input type="text" style={l.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Winter Classic" />
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Event Type</label>
        <select style={l.select} value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
          {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Start Date</label>
          <input type="date" style={l.input} value={form.start_date} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>End Date</label>
          <input type="date" style={l.input} value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </div>
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Venue</label>
        <select style={l.select} value={form.venue_id} onChange={(e) => setForm({ ...form, venue_id: e.target.value })}>
          <option value="">Select venue...</option>
          {data.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div style={l.formGroup}>
        <label style={{ ...l.label, display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" style={l.checkbox} checked={form.is_registrable} onChange={(e) => setForm({ ...form, is_registrable: e.target.checked })} />
          Allow student registration
        </label>
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Notes</label>
        <textarea style={l.textarea} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </Modal>
  );
}
