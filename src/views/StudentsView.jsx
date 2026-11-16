import { useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import StudentModal from '../modals/StudentModal.jsx';
import { levelsByProgram } from '../lib/levels.js';
import { formatDate } from '../lib/format.js';

/** Delete a student (legacy `ic`). Shared with MyStudentsView. */
export async function deleteStudent({ supabase, reload, toast }, id) {
  if (!confirm('Delete this student?')) return;
  try {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;
    await reload();
    toast('Student deleted');
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

const dash = (v) => v || '-';

/** Students tab (coach). Legacy `_y`, now showing real ISI / USFSA / Learn to Skate USA levels. */
export default function StudentsView() {
  const app = useApp();
  const { data, styles: l, isMobile } = app;
  const { clients, students } = data;
  const [modal, setModal] = useState(null); // { student } | { student: null }
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const q = search.trim().toLowerCase();
  const shown = useMemo(() => students.filter((s) => {
    if (clientFilter && String(s.client_id) !== clientFilter) return false;
    if (!q) return true;
    const lv = levelsByProgram(s);
    return [s.name, s.email, clientById.get(s.client_id)?.name, lv.ISI, lv.USFSA, lv.LTS]
      .some((v) => String(v || '').toLowerCase().includes(q));
  }), [students, clientFilter, q, clientById]);

  const btnS = { ...l.btn, ...l.btnSmall, ...l.btnSecondary, marginRight: 8 };
  const btnD = { ...l.btn, ...l.btnSmall, ...l.btnDanger };

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>Students</h2>
        <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => setModal({ student: null })}>+ Add Student</button>
      </div>

      {students.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexDirection: isMobile ? 'column' : 'row' }}>
          <input type="search" style={{ ...l.input, flex: 2 }} placeholder="Search students, parents, levels..."
            value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
          <select style={{ ...l.select, flex: 1 }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Filter by client">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
      )}

      {students.length === 0 ? (
        <div style={l.empty}>No students yet. Add students to your clients!</div>
      ) : shown.length === 0 ? (
        <div style={l.empty}>No students match your search.</div>
      ) : isMobile ? (
        <div>
          {shown.map((s) => {
            const lv = levelsByProgram(s);
            return (
              <div key={s.id} style={{ ...l.listItem, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div>
                  <strong>{s.name}</strong>
                  <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{clientById.get(s.client_id)?.name || '-'}</div>
                  {lv.ISI && <div style={{ fontSize: 13 }}><span style={{ color: '#1e40af' }}>ISI:</span> {lv.ISI}</div>}
                  {lv.USFSA && <div style={{ fontSize: 13 }}><span style={{ color: '#047857' }}>USFSA:</span> {lv.USFSA}</div>}
                  {lv.LTS && <div style={{ fontSize: 13 }}><span style={{ color: '#b45309' }}>LTS:</span> {lv.LTS}</div>}
                </div>
                <div>
                  <button style={btnS} onClick={() => setModal({ student: s })}>Edit</button>
                  <button style={btnD} onClick={() => deleteStudent(app, s.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={l.table}>
            <thead>
              <tr>
                <th style={l.th}>Name</th>
                <th style={l.th}>Parent/Client</th>
                <th style={l.th}>Birthdate</th>
                <th style={l.th}>ISI Level</th>
                <th style={l.th}>USFSA Level</th>
                <th style={l.th}>Learn to Skate</th>
                <th style={l.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const lv = levelsByProgram(s);
                return (
                  <tr key={s.id}>
                    <td style={l.td}><strong>{s.name}</strong></td>
                    <td style={l.td}>{clientById.get(s.client_id)?.name || '-'}</td>
                    <td style={l.td}>{s.birthdate ? formatDate(s.birthdate) : '-'}</td>
                    <td style={l.td}>{dash(lv.ISI)}</td>
                    <td style={l.td}>{dash(lv.USFSA)}</td>
                    <td style={l.td}>{dash(lv.LTS)}</td>
                    <td style={{ ...l.td, whiteSpace: 'nowrap' }}>
                      <button style={btnS} onClick={() => setModal({ student: s })}>Edit</button>
                      <button style={btnD} onClick={() => deleteStudent(app, s.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <StudentModal student={modal.student} onClose={() => setModal(null)} />}
    </div>
  );
}
