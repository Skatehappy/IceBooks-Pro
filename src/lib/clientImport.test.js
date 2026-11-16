import { describe, it, expect } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import readXlsxFile from 'read-excel-file/node';
import {
  TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE_ROWS, normalizeHeader, normEmail, normName, normPhone, toISODateValue,
  excelSerialToISO, parseCsvText, rowsFromMatrix, planImport, planFromMatrix, applyImportPlan, chunk,
  templateCsvText, templateXlsxData, sheetRows,
} from './clientImport.js';

const HEADER = TEMPLATE_COLUMNS.join(',');
const csv = (...lines) => [HEADER, ...lines].join('\n');
const plan = (text, clients = [], students = []) => planFromMatrix(parseCsvText(text), clients, students);

/** Simulate a successful DB write of a plan: returns the new clients/students arrays. */
function applyInMemory(p, clients, students) {
  let nextC = Math.max(0, ...clients.map((c) => c.id)) + 1;
  let nextS = Math.max(0, ...students.map((s) => s.id)) + 1;
  const refToId = new Map();
  const newClients = p.clientsToCreate.map((pc) => { const id = nextC++; refToId.set(pc.ref, id); return { id, ...pc.client }; });
  const newStudents = p.studentsToCreate.map((s) => ({ id: nextS++, ...s.student, client_id: s.client_id ?? refToId.get(s.clientRef) }));
  return { clients: [...clients, ...newClients], students: [...students, ...newStudents] };
}

describe('template', () => {
  it('has exactly the required columns in order and 2 example rows', () => {
    expect(TEMPLATE_COLUMNS).toEqual(['name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'parent2_name',
      'parent2_email', 'parent2_phone', 'notes', 'child_name', 'child_email', 'child_birthdate']);
    expect(TEMPLATE_EXAMPLE_ROWS).toHaveLength(2);
    for (const r of TEMPLATE_EXAMPLE_ROWS) expect(r).toHaveLength(TEMPLATE_COLUMNS.length);
  });
  it('CSV template round-trips through the importer (BOM included)', () => {
    const text = templateCsvText();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const p = plan(text);
    expect(p.errors).toEqual([]);
    expect(p.counts.clientsCreated).toBe(2);
    expect(p.clientsToCreate[0].students[0]).toEqual({ name: 'Emma Smith', email: null, birthdate: '2015-03-21', notes: '' });
    expect(p.clientsToCreate[1].students[0].notes).toBe('Adult student');
  });
  it('XLSX template round-trips through the importer', async () => {
    const buf = await writeXlsxFile(templateXlsxData(), { buffer: true });
    const matrix = sheetRows(await readXlsxFile(buf));
    expect(matrix[0]).toEqual(TEMPLATE_COLUMNS);
    const p = planFromMatrix(matrix, [], []);
    expect(p.errors).toEqual([]);
    expect(p.counts.clientsCreated).toBe(2);
    expect(p.clientsToCreate[0].client.zip).toBe('62701');
  });
});

describe('normalizers', () => {
  it('headers: case, spacing, underscores, aliases, BOM', () => {
    expect(normalizeHeader('﻿Name')).toBe('name');
    expect(normalizeHeader('Parent Name')).toBe('name');
    expect(normalizeHeader('child name')).toBe('child_name');
    expect(normalizeHeader('Child_Name')).toBe('child_name');
    expect(normalizeHeader('  CHILD BIRTHDATE (YYYY-MM-DD) ')).toBe('child_birthdate');
    expect(normalizeHeader('Parent 2 Email')).toBe('parent2_email');
    expect(normalizeHeader('E-mail')).toBe('email');
    expect(normalizeHeader('Zip Code')).toBe('zip');
    expect(normalizeHeader('favorite color')).toBe(null);
  });
  it('email / name / phone', () => {
    expect(normEmail('  Jane@Example.COM ')).toBe('jane@example.com');
    expect(normName('  Jane   Q  Smith ')).toBe('jane q smith');
    expect(normPhone('+1 (555) 123-4567')).toBe('5551234567');
    expect(normPhone('555.123.4567')).toBe('5551234567');
    expect(normPhone('')).toBe('');
  });
  it('dates: strings, Excel Date cells and serials', () => {
    expect(toISODateValue('2015-03-21')).toBe('2015-03-21');
    expect(toISODateValue('3/21/2015')).toBe('2015-03-21');
    expect(toISODateValue('2015/3/1')).toBe('2015-03-01');
    expect(toISODateValue(new Date(Date.UTC(2015, 2, 21)))).toBe('2015-03-21');
    expect(toISODateValue(42084)).toBe('2015-03-21');
    expect(excelSerialToISO(61)).toBe('1900-03-01');
    expect(excelSerialToISO(45658)).toBe('2025-01-01');
    expect(toISODateValue('42084')).toBe('2015-03-21');
    expect(toISODateValue('')).toBe('');
    expect(toISODateValue(null)).toBe('');
    expect(toISODateValue('2015-02-30')).toBe(null);
    expect(toISODateValue('soon')).toBe(null);
  });
});

describe('parsing', () => {
  it('ignores blank rows, trims, handles quoted commas and reports spreadsheet line numbers', () => {
    const text = csv(
      '"Smith, Jane", jane@x.com ,555-1234,"1 Main St, Apt 2",,,,,,,"likes ""early"" ice",Emma,,2015-01-02',
      ',,,,,,,,,,,,,',
      '',
      'Bob,bob@x.com,,,,,,,,,,,,',
    );
    const { rows } = rowsFromMatrix(parseCsvText(text));
    expect(rows.map((r) => r.line)).toEqual([2, 5]);
    expect(rows[0].values.name).toBe('Smith, Jane');
    expect(rows[0].values.email).toBe('jane@x.com');
    expect(rows[0].values.address).toBe('1 Main St, Apt 2');
    expect(rows[0].values.notes).toBe('likes "early" ice');
  });
  it('columns may be in any order / alias names, CRLF', () => {
    const text = 'Child Name,Parent Name,E-mail,Phone Number\r\nKid A,Pat Doe,PAT@X.COM,555 111 2222\r\n';
    const p = plan(text);
    expect(p.clientsToCreate[0].client).toMatchObject({ name: 'Pat Doe', email: 'pat@x.com', phone: '555 111 2222' });
    expect(p.clientsToCreate[0].students[0].name).toBe('Kid A');
  });
  it('rows with no name become errors with their line number', () => {
    const p = plan(csv('Ann,ann@x.com,,,,,,,,,,,,', ',nobody@x.com,,,,,,,,,,Kid,,'));
    expect(p.errors).toEqual([{ line: 3, reason: 'Missing name' }]);
    expect(p.counts).toMatchObject({ rowsRead: 2, clientsCreated: 1, errors: 1 });
  });
  it('missing name column / empty file / bad email / bad date', () => {
    expect(plan('email\nx@y.com').errors[0]).toEqual({ line: 1, reason: 'No "name" column found in the header row' });
    expect(plan('').errors[0].reason).toBe('The file is empty');
    expect(plan(csv('Ann,not-an-email,,,,,,,,,,,,')).errors[0]).toEqual({ line: 2, reason: 'Invalid email "not-an-email"' });
    const p = plan(csv('Ann,,,,,,,,,,,Kid,,someday'));
    expect(p.warnings[0].line).toBe(2);
    expect(p.clientsToCreate[0].students[0].birthdate).toBe(null);
  });
});

describe('planImport', () => {
  it('creates client + child student like the manual form; adult rule when no child', () => {
    const p = plan(csv(
      'Jane,jane@x.com,555-111-2222,,,,,Second,s@x.com,555,,Emma,emma@x.com,2016-05-06',
      'Adult Al,AL@X.com,,,,,,,,,,,,',
    ));
    expect(p.clientsToCreate).toHaveLength(2);
    expect(p.clientsToCreate[0].client).toMatchObject({ name: 'Jane', parent2_name: 'Second', parent2_email: 's@x.com', address: '' });
    expect(p.clientsToCreate[0].client).not.toHaveProperty('child_name');
    expect(p.clientsToCreate[0].students).toEqual([{ name: 'Emma', email: 'emma@x.com', birthdate: '2016-05-06', notes: '' }]);
    expect(p.clientsToCreate[1].students).toEqual([{ name: 'Adult Al', email: 'al@x.com', birthdate: null, notes: 'Adult student' }]);
    expect(p.counts).toMatchObject({ clientsCreated: 2, studentsCreated: 2, duplicateClients: 0 });
  });

  it('matches existing clients by email (case/space-insensitive) even when name/phone differ', () => {
    const existing = [{ id: 10, name: 'Janet S.', email: 'Jane@X.com', phone: '999' }];
    const p = plan(csv(' Jane , JANE@x.com ,555,,,,,,,,,,,'), existing, [{ id: 1, client_id: 10, name: 'Janet S.' }]);
    expect(p.counts).toMatchObject({ clientsCreated: 0, duplicateClients: 1, studentsCreated: 0 });
  });

  it('matches by name + phone when there is no email match', () => {
    const existing = [{ id: 10, name: 'Jane  Smith', email: null, phone: '(555) 111-2222' }];
    const p = plan(csv(
      'jane smith,,+1 555 111 2222,,,,,,,,,Emma,,',     // name+phone match -> dup, new child added
      'jane smith,other@x.com,5551112222,,,,,,,,,,,',    // email does not match anyone -> falls back to name+phone -> dup
      'jane smith,,555-999-0000,,,,,,,,,,,',             // different phone -> new client
    ), existing, []);
    expect(p.counts.duplicateClients).toBe(2);
    expect(p.counts.clientsCreated).toBe(1);
    expect(p.counts.studentsAddedToExisting).toBe(1);
    expect(p.studentsToCreate.find((s) => s.client_id === 10).student.name).toBe('Emma');
  });

  it('dedupes rows within the same file and attaches extra children to the first row', () => {
    const p = plan(csv(
      'Pat,pat@x.com,,,,,,,,,,Kid One,,',
      'Pat,PAT@x.com,,,,,,,,,,Kid Two,,',
      'Pat,pat@x.com,,,,,,,,,,kid one,,',
      'Sam,,555-000-1111,,,,,,,,,,,',
      'sam,,5550001111,,,,,,,,,Sammy Jr,,',
    ));
    expect(p.counts).toMatchObject({ rowsRead: 5, clientsCreated: 2, duplicateClients: 3, duplicateStudents: 1, studentsCreated: 4, studentsAddedToExisting: 0 });
    expect(p.clientsToCreate[0].students.map((s) => s.name)).toEqual(['Kid One', 'Kid Two']);
    expect(p.clientsToCreate[1].students.map((s) => s.name)).toEqual(['Sam', 'Sammy Jr']);
    expect(p.duplicates[0]).toEqual({ line: 3, reason: 'Client "Pat" already exists (row 2)' });
  });

  it('does not duplicate a student that already exists for an existing client (case-insensitive)', () => {
    const existing = [{ id: 5, name: 'Pat', email: 'pat@x.com', phone: '' }];
    const p = plan(csv('Pat,pat@x.com,,,,,,,,,,  EMMA   LEE ,,'), existing, [{ id: 1, client_id: 5, name: 'Emma Lee' }]);
    expect(p.counts).toMatchObject({ duplicateClients: 1, duplicateStudents: 1, studentsCreated: 0 });
    expect(p.studentsToCreate).toEqual([]);
  });

  it('re-importing the same file creates nothing (idempotent)', () => {
    const text = csv(
      'Jane,jane@x.com,555-111-2222,,,,,,,,,Emma,,2016-05-06',
      'Jane,jane@x.com,555-111-2222,,,,,,,,,Liam,,',
      'Adult Al,,555-333-4444,,,,,,,,,,,',
      'No Phone No Email,,,,,,,,,,,Kiddo,,',
    );
    const existingClients = [{ id: 1, name: 'Old', email: 'old@x.com', phone: '' }];
    const existingStudents = [{ id: 1, client_id: 1, name: 'Old' }];
    const first = plan(text, existingClients, existingStudents);
    expect(first.counts.clientsCreated).toBe(3);
    expect(first.counts.studentsCreated).toBe(4);
    const after = applyInMemory(first, existingClients, existingStudents);
    const second = plan(text, after.clients, after.students);
    expect(second.clientsToCreate).toEqual([]);
    expect(second.studentsToCreate).toEqual([]);
    expect(second.counts).toMatchObject({ clientsCreated: 0, studentsCreated: 0, duplicateClients: 4, errors: 0 });
  });

  it('a later file adding a child to an already-imported client only creates that student', () => {
    const first = plan(csv('Jane,jane@x.com,,,,,,,,,,Emma,,'));
    const after = applyInMemory(first, [], []);
    const second = plan(csv('Jane,jane@x.com,,,,,,,,,,Emma,,', 'Jane,jane@x.com,,,,,,,,,,Noah,,'), after.clients, after.students);
    expect(second.counts).toMatchObject({ clientsCreated: 0, studentsCreated: 1, studentsAddedToExisting: 1, duplicateStudents: 1 });
  });
});

describe('xlsx / csv parity', () => {
  it('the same data as CSV and as XLSX (with a real date cell and a serial number) gives the same plan', async () => {
    const rows = [
      ['Jane Smith', 'jane@x.com', '555-111-2222', '1 Main', 'Town', 'IL', '62701', 'John', 'john@x.com', '', 'note, with comma', 'Emma', '', '2015-03-21'],
      ['Bob', 'bob@x.com', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['Cara', '', '555 000 1234', '', '', '', '', '', '', '', '', 'Kid C', '', '2018-12-01'],
    ];
    const csvText = Papa_unparse([TEMPLATE_COLUMNS.map((c) => c.toUpperCase().replace('_', ' ')), ...rows]);
    const csvPlan = planFromMatrix(parseCsvText(csvText), [], []);

    const xlsxData = [
      TEMPLATE_COLUMNS.map((c) => ({ value: c.toUpperCase().replace('_', ' ') })),
      ...rows.map((r, ri) => r.map((v, ci) => {
        if (TEMPLATE_COLUMNS[ci] === 'child_birthdate' && v) {
          return ri === 0
            ? { type: Date, value: new Date(Date.UTC(2015, 2, 21)), format: 'mm/dd/yyyy' }
            : { type: Number, value: 43435 }; // Excel serial for 2018-12-01 without a date format
        }
        if (TEMPLATE_COLUMNS[ci] === 'zip' && v) return { type: Number, value: Number(v) };
        return v ? { type: String, value: v } : null;
      })),
      [null, null, null], // trailing blank row
    ];
    const buf = await writeXlsxFile(xlsxData, { buffer: true });
    const matrix = sheetRows(await readXlsxFile(buf));
    const xlsxPlan = planFromMatrix(matrix, [], []);

    const strip = (p) => ({ c: p.clientsToCreate, s: p.studentsToCreate, n: p.counts, e: p.errors });
    expect(strip(xlsxPlan)).toEqual(strip(csvPlan));
    expect(xlsxPlan.clientsToCreate[0].students[0].birthdate).toBe('2015-03-21');
    expect(xlsxPlan.clientsToCreate[2].students[0].birthdate).toBe('2018-12-01');
  });
});

// Papa via the module (keeps the test independent of how the lib imports it)
import Papa from 'papaparse';
function Papa_unparse(m) { return Papa.unparse(m); }

describe('applyImportPlan (batched writes, fake supabase)', () => {
  function fakeDb({ existingEmails = [], failNames = [], existingStudents = [] } = {}) {
    const db = { clients: [], students: [...existingStudents], calls: { clients: 0, students: 0 } };
    let id = 100;
    for (const e of existingEmails) db.clients.push({ id: id++, name: 'Existing', email: e });
    const insertClients = (rows) => {
      for (const r of rows) {
        if (failNames.includes(r.name)) return { error: { code: '22001', message: 'value too long' } };
        if (r.email && db.clients.some((c) => (c.email || '').toLowerCase() === r.email.toLowerCase())) return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      }
      const out = rows.map((r) => ({ id: id++, ...r }));
      db.clients.push(...out);
      return { data: out, error: null };
    };
    const api = {
      from(table) {
        const q = {
          _rows: null, _filters: [],
          insert(rows) { q._rows = Array.isArray(rows) ? rows : [rows]; q._single = !Array.isArray(rows); db.calls[table]++; return q; },
          select() { return q; },
          single() { return q; },
          limit() { return q; },
          ilike(col, v) { q._filters.push((r) => (r[col] || '').toLowerCase() === v.replace(/\\/g, '').toLowerCase()); return q; },
          eq(col, v) { q._filters.push((r) => r[col] === v); return q; },
          then(res, rej) {
            let out;
            if (q._rows) {
              if (table === 'clients') {
                const r = insertClients(q._rows);
                out = r.error ? r : { data: q._single ? r.data[0] : r.data, error: null };
              } else {
                const bad = q._rows.find((r) => failNames.includes(r.name));
                if (bad) out = { error: { message: 'bad student' } };
                else { db.students.push(...q._rows.map((r) => ({ id: id++, ...r }))); out = { error: null }; }
              }
            } else {
              out = { data: db[table].filter((r) => q._filters.every((f) => f(r))), error: null };
            }
            return Promise.resolve(out).then(res, rej);
          },
        };
        return q;
      },
    };
    return { api, db };
  }

  it('inserts in chunks of 200', async () => {
    const lines = Array.from({ length: 450 }, (_, i) => `Client ${i},c${i}@x.com,,,,,,,,,,Kid ${i},,`);
    const p = plan(csv(...lines));
    const { api, db } = fakeDb();
    const r = await applyImportPlan(api, p);
    expect(r).toMatchObject({ clientsCreated: 450, studentsCreated: 450, errors: [] });
    expect(db.calls.clients).toBe(3);
    expect(db.calls.students).toBe(3);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(db.students.every((s) => db.clients.some((c) => c.id === s.client_id))).toBe(true);
  });

  it('handles partial failure and DB unique violations as duplicates', async () => {
    const p = plan(csv(
      'Good,good@x.com,,,,,,,,,,Kid G,,',
      'Racer,race@x.com,,,,,,,,,,New Kid,,',   // email already in DB (not in local data) -> unique violation
      'Broken,broken@x.com,,,,,,,,,,Kid B,,',  // fails with another error
      'Also Good,also@x.com,,,,,,,,,,,,',
    ));
    const { api, db } = fakeDb({ existingEmails: ['RACE@x.com'], failNames: ['Broken'] });
    const raceId = db.clients[0].id;
    db.students.push({ id: 1, client_id: raceId, name: 'Old Kid' });
    const r = await applyImportPlan(api, p, { chunkSize: 200 });
    expect(r.clientsCreated).toBe(2);
    expect(r.duplicateClients).toBe(1);
    expect(r.errors.map((e) => e.line)).toEqual([4, 4]); // client not saved + its student skipped
    expect(r.studentsCreated).toBe(3); // Kid G, New Kid (to existing), Also Good (adult)
    expect(r.studentsAddedToExisting).toBe(1);
    expect(db.students.filter((s) => s.client_id === raceId).map((s) => s.name).sort()).toEqual(['New Kid', 'Old Kid']);
  });
});

describe('xlsx written by other tools (regression)', () => {
  it('reads a workbook with blank inline-string cells (openpyxl/pandas style) and plans it', async () => {
    const { fileURLToPath } = await import('node:url');
    const file = fileURLToPath(new URL('./__fixtures__/openpyxl-blank-cells.xlsx', import.meta.url));
    const matrix = sheetRows(await readXlsxFile(file));
    expect(matrix[0]).toEqual(TEMPLATE_COLUMNS);
    const p = planFromMatrix(matrix, [], []);
    expect(p.counts.clientsCreated).toBe(2);
    expect(p.counts.studentsCreated).toBe(2);
    expect(p.errors).toEqual([]);
  });
});
