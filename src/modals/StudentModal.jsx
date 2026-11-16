import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { PROGRAMS, groupsBySection, flatOptions, blankStudentForm, LEGACY_LEVEL_MOVES } from '../lib/levels.js';

const initForm = (student, clientId, clients) => {
  const f = blankStudentForm(clientId ?? clients[0]?.id ?? '');
  if (!student) return f;
  for (const k of Object.keys(f)) f[k] = student[k] ?? f[k];
  f.client_id = student.client_id;
  f.birthdate = student.birthdate ? String(student.birthdate).slice(0, 10) : '';
  // Old "USFSA Basic 1-6" values were Learn to Skate USA Basic levels: show them in their real place.
  for (const [from, to] of Object.entries(LEGACY_LEVEL_MOVES)) {
    if (student[from] && !f[to]) f[to] = student[from];
  }
  return f;
};

/** Add / edit a student with every ISI, U.S. Figure Skating and Learn to Skate USA level dropdown. */
export default function StudentModal({ student = null, clientId = null, onClose }) {
  const { supabase, data, reload, toast, styles: l, isMobile } = useApp();
  const clients = data.clients;
  const [f, setF] = useState(() => initForm(student, clientId, clients));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const grid = (cols) => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${cols}, 1fr)`, gap: isMobile ? 12 : 20, marginBottom: 20 });

  const select = (g, color) => {
    const opts = flatOptions(g);
    const legacy = f[g.key] && !opts.includes(f[g.key]) ? f[g.key] : null;
    return (
      <div style={l.formGroup} key={g.key}>
        <label style={{ ...l.label, color }}>{g.label}</label>
        <select style={l.select} value={f[g.key] || ''} onChange={set(g.key)}>
          <option value="">Select...</option>
          {legacy && <option value={legacy}>{`${legacy} (previous value)`}</option>}
          {g.options.map((o) => (typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : (
              <optgroup key={o.label} label={o.label}>
                {o.options.map((x) => <option key={x} value={x}>{x}</option>)}
              </optgroup>
            )))}
        </select>
      </div>
    );
  };

  const save = async () => {
    const d = { ...f };
    const client = clients.find((c) => String(c.id) === String(d.client_id));
    if (!client) { toast('Please select a parent/client'); return; }
    if (!d.name || !d.name.trim()) {
      d.name = client.name;
      if (!d.email || !d.email.trim()) d.email = client.email || '';
    }
    if (!d.name || !d.name.trim()) { toast('Please enter a student name'); return; }
    d.client_id = client.id;
    d.name = d.name.trim();
    d.email = (d.email || '').trim() || null;
    d.birthdate = d.birthdate || null;
    // Legacy column moved to lts_basic_skills: clear the old copy once it has been carried over.
    if (student) for (const [from, to] of Object.entries(LEGACY_LEVEL_MOVES)) if (student[from] && d[to]) d[from] = '';
    setSaving(true);
    try {
      if (student) {
        const { error } = await supabase.from('students').update(d).eq('id', student.id);
        if (error) throw error;
        toast('Student updated');
      } else {
        const { error } = await supabase.from('students').insert(d);
        if (error) throw error;
        toast('Student added');
      }
      await reload();
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
      <button style={{ ...l.btn, ...l.btnPrimary }} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </>
  );

  return (
    <Modal title={student ? 'Edit Student' : 'New Student'} onClose={onClose} full footer={footer}>
      <div style={{ padding: isMobile ? 0 : 20 }}>
        <div style={grid(2)}>
          <div style={l.formGroup}>
            <label style={l.label}>Parent/Client *</label>
            <select style={l.select} value={f.client_id} onChange={set('client_id')} required>
              <option value="">Select parent...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={l.formGroup}>
            <label style={l.label}>Student Name *</label>
            <input type="text" style={l.input} value={f.name} onChange={set('name')} placeholder="Enter student name" />
          </div>
        </div>
        <div style={grid(2)}>
          <div style={l.formGroup}>
            <label style={l.label}>Email (Optional)</label>
            <input type="email" style={l.input} value={f.email || ''} onChange={set('email')} placeholder="Optional" />
          </div>
          <div style={l.formGroup}>
            <label style={l.label}>Birthdate</label>
            <input type="date" style={l.input} value={f.birthdate || ''} onChange={set('birthdate')} />
          </div>
        </div>

        {PROGRAMS.map((p, pi) => {
          const sections = groupsBySection(p.id);
          const cols = p.id === 'ISI' ? 4 : 3;
          return (
            <section key={p.id} aria-label={p.title}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
                flexDirection: isMobile ? 'column' : 'row', marginTop: pi === 0 ? 0 : 40, marginBottom: 20, gap: 12,
              }}>
                <h3 style={{ margin: 0, color: p.color, fontSize: 20, fontWeight: 600 }}>{p.title}</h3>
                <div style={{ ...l.formGroup, width: isMobile ? '100%' : 400, margin: 0 }}>
                  <label style={{ ...l.label, color: p.color, fontWeight: 600 }}>{p.numberLabel}</label>
                  <input type="text" style={l.input} value={f[p.numberKey] || ''} onChange={set(p.numberKey)}
                    placeholder={`Enter ${p.numberLabel.replace(' Number', ' number')}`} />
                </div>
              </div>
              <hr style={{ border: 'none', borderTop: `3px solid ${p.color}`, marginBottom: 20 }} />
              {sections.map((s) => (
                <div key={s.section}>
                  {sections.length > 1 && (
                    <h4 style={{ margin: '8px 0 12px', color: p.color, fontSize: 16, fontWeight: 600 }}>{s.section}</h4>
                  )}
                  <div style={grid(cols)}>{s.groups.map((g) => select(g, p.color))}</div>
                </div>
              ))}
            </section>
          );
        })}

        <div style={{ ...l.formGroup, marginTop: 20 }}>
          <label style={l.label}>Notes</label>
          <textarea style={{ ...l.textarea, minHeight: 100 }} value={f.notes || ''} onChange={set('notes')} />
        </div>
      </div>
    </Modal>
  );
}
