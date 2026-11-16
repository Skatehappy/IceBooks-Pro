// Client import (CSV / XLSX): template, parsing, dedupe planning and batched writes.
// All parsing / matching / planning is pure; only readImportFile/downloadTemplate* touch the browser and
// applyImportPlan touches the (injected) supabase client.
import Papa from 'papaparse';

export const TEMPLATE_COLUMNS = [
  'name', 'email', 'phone', 'address', 'city', 'state', 'zip',
  'parent2_name', 'parent2_email', 'parent2_phone', 'notes',
  'child_name', 'child_email', 'child_birthdate',
];
export const CLIENT_FIELDS = TEMPLATE_COLUMNS.slice(0, 11);

export const TEMPLATE_EXAMPLE_ROWS = [
  ['Jane Smith', 'jane.smith@example.com', '(555) 123-4567', '123 Main St', 'Springfield', 'IL', '62701',
    'John Smith', 'john.smith@example.com', '(555) 987-6543', 'Prefers morning lessons', 'Emma Smith', '', '2015-03-21'],
  ['Alex Johnson', 'alex.johnson@example.com', '555-222-3333', '45 Oak Ave', 'Lakeside', 'MN', '55401',
    '', '', '', 'Adult skater (leave child columns blank)', '', '', ''],
];

export const TEMPLATE_CSV_NAME = 'IceBooks-client-import-template.csv';
export const TEMPLATE_XLSX_NAME = 'IceBooks-client-import-template.xlsx';

// ---------- header normalization ----------
const squash = (s) => String(s ?? '').replace(/^﻿/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const ALIASES = {
  name: ['name', 'clientname', 'client', 'parentname', 'parent', 'parent1name', 'parent1', 'fullname', 'parentguardianname', 'guardianname', 'contactname'],
  email: ['email', 'emailaddress', 'clientemail', 'parentemail', 'parent1email', 'email1', 'mail'],
  phone: ['phone', 'phonenumber', 'clientphone', 'parentphone', 'parent1phone', 'mobile', 'cell', 'cellphone', 'telephone', 'tel'],
  address: ['address', 'streetaddress', 'street', 'address1', 'addressline1'],
  city: ['city', 'town'],
  state: ['state', 'province', 'st'],
  zip: ['zip', 'zipcode', 'postalcode', 'postcode', 'postal'],
  parent2_name: ['parent2name', 'parent2', 'secondparentname', 'secondparent', 'secondparentguardianname', 'guardian2name', 'guardian2'],
  parent2_email: ['parent2email', 'secondparentemail', 'guardian2email'],
  parent2_phone: ['parent2phone', 'secondparentphone', 'guardian2phone'],
  notes: ['notes', 'note', 'comments', 'comment'],
  child_name: ['childname', 'child', 'studentname', 'student', 'skatername', 'skater', 'childstudentname'],
  child_email: ['childemail', 'studentemail', 'skateremail'],
  child_birthdate: ['childbirthdate', 'birthdate', 'childdob', 'dob', 'dateofbirth', 'childdateofbirth', 'studentbirthdate', 'birthday', 'childbirthday', 'childbirthdateyyyymmdd', 'birthdateyyyymmdd'],
};
const ALIAS_LOOKUP = new Map();
for (const [field, list] of Object.entries(ALIASES)) for (const a of list) ALIAS_LOOKUP.set(a, field);

/** Map a raw header cell to a template column name (or null when unknown). */
export const normalizeHeader = (h) => {
  const s = squash(h);
  if (!s) return null;
  if (ALIAS_LOOKUP.has(s)) return ALIAS_LOOKUP.get(s);
  const noParen = squash(String(h).replace(/\(.*?\)/g, ''));
  return ALIAS_LOOKUP.get(noParen) || null;
};

// ---------- value normalization ----------
export const normEmail = (e) => String(e ?? '').trim().toLowerCase();
export const normName = (n) => String(n ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const normPhone = (p) => {
  let d = String(p ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d;
};
const pad2 = (n) => String(n).padStart(2, '0');
const validYMD = (y, m, d) => {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
};

/** Excel serial date (1900 date system) -> YYYY-MM-DD. */
export const excelSerialToISO = (n) => {
  const ms = Math.round((Number(n) - 25569) * 86400000); // 25569 = days from 1899-12-30 to 1970-01-01
  const d = new Date(ms);
  return validYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/**
 * Birthdate cell -> 'YYYY-MM-DD' | '' (blank) | null (unparseable).
 * Accepts Date (read-excel-file returns UTC-midnight Dates), Excel serial numbers, YYYY-MM-DD, YYYY/MM/DD,
 * M/D/YYYY, M-D-YYYY, M/D/YY, and ISO timestamps.
 */
export const toISODateValue = (v) => {
  if (v == null) return '';
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    // Round to the nearest UTC day (guards against fractional-time cells).
    const d = new Date(Math.round(v.getTime() / 86400000) * 86400000);
    return validYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? excelSerialToISO(v) : null;
  const s = String(v).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return validYMD(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) y += y > (new Date().getFullYear() % 100) ? 1900 : 2000;
    return validYMD(y, +m[1], +m[2]);
  }
  if (/^\d+(\.\d+)?$/.test(s)) { const n = Number(s); if (n > 59 && n < 80000) return excelSerialToISO(n); }
  return null;
};

const cellText = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return toISODateValue(v) || '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v).replace(/^﻿/, '').trim();
};

// ---------- parsing ----------
/** CSV text -> matrix (array of arrays). Handles BOM, quoted commas/newlines, CRLF. */
export const parseCsvText = (text) => {
  const res = Papa.parse(String(text ?? '').replace(/^﻿/, ''), { skipEmptyLines: false });
  return res.data;
};

/**
 * Matrix (first non-blank row = header) -> { rows: [{ line, values }], unknownHeaders, missingName }.
 * `line` is the 1-based spreadsheet/CSV row number. Blank rows are ignored.
 */
export const rowsFromMatrix = (matrix) => {
  const isBlank = (r) => !r || r.every((c) => cellText(c) === '');
  let h = 0;
  while (h < matrix.length && isBlank(matrix[h])) h++;
  if (h >= matrix.length) return { rows: [], unknownHeaders: [], missingName: false, empty: true };
  const header = matrix[h].map(normalizeHeader);
  const unknownHeaders = matrix[h].filter((c, i) => cellText(c) && !header[i]).map(cellText);
  const rows = [];
  for (let i = h + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (isBlank(r)) continue;
    const values = {};
    for (const col of TEMPLATE_COLUMNS) values[col] = '';
    header.forEach((col, ci) => {
      if (!col) return;
      const raw = r[ci];
      if (col === 'child_birthdate') {
        if (values.child_birthdate === '' || values.child_birthdate == null) values.child_birthdate = raw instanceof Date || typeof raw === 'number' ? raw : cellText(raw);
      } else if (!values[col]) values[col] = cellText(raw);
    });
    rows.push({ line: i + 1, values });
  }
  return { rows, unknownHeaders, missingName: !header.includes('name') };
};

// ---------- planning ----------
const clientKeys = (c) => ({ email: normEmail(c.email), np: `${normName(c.name)}|${normPhone(c.phone)}` });
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/**
 * Plan an import. rows = [{ line, values }] (from rowsFromMatrix).
 * Matching: by lower-cased trimmed email when the row has an email; when there is no email match, by
 * normalized name + normalized phone. Matches existing clients and earlier rows of the same file.
 * Returns {
 *   clientsToCreate: [{ ref, line, client, students: [student] }],
 *   studentsToCreate: [{ line, client_id | clientRef, student }],   // flat: every student to insert
 *   counts: { rowsRead, clientsCreated, studentsCreated, studentsAddedToExisting, duplicateClients, duplicateStudents, errors },
 *   duplicates: [{ line, reason }], errors: [{ line, reason }], warnings: [{ line, reason }]
 * }
 */
export function planImport(rows, existingClients = [], existingStudents = []) {
  const byEmail = new Map();
  const byNamePhone = new Map();
  const studentNames = new Map(); // target id (client id or 'new:ref') -> Set of normalized student names
  const tid = (t) => (t.kind === 'existing' ? `c:${t.id}` : `n:${t.ref}`);
  const namesOf = (t) => {
    const k = tid(t);
    if (!studentNames.has(k)) studentNames.set(k, new Set());
    return studentNames.get(k);
  };

  for (const c of existingClients) {
    const k = clientKeys(c);
    const t = { kind: 'existing', id: c.id, client: c };
    if (k.email && !byEmail.has(k.email)) byEmail.set(k.email, t);
    if (normName(c.name) && !byNamePhone.has(k.np)) byNamePhone.set(k.np, t);
  }
  for (const s of existingStudents) {
    if (s.client_id == null) continue;
    namesOf({ kind: 'existing', id: s.client_id }).add(normName(s.name));
  }

  const clientsToCreate = [];
  const studentsToCreate = [];
  const errors = [];
  const warnings = [];
  const duplicates = [];
  const counts = { rowsRead: rows.length, clientsCreated: 0, studentsCreated: 0, studentsAddedToExisting: 0, duplicateClients: 0, duplicateStudents: 0, errors: 0 };

  for (const { line, values } of rows) {
    const v = {};
    for (const col of TEMPLATE_COLUMNS) v[col] = col === 'child_birthdate' ? values[col] : String(values[col] ?? '').trim();
    if (!v.name) { errors.push({ line, reason: 'Missing name' }); continue; }
    const email = normEmail(v.email);
    if (email && !looksLikeEmail(email)) { errors.push({ line, reason: `Invalid email "${v.email}"` }); continue; }
    const childEmail = normEmail(v.child_email);
    if (childEmail && !looksLikeEmail(childEmail)) { errors.push({ line, reason: `Invalid child_email "${v.child_email}"` }); continue; }
    let birthdate = toISODateValue(v.child_birthdate);
    if (birthdate === null) {
      warnings.push({ line, reason: `Unreadable child_birthdate "${cellText(v.child_birthdate)}" - imported without a birthdate` });
      birthdate = '';
    }

    const k = clientKeys(v);
    const match = (email && byEmail.get(email)) || byNamePhone.get(k.np) || null;
    const childName = v.child_name.replace(/\s+/g, ' ').trim();

    if (match) {
      counts.duplicateClients++;
      duplicates.push({ line, reason: `Client "${v.name}" already exists${match.kind === 'new' ? ` (row ${match.line})` : ''}` });
      if (!childName) continue;
      const names = namesOf(match);
      if (names.has(normName(childName))) { counts.duplicateStudents++; continue; }
      names.add(normName(childName));
      const student = { name: childName, email: childEmail || null, birthdate: birthdate || null, notes: '' };
      counts.studentsCreated++;
      if (match.kind === 'existing') {
        counts.studentsAddedToExisting++;
        studentsToCreate.push({ line, client_id: match.id, student });
      } else {
        match.planned.students.push(student);
        studentsToCreate.push({ line, clientRef: match.ref, student });
      }
      continue;
    }

    const ref = clientsToCreate.length + 1;
    const client = {};
    for (const f of CLIENT_FIELDS) client[f] = v[f] || '';
    client.name = v.name;
    client.email = email || null; // null (not '') so the per-coach unique email index ignores it
    const planned = { ref, line, client, students: [] };
    clientsToCreate.push(planned);
    counts.clientsCreated++;
    const t = { kind: 'new', ref, line, planned };
    if (email) byEmail.set(email, t);
    if (!byNamePhone.has(k.np)) byNamePhone.set(k.np, t);

    // Same rule as the manual Add Client form: child -> that student; no child -> an "Adult student" record.
    const student = childName
      ? { name: childName, email: childEmail || null, birthdate: birthdate || null, notes: '' }
      : { name: v.name, email: email || null, birthdate: null, notes: 'Adult student' };
    namesOf(t).add(normName(student.name));
    planned.students.push(student);
    studentsToCreate.push({ line, clientRef: ref, student });
    counts.studentsCreated++;
  }
  counts.errors = errors.length;
  return { clientsToCreate, studentsToCreate, counts, duplicates, errors, warnings };
}

/** Parse a CSV string or a matrix into a plan in one go (used by tests and the UI). */
export const planFromMatrix = (matrix, clients, students) => {
  const parsed = rowsFromMatrix(matrix);
  const plan = planImport(parsed.rows, clients, students);
  if (parsed.empty) plan.errors.unshift({ line: 1, reason: 'The file is empty' });
  else if (parsed.missingName) plan.errors.unshift({ line: 1, reason: 'No "name" column found in the header row' });
  plan.counts.errors = plan.errors.length;
  plan.unknownHeaders = parsed.unknownHeaders;
  return plan;
};

// ---------- applying (batched writes) ----------
export const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const isUniqueViolation = (e) => e && (e.code === '23505' || /duplicate key|unique constraint/i.test(e.message || ''));
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Write a plan with batched inserts (default 200 rows per request). A failing batch is retried row by row
 * so one bad row does not sink the rest. A unique violation on (coach_id, lower(email)) counts as a duplicate
 * client; its students are then attached to the existing client unless a same-named student already exists.
 * Returns { clientsCreated, studentsCreated, studentsAddedToExisting, duplicateClients, duplicateStudents, errors }.
 */
export async function applyImportPlan(supabase, plan, { chunkSize = 200 } = {}) {
  const result = {
    clientsCreated: 0, studentsCreated: 0, studentsAddedToExisting: 0,
    duplicateClients: plan.counts.duplicateClients, duplicateStudents: plan.counts.duplicateStudents,
    errors: [...plan.errors],
  };
  const refToId = new Map();
  const existingRef = new Set(); // refs that resolved to an already-existing client (unique violation)

  const resolveExisting = async (pc) => {
    if (!pc.client.email) return null;
    const { data } = await supabase.from('clients').select('id').ilike('email', escapeLike(pc.client.email)).limit(1);
    return data && data[0] ? data[0].id : null;
  };

  for (const batch of chunk(plan.clientsToCreate, chunkSize)) {
    const { data, error } = await supabase.from('clients').insert(batch.map((p) => p.client)).select();
    if (!error && data && data.length === batch.length) {
      batch.forEach((p, i) => refToId.set(p.ref, data[i].id));
      result.clientsCreated += batch.length;
      continue;
    }
    // Batch failed: retry row by row.
    for (const p of batch) {
      const one = await supabase.from('clients').insert(p.client).select().single();
      if (!one.error && one.data) { refToId.set(p.ref, one.data.id); result.clientsCreated++; continue; }
      if (isUniqueViolation(one.error)) {
        result.duplicateClients++;
        const id = await resolveExisting(p);
        if (id != null) { refToId.set(p.ref, id); existingRef.add(p.ref); }
        continue;
      }
      result.errors.push({ line: p.line, reason: `Client "${p.client.name}" not saved: ${one.error?.message || 'unknown error'}` });
    }
  }

  // Students for clients that turned out to exist already: drop ones whose name is already there.
  const existingNames = new Map();
  for (const ref of existingRef) {
    const id = refToId.get(ref);
    const { data } = await supabase.from('students').select('name').eq('client_id', id);
    existingNames.set(ref, new Set((data || []).map((s) => normName(s.name))));
  }

  const rows = [];
  for (const s of plan.studentsToCreate) {
    if (s.client_id != null) { rows.push({ ...s, toExisting: true, record: { ...s.student, client_id: s.client_id } }); continue; }
    const id = refToId.get(s.clientRef);
    if (id == null) {
      const pc = plan.clientsToCreate.find((p) => p.ref === s.clientRef);
      result.errors.push({ line: s.line, reason: `Student "${s.student.name}" skipped: client "${pc?.client.name ?? ''}" was not saved` });
      continue;
    }
    if (existingRef.has(s.clientRef)) {
      const names = existingNames.get(s.clientRef);
      const n = normName(s.student.name);
      // A unique-violation client skipped the Adult-student default: the existing client already has its own record.
      if (names.has(n) || s.student.notes === 'Adult student') { result.duplicateStudents++; continue; }
      names.add(n);
      rows.push({ ...s, toExisting: true, record: { ...s.student, client_id: id } });
      continue;
    }
    rows.push({ ...s, toExisting: false, record: { ...s.student, client_id: id } });
  }

  const count = (r) => { result.studentsCreated++; if (r.toExisting) result.studentsAddedToExisting++; };
  for (const batch of chunk(rows, chunkSize)) {
    const { error } = await supabase.from('students').insert(batch.map((r) => r.record));
    if (!error) { batch.forEach(count); continue; }
    for (const r of batch) {
      const one = await supabase.from('students').insert(r.record);
      if (!one.error) { count(r); continue; }
      if (isUniqueViolation(one.error)) { result.duplicateStudents++; continue; }
      result.errors.push({ line: r.line, reason: `Student "${r.record.name}" not saved: ${one.error.message}` });
    }
  }
  return result;
}

// ---------- browser helpers ----------
const triggerDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const templateCsvText = () => `﻿${Papa.unparse([TEMPLATE_COLUMNS, ...TEMPLATE_EXAMPLE_ROWS], { quotes: false, newline: '\r\n' })}\r\n`;

/** write-excel-file "data" for the template (all text cells so phone/zip/date keep their exact text). */
export const templateXlsxData = () => [
  TEMPLATE_COLUMNS.map((c) => ({ value: c === 'child_birthdate' ? 'child_birthdate' : c, fontWeight: 'bold', type: String })),
  ...TEMPLATE_EXAMPLE_ROWS.map((r) => r.map((v) => ({ value: v, type: String }))),
];

export const downloadTemplateCsv = () => {
  triggerDownload(new Blob([templateCsvText()], { type: 'text/csv;charset=utf-8' }), TEMPLATE_CSV_NAME);
};

export const downloadTemplateXlsx = async () => {
  const { default: writeXlsxFile } = await import('write-excel-file');
  await writeXlsxFile(templateXlsxData(), {
    fileName: TEMPLATE_XLSX_NAME,
    sheet: 'Clients',
    columns: TEMPLATE_COLUMNS.map((c) => ({ width: Math.max(14, c.length + 4) })),
  });
};

/** Read a user-selected File (.csv or .xlsx) into a matrix. */
export const readImportFile = async (file) => {
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file');
    return readXlsxFile(file);
  }
  if (name.endsWith('.csv') || file?.type === 'text/csv') return parseCsvText(await file.text());
  throw new Error('Please choose a .csv or .xlsx file');
};
