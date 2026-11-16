import { useState } from 'react';
import { useApp } from '../context.jsx';
import ClientModal from '../modals/ClientModal.jsx';
import StudentModal from '../modals/StudentModal.jsx';
import { levelSummary } from '../lib/levels.js';
import { deleteStudent } from './StudentsView.jsx';

/** Client-role "My Students" tab (legacy `Ty`): the signed-in parent's own students (RLS-scoped). */
export default function MyStudentsView() {
  const app = useApp();
  const { data, styles: l, toast } = app;
  const { clients, students } = data;
  const [modal, setModal] = useState(null); // { type: 'client', client } | { type: 'student', student }
  const me = clients[0] || null;

  const addStudent = () => {
    if (!me) { toast('Please add your contact info first'); setModal({ type: 'client', client: null }); return; }
    setModal({ type: 'student', student: null });
  };

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>My Students</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {me && (
            <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => setModal({ type: 'client', client: me })}>Edit My Info</button>
          )}
          <button style={{ ...l.btn, ...l.btnPrimary }} onClick={addStudent}>+ Add Student</button>
        </div>
      </div>

      {clients.length === 0 && (
        <div style={{ marginBottom: 16, padding: 16, background: '#fef3c7', borderRadius: 8 }}>
          <strong>First, add your contact info:</strong>
          <button style={{ ...l.btn, ...l.btnPrimary, marginLeft: 12 }} onClick={() => setModal({ type: 'client', client: null })}>
            Add My Info
          </button>
        </div>
      )}

      {students.length === 0 ? (
        <div style={l.empty}>No students added yet.</div>
      ) : (
        <div>
          {students.map((s) => {
            const summary = levelSummary(s);
            return (
              <div key={s.id} style={l.listItem}>
                <div>
                  <strong>{s.name}</strong>
                  {summary && <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{summary}</div>}
                </div>
                <div style={{ whiteSpace: 'nowrap' }}>
                  <button style={{ ...l.btn, ...l.btnSmall, ...l.btnSecondary, marginRight: 8 }} onClick={() => setModal({ type: 'student', student: s })}>
                    Edit
                  </button>
                  <button style={{ ...l.btn, ...l.btnSmall, ...l.btnDanger }} onClick={() => deleteStudent(app, s.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === 'client' && <ClientModal client={modal.client} onClose={() => setModal(null)} />}
      {modal?.type === 'student' && (
        <StudentModal student={modal.student} clientId={me?.id ?? null} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
