import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';

const CLIENT_KEYS = ['name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'parent2_name', 'parent2_email', 'parent2_phone', 'notes'];

const initForm = (c) => {
  const f = {};
  for (const k of CLIENT_KEYS) f[k] = (c && c[k]) || '';
  if (!c) Object.assign(f, { child_name: '', child_email: '', child_birthdate: '' });
  return f;
};

/**
 * Add / edit a client (parent / billing contact). Legacy handlers ma/ey/ty.
 * New client: child_name -> student created for that child; no child_name -> "Adult student" record.
 */
export default function ClientModal({ client = null, onClose }) {
  const { supabase, isCoach, profile, reload, toast, styles: l } = useApp();
  const [f, setF] = useState(() => initForm(client));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const hr = <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />;

  const input = (label, key, type = 'text', extra = {}) => (
    <div style={l.formGroup}>
      <label style={l.label}>{label}</label>
      <input type={type} style={l.input} value={f[key]} onChange={set(key)} {...extra} />
    </div>
  );

  const save = async () => {
    if (!f.name.trim()) { toast('Please enter a name'); return; }
    setSaving(true);
    try {
      const { child_name: childName = '', child_email: childEmail = '', child_birthdate: childBirth = '', ...rest } = f;
      const rec = {};
      for (const k of CLIENT_KEYS) rec[k] = String(rest[k] ?? '').trim();
      rec.email = rec.email ? rec.email.toLowerCase() : null; // null keeps the per-coach unique email index happy
      if (!isCoach && !client) rec.profile_id = profile.id;
      let clientId = client?.id;
      if (client) {
        const { error } = await supabase.from('clients').update(rec).eq('id', client.id);
        if (error) throw error;
        toast('Client updated');
      } else {
        const { data, error } = await supabase.from('clients').insert(rec).select().single();
        if (error) {
          if (error.code === '23505') throw new Error('A client with this email already exists');
          throw error;
        }
        clientId = data.id;
        toast('Client added');
        const cn = childName.trim();
        if (cn) {
          const { error: se } = await supabase.from('students').insert({
            client_id: clientId, name: cn, email: childEmail.trim() || null, birthdate: childBirth || null, notes: '',
          });
          toast(se ? 'Client saved but student creation failed: ' + se.message : `Student created for ${cn} - Edit student to add skill levels`);
        } else {
          const { error: se } = await supabase.from('students').insert({
            client_id: clientId, name: rec.name, email: rec.email || null, birthdate: null, notes: 'Adult student',
          });
          if (se) console.error('Student insert error:', se);
          toast(se ? 'Client saved but student creation failed: ' + se.message : 'Student record created - Edit to add skill levels');
        }
      }
      await reload();
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this client and all their students?')) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;
      await reload();
      toast('Client deleted');
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };

  const footer = (
    <>
      {client && isCoach && (
        <button style={{ ...l.btn, ...l.btnDanger, marginRight: 'auto' }} onClick={remove}>Delete</button>
      )}
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
      <button style={{ ...l.btn, ...l.btnPrimary }} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </>
  );

  return (
    <Modal title={client ? 'Edit Client' : 'New Client'} onClose={onClose} full footer={footer}>
      {input('Name *', 'name', 'text', { required: true, autoFocus: true })}
      <div style={l.row}>
        {input('Email', 'email', 'email')}
        {input('Phone', 'phone', 'tel')}
      </div>
      {input('Address', 'address')}
      <div style={l.row}>
        {input('City', 'city')}
        {input('State', 'state')}
      </div>
      {input('ZIP', 'zip')}
      {hr}
      <h4 style={{ marginBottom: 12 }}>Second Parent/Guardian (Optional)</h4>
      {input('Name', 'parent2_name')}
      <div style={l.row}>
        {input('Email', 'parent2_email', 'email')}
        {input('Phone', 'parent2_phone', 'tel')}
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Notes</label>
        <textarea style={l.textarea} value={f.notes} onChange={set('notes')} />
      </div>
      {!client && (
        <>
          {hr}
          <h4 style={{ marginBottom: 8 }}>Student Information (Optional)</h4>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            Add child's name to auto-create student record. Leave blank if client is the student (adult).
          </p>
          <div style={l.row}>
            {input('Child/Student Name', 'child_name', 'text', { placeholder: 'Leave blank if client is the student' })}
            {input('Child Birthdate', 'child_birthdate', 'date')}
          </div>
          {input('Child Email (for self-login)', 'child_email', 'email')}
        </>
      )}
    </Modal>
  );
}
