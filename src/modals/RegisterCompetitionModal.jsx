import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { formatDate } from '../lib/format.js';

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Active (non-cancelled) registration of a student for an event, if any. */
export const findRegistration = (bookings, eventId, studentId) =>
  bookings.find((b) => sameId(b.event_id, eventId) && sameId(b.student_id, studentId) && b.status !== 'cancelled');

export default function RegisterCompetitionModal({ event, onClose }) {
  const { styles: l, supabase, reload, toast, notify, data, profile, isCoach } = useApp();
  const [studentId, setStudentId] = useState('');
  const [busy, setBusy] = useState(false);

  const register = async () => {
    // Look the student up by id (ids are bigint numbers; never parseInt arbitrary values).
    const student = data.students.find((s) => sameId(s.id, studentId));
    if (!student) { toast('Please select a student'); return; }
    if (findRegistration(data.bookings, event.id, student.id)) { toast('Student already registered'); return; }
    setBusy(true);
    try {
      // Re-activate a previously cancelled registration instead of creating a duplicate row.
      const cancelled = data.bookings.find((b) => sameId(b.event_id, event.id) && sameId(b.student_id, student.id) && b.status === 'cancelled');
      if (cancelled) {
        const { error } = await supabase.from('bookings')
          .update({ status: 'confirmed', cancelled_at: null, is_late_cancellation: false, booked_by: profile.id })
          .eq('id', cancelled.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bookings').insert({
          event_id: event.id, student_id: student.id, booked_by: profile.id, status: 'confirmed',
        });
        if (error) throw error;
      }
      // Clients registering their own students notify the coach (the old app only notified when the COACH registered).
      if (!isCoach) {
        await notify('registration', `${student.name} registered for ${event.name}`, { eventId: event.id, studentId: student.id });
      }
      await reload();
      toast('Registered for competition!');
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Register for ${event.name}`}
      onClose={onClose}
      footer={<>
        <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
        <button style={{ ...l.btn, ...l.btnSuccess, ...(!studentId || busy ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }} onClick={register} disabled={!studentId || busy}>Register</button>
      </>}
    >
      <div style={l.formGroup}>
        <label style={l.label}>Select Student</label>
        <select style={l.select} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Choose a student...</option>
          {data.students.map((s) => {
            const taken = !!findRegistration(data.bookings, event.id, s.id);
            return <option key={s.id} value={s.id} disabled={taken}>{s.name} {taken ? '(already registered)' : ''}</option>;
          })}
        </select>
      </div>
      <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
        <strong>Event:</strong> {event.name}<br />
        <strong>Date:</strong> {formatDate(event.start_date)}
        {event.end_date && event.end_date !== event.start_date && ` - ${formatDate(event.end_date)}`}
      </div>
    </Modal>
  );
}
