import { useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { getLessonTypes, findLessonType, makeCustomLessonType, validateLesson, hhmm } from '../lib/calendar.js';
import { activeBookings, friendlyBookingError, bookingStatusInfo } from '../lib/booking.js';
import { toISODate } from '../lib/format.js';
import { DEFAULT_LESSON_TYPES } from '../lib/constants.js';

const EMPTY_TYPE = { name: '', icon: '📚', color: '#3b82f6', max: 1, rate: 50 };

/**
 * Coach: create / edit / delete a lesson and book students onto it.
 * Props: lesson (existing row or null), date (YYYY-MM-DD for a new lesson), onClose, onCancelBooking(booking).
 */
export default function LessonModal({ lesson, date, onClose, onCancelBooking }) {
  const { supabase, data, settings, saveSettings, reload, toast, styles: l, profile } = useApp();
  const types = useMemo(() => getLessonTypes(settings.custom_lesson_types), [settings.custom_lesson_types]);
  const { venues, students, clients, bookings } = data;

  const [form, setForm] = useState(() => {
    if (lesson) {
      return {
        date: lesson.date,
        start_time: hhmm(lesson.start_time),
        end_time: hhmm(lesson.end_time),
        lesson_type: lesson.lesson_type,
        venue_id: lesson.venue_id ?? '',
        max_students: lesson.max_students,
        is_published: !!lesson.is_published,
        notes: lesson.notes || '',
        rate: lesson.rate ?? findLessonType(types, lesson.lesson_type).rate,
        student_ids: [],
      };
    }
    const t = findLessonType(types, 'private');
    return {
      date: date || toISODate(new Date()),
      start_time: '09:00',
      end_time: '09:30',
      lesson_type: t.id,
      venue_id: venues[0]?.id ?? '',
      max_students: t.max,
      is_published: true,
      notes: '',
      rate: t.rate,
      student_ids: [],
    };
  });
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState(EMPTY_TYPE);
  const [busy, setBusy] = useState(false);

  const existing = lesson ? activeBookings(bookings, lesson.id) : [];
  const bookedIds = new Set(existing.map((b) => b.student_id));
  const history = lesson ? bookings.filter((b) => b.lesson_id === lesson.id && b.status === 'cancelled') : [];
  const capacityLeft = (Number(form.max_students) || 0) - existing.length - form.student_ids.length;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const studentLabel = (s) => {
    const c = clients.find((x) => x.id === s?.client_id);
    return `${s?.name || 'Unknown'}${c ? ` (${c.name})` : ''}`;
  };

  const onTypeChange = (value) => {
    if (value === '__add_new__') { setAddingType(true); return; }
    const t = findLessonType(types, value);
    set({ lesson_type: value, max_students: t.max, rate: t.rate });
  };

  const addType = async () => {
    const { type, error } = makeCustomLessonType(newType);
    if (error) { toast(error); return; }
    try {
      const custom = types.filter((t) => !DEFAULT_LESSON_TYPES.some((d) => d.id === t.id));
      await saveSettings({ custom_lesson_types: [...custom, type] });
      set({ lesson_type: type.id, max_students: type.max, rate: type.rate });
      setNewType(EMPTY_TYPE);
      setAddingType(false);
      toast('Custom lesson type saved');
    } catch (e) {
      toast('Error saving: ' + e.message);
    }
  };

  const save = async () => {
    const err = validateLesson(form, { activeBookings: existing.length });
    if (err) { toast(err); return; }
    setBusy(true);
    try {
      const { student_ids: ids, ...rest } = form;
      const row = {
        ...rest,
        venue_id: rest.venue_id === '' || rest.venue_id == null ? null : Number(rest.venue_id),
        max_students: Number(rest.max_students),
        rate: Number(rest.rate),
      };
      let lessonId;
      let msg;
      if (lesson) {
        const { error } = await supabase.from('lessons').update(row).eq('id', lesson.id);
        if (error) throw error;
        lessonId = lesson.id;
        msg = 'Lesson updated';
      } else {
        const { data: created, error } = await supabase.from('lessons').insert(row).select().single();
        if (error) throw error;
        lessonId = created.id;
        msg = 'Lesson created';
      }
      if (ids.length > 0) {
        let ok = 0;
        const failures = [];
        for (const sid of ids) {
          const { error } = await supabase.from('bookings')
            .insert({ lesson_id: lessonId, student_id: sid, booked_by: profile.id, status: 'confirmed' });
          if (error) failures.push(`${studentLabel(students.find((s) => s.id === sid))}: ${friendlyBookingError(error)}`);
          else ok++;
        }
        msg = failures.length
          ? `Lesson saved but error booking students: ${failures.join('; ')}`
          : `Lesson saved with ${ok} student(s) booked`;
      }
      await reload();
      toast(msg);
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const warn = existing.length ? `\n\n${existing.length} student(s) are booked on this lesson.` : '';
    if (!window.confirm(`Delete this lesson?${warn}`)) return;
    try {
      const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
      if (error) throw error;
      await reload();
      toast('Lesson deleted');
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };

  const small = { ...l.input, fontSize: 13, padding: '6px 10px' };
  const footer = (
    <>
      {lesson && <button style={{ ...l.btn, ...l.btnDanger, marginRight: 'auto' }} onClick={remove}>Delete</button>}
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
      <button style={{ ...l.btn, ...l.btnPrimary }} onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
    </>
  );

  return (
    <Modal title={lesson ? 'Edit Lesson' : 'New Lesson'} onClose={onClose} footer={footer}>
      <div style={l.formGroup}>
        <label style={l.label}>Date</label>
        <input type="date" style={l.input} value={form.date} onChange={(e) => set({ date: e.target.value })} />
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Start Time</label>
          <input type="time" style={l.input} value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} />
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>End Time</label>
          <input type="time" style={l.input} value={form.end_time} onChange={(e) => set({ end_time: e.target.value })} />
        </div>
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Lesson Type</label>
          <select style={l.select} value={form.lesson_type} onChange={(e) => onTypeChange(e.target.value)}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            {!types.some((t) => t.id === form.lesson_type) && <option value={form.lesson_type}>{form.lesson_type}</option>}
            <option value="__add_new__">➕ Add New Type...</option>
          </select>
          {addingType && (
            <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Add Custom Lesson Type</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input type="text" placeholder="Name" style={small} value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} />
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8 }}>
                  <input type="text" placeholder="📚" aria-label="Icon" style={{ ...small, textAlign: 'center' }} value={newType.icon} onChange={(e) => setNewType({ ...newType, icon: e.target.value })} />
                  <input type="color" aria-label="Color" style={{ width: '100%', height: 32, border: '1px solid #e2e8f0', borderRadius: 4 }} value={newType.color} onChange={(e) => setNewType({ ...newType, color: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="number" placeholder="Max students" aria-label="Max students" min={1} style={small} value={newType.max} onChange={(e) => setNewType({ ...newType, max: e.target.value })} />
                  <input type="number" placeholder="Rate" aria-label="Rate" step="0.01" min={0} style={small} value={newType.rate} onChange={(e) => setNewType({ ...newType, rate: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button style={{ ...l.btn, ...l.btnPrimary, flex: 1, padding: '6px 12px', fontSize: 13 }} onClick={addType}>Add Type</button>
                  <button style={{ ...l.btn, ...l.btnSecondary, flex: 1, padding: '6px 12px', fontSize: 13 }} onClick={() => { setAddingType(false); setNewType(EMPTY_TYPE); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Max Students</label>
          <input type="number" style={l.input} min={1} value={Number.isFinite(form.max_students) ? form.max_students : ''}
            onChange={(e) => set({ max_students: parseInt(e.target.value, 10) })} />
        </div>
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Venue</label>
          <select style={l.select} value={form.venue_id} onChange={(e) => set({ venue_id: e.target.value === '' ? '' : Number(e.target.value) })}>
            <option value="">Select venue...</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Rate ($)</label>
          <input type="number" style={l.input} step="0.01" min={0} value={form.rate} onChange={(e) => set({ rate: e.target.value === '' ? '' : parseFloat(e.target.value) })} />
        </div>
      </div>
      <div style={l.formGroup}>
        <label style={{ ...l.label, display: 'flex', alignItems: 'center' }}>
          <input type="checkbox" style={l.checkbox} checked={form.is_published} onChange={(e) => set({ is_published: e.target.checked })} />
          Published (visible for booking)
        </label>
      </div>

      <div style={l.formGroup}>
        <label style={l.label}>Assign Student</label>
        {existing.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {existing.map((b) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, marginBottom: 4, gap: 8 }}>
                <span style={{ fontWeight: 500 }}>✅ {studentLabel(students.find((s) => s.id === b.student_id))}</span>
                <button style={{ ...l.btn, ...l.btnDanger, ...l.btnSmall }} onClick={() => onCancelBooking(b)}>Cancel Booking</button>
              </div>
            ))}
          </div>
        )}
        <select style={l.select} value="" disabled={capacityLeft <= 0}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id && !form.student_ids.includes(id) && !bookedIds.has(id) && capacityLeft > 0) set({ student_ids: [...form.student_ids, id] });
          }}>
          <option value="">{capacityLeft <= 0 ? 'Lesson is full' : 'Select student to assign...'}</option>
          {students.filter((s) => !form.student_ids.includes(s.id) && !bookedIds.has(s.id)).map((s) => (
            <option key={s.id} value={s.id}>{studentLabel(s)}</option>
          ))}
        </select>
        {form.student_ids.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {form.student_ids.map((id) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#eff6ff', borderRadius: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{studentLabel(students.find((s) => s.id === id))}</span>
                <button aria-label="Remove" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, fontWeight: 600 }}
                  onClick={() => set({ student_ids: form.student_ids.filter((x) => x !== id) })}>✕</button>
              </div>
            ))}
          </div>
        )}
        {students.length === 0 && (
          <div style={{ padding: 12, background: '#fef3c7', borderRadius: 6, color: '#92400e', fontSize: 13, marginTop: 8 }}>
            No students yet. Add from Students tab first.
          </div>
        )}
        {history.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
            Cancelled: {history.map((b) => {
              const st = bookingStatusInfo(b);
              return `${students.find((s) => s.id === b.student_id)?.name || 'Unknown'} (${st.label})`;
            }).join(', ')}
          </div>
        )}
      </div>

      <div style={{ ...l.formGroup, marginBottom: 0 }}>
        <label style={l.label}>Notes</label>
        <textarea style={l.textarea} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
    </Modal>
  );
}
