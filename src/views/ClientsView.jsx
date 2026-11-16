import { useMemo, useRef, useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import ClientModal from '../modals/ClientModal.jsx';
import StudentModal from '../modals/StudentModal.jsx';
import {
  downloadTemplateCsv, downloadTemplateXlsx, readImportFile, planFromMatrix, applyImportPlan, normName,
} from '../lib/clientImport.js';

const matches = (q, ...vals) => vals.some((v) => String(v || '').toLowerCase().includes(q));

function ImportSummary({ stage, plan, result, fileName, busy, onConfirm, onClose }) {
  const { styles: l } = useApp();
  const counts = result
    ? [
      ['Rows read', plan.counts.rowsRead],
      ['Clients created', result.clientsCreated],
      ['Students created', result.studentsCreated],
      ['  of which added to existing clients', result.studentsAddedToExisting],
      ['Duplicate clients skipped', result.duplicateClients],
      ['Duplicate students skipped', result.duplicateStudents],
      ['Rows with errors', result.errors.length],
    ]
    : [
      ['Rows read', plan.counts.rowsRead],
      ['Clients to create', plan.counts.clientsCreated],
      ['Students to create', plan.counts.studentsCreated],
      ['  of which added to existing clients', plan.counts.studentsAddedToExisting],
      ['Duplicate clients (will be skipped)', plan.counts.duplicateClients],
      ['Duplicate students (will be skipped)', plan.counts.duplicateStudents],
      ['Rows with errors', plan.errors.length],
    ];
  const errors = result ? result.errors : plan.errors;
  const nothing = plan.counts.clientsCreated === 0 && plan.counts.studentsCreated === 0;
  const footer = stage === 'preview' ? (
    <>
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose} disabled={busy}>Cancel</button>
      <button style={{ ...l.btn, ...l.btnPrimary }} onClick={onConfirm} disabled={busy || nothing}>
        {busy ? 'Importing...' : nothing ? 'Nothing to import' : 'Import'}
      </button>
    </>
  ) : (
    <button style={{ ...l.btn, ...l.btnPrimary }} onClick={onClose}>Done</button>
  );
  return (
    <Modal title={stage === 'preview' ? `Import preview - ${fileName}` : 'Import complete'} onClose={busy ? () => {} : onClose} footer={footer}>
      <table style={l.table}>
        <tbody>
          {counts.map(([k, v]) => (
            <tr key={k}>
              <td style={{ ...l.td, ...(k.startsWith('  ') ? { paddingLeft: 28, color: '#64748b' } : {}) }}>{k.trim()}</td>
              <td style={{ ...l.td, textAlign: 'right', fontWeight: 600 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {plan.unknownHeaders?.length > 0 && (
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>Ignored columns: {plan.unknownHeaders.join(', ')}</p>
      )}
      {errors.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>Errors</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#b91c1c', maxHeight: 200, overflow: 'auto' }}>
            {errors.map((e, i) => <li key={i}>Row {e.line}: {e.reason}</li>)}
          </ul>
        </div>
      )}
      {plan.warnings?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>Warnings</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#b45309', maxHeight: 160, overflow: 'auto' }}>
            {plan.warnings.map((e, i) => <li key={i}>Row {e.line}: {e.reason}</li>)}
          </ul>
        </div>
      )}
      {stage === 'preview' && plan.duplicates?.length > 0 && (
        <details style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
          <summary>Duplicate rows ({plan.duplicates.length})</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, maxHeight: 160, overflow: 'auto' }}>
            {plan.duplicates.map((e, i) => <li key={i}>Row {e.line}: {e.reason}</li>)}
          </ul>
        </details>
      )}
    </Modal>
  );
}

/** Clients tab (coach). Legacy `vy` + new search, CSV/XLSX template download and import. */
export default function ClientsView() {
  const { supabase, data, isCoach, nav, reload, toast, styles: l, isMobile } = useApp();
  const { clients, students } = data;
  const [modal, setModal] = useState(null); // { type: 'client', client } | { type: 'student', clientId }
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [imp, setImp] = useState(null); // { stage, plan, result, fileName }
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const studentsByClient = useMemo(() => {
    const m = new Map();
    for (const s of students) {
      if (!m.has(s.client_id)) m.set(s.client_id, []);
      m.get(s.client_id).push(s);
    }
    return m;
  }, [students]);

  const q = normName(search);
  const shown = useMemo(() => (q
    ? clients.filter((c) => matches(q, c.name, c.email, c.phone, c.parent2_name, c.parent2_email, c.city)
      || (studentsByClient.get(c.id) || []).some((s) => matches(q, s.name)))
    : clients), [clients, q, studentsByClient]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const matrix = await readImportFile(file);
      const plan = planFromMatrix(matrix, clients, students);
      setImp({ stage: 'preview', plan, result: null, fileName: file.name });
    } catch (err) {
      toast('Error: ' + err.message);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const result = await applyImportPlan(supabase, imp.plan, { chunkSize: 200 });
      await reload();
      setImp({ ...imp, stage: 'done', result });
      toast(`Imported ${result.clientsCreated} clients and ${result.studentsCreated} students`);
    } catch (err) {
      toast('Error: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async (kind) => {
    setMenuOpen(false);
    try {
      if (kind === 'csv') downloadTemplateCsv(); else await downloadTemplateXlsx();
    } catch (err) {
      toast('Error: ' + err.message);
    }
  };

  const small = { ...l.btn, ...l.btnSmall, ...l.btnSecondary };
  const actions = (c) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button style={small} onClick={() => setModal({ type: 'client', client: c })}>Edit</button>
      <button style={small} onClick={() => setModal({ type: 'student', clientId: c.id })}>+ Student</button>
      {isCoach && (
        <button style={{ ...l.btn, ...l.btnSmall, ...l.btnSuccess }} onClick={() => nav('invoices', { clientId: c.id })}>
          Create invoice
        </button>
      )}
    </div>
  );

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>Clients</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => setMenuOpen(!menuOpen)} aria-haspopup="menu" aria-expanded={menuOpen}>
              ⬇ Download Template ▾
            </button>
            {menuOpen && (
              <div role="menu" style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20, background: 'white',
                border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: 200, overflow: 'hidden',
              }}>
                {[['csv', 'CSV (.csv)'], ['xlsx', 'Excel (.xlsx)']].map(([k, label]) => (
                  <button key={k} role="menuitem" onClick={() => download(k)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'white', cursor: 'pointer', fontSize: 14 }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => fileRef.current?.click()}>⬆ Import</button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }} onChange={onFile} aria-label="Import clients file" />
          <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => setModal({ type: 'client', client: null })}>+ Add Client</button>
        </div>
      </div>

      {clients.length > 0 && (
        <input type="search" style={{ ...l.input, marginBottom: 16 }} placeholder="Search clients, emails, phones, students..."
          value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search clients" />
      )}

      {clients.length === 0 ? (
        <div style={l.empty}>No clients yet. Add your first client!</div>
      ) : shown.length === 0 ? (
        <div style={l.empty}>No clients match "{search}".</div>
      ) : isMobile ? (
        <div>
          {shown.map((c) => {
            const ss = studentsByClient.get(c.id) || [];
            return (
              <div key={c.id} style={{ ...l.listItem, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div>
                  <strong>{c.name}</strong>
                  <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                    {[c.email, c.phone].filter(Boolean).join(' • ')}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>
                    {ss.length} student{ss.length === 1 ? '' : 's'}{ss.length ? `: ${ss.map((s) => s.name).join(', ')}` : ''}
                  </div>
                </div>
                {actions(c)}
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
                <th style={l.th}>Email</th>
                <th style={l.th}>Phone</th>
                <th style={l.th}>Students</th>
                <th style={l.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const ss = studentsByClient.get(c.id) || [];
                return (
                  <tr key={c.id}>
                    <td style={l.td}><strong>{c.name}</strong></td>
                    <td style={l.td}>{c.email}</td>
                    <td style={l.td}>{c.phone}</td>
                    <td style={l.td} title={ss.map((s) => s.name).join(', ')}>{ss.length}</td>
                    <td style={l.td}>{actions(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'client' && <ClientModal client={modal.client} onClose={() => setModal(null)} />}
      {modal?.type === 'student' && <StudentModal clientId={modal.clientId} onClose={() => setModal(null)} />}
      {imp && (
        <ImportSummary {...imp} busy={busy} onConfirm={runImport} onClose={() => { if (!busy) setImp(null); }} />
      )}
    </div>
  );
}
