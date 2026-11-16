#!/usr/bin/env node
// IceBooks Pro -- live RLS audit (Node 22, ESM, fetch only, no dependencies).
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=... node scripts/rls-audit.mjs
//
// Creates throwaway users (rls-audit-<ts>-{a,b,c,d}@example.test) through the Auth admin API, promotes B to coach
// with public.admin_make_coach, seeds rows for coaches A and B, runs the assertions below as anon / coach / client,
// prints a PASS/FAIL table, deletes every user it created (ON DELETE CASCADE removes their rows), and exits
// non-zero on any failure. Never point it at a project whose data you cannot afford to have test rows in briefly.
//
// Keys come from the environment only -- never hardcode them.

const URL_ = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY in the environment.');
  process.exit(2);
}

const TABLES = ['profiles', 'settings', 'venues', 'lessons', 'events', 'clients', 'students', 'invoices',
  'invoice_payments', 'bookings', 'expenses', 'mileage', 'notifications'];
const COACH_TABLES = TABLES.filter((t) => t !== 'profiles');
const PK = (t) => (t === 'settings' ? 'coach_id' : 'id');

const ts = Date.now();
const PASSWORD = `Aud1t-${ts}-${Math.random().toString(36).slice(2)}!`;
const results = [];
const created = []; // auth user ids to delete
const check = (name, pass, detail = '') => { results.push({ result: pass ? 'PASS' : 'FAIL', check: name, detail: String(detail).slice(0, 90) }); };

// ------------------------------------------------------------------ HTTP helpers
async function http(method, path, { token, key = ANON, body, prefer } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL_}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}
const svc = (method, path, body, prefer) => http(method, path, { key: SERVICE, body, prefer });
const rest = (token, method, path, body, prefer = 'return=representation') =>
  http(method, `/rest/v1/${path}`, { token, body, prefer });
const errText = (r) => (r.data && typeof r.data === 'object' ? (r.data.message || r.data.error || JSON.stringify(r.data)) : String(r.data));

async function createUser(tag, name) {
  const email = `rls-audit-${ts}-${tag}@example.test`;
  const r = await svc('POST', '/auth/v1/admin/users', { email, password: PASSWORD, email_confirm: true, user_metadata: { name } });
  if (!r.ok) throw new Error(`create user ${tag}: ${r.status} ${errText(r)}`);
  created.push(r.data.id);
  return { id: r.data.id, email };
}
async function signIn(email) {
  const r = await http('POST', '/auth/v1/token?grant_type=password', { body: { email, password: PASSWORD } });
  if (!r.ok) throw new Error(`sign in ${email}: ${r.status} ${errText(r)}`);
  return r.data.access_token;
}
async function insert(token, table, row) {
  const r = await rest(token, 'POST', table, row);
  if (!r.ok) throw new Error(`seed ${table}: ${r.status} ${errText(r)}`);
  return Array.isArray(r.data) ? r.data[0] : r.data;
}
const profileOf = async (id) => (await svc('GET', `/rest/v1/profiles?id=eq.${id}&select=*`)).data?.[0];

// ------------------------------------------------------------------ main
async function main() {
  // 0. Was the DB fresh (no coach yet)? Then the first signup must become the coach automatically.
  const before = await svc('GET', '/rest/v1/profiles?role=eq.coach&select=id&limit=1');
  if (!before.ok) throw new Error(`service role cannot read profiles: ${before.status} ${errText(before)} (migrations applied?)`);
  const fresh = before.data.length === 0;

  const uA = await createUser('a', 'Audit Coach A');
  const pA = await profileOf(uA.id);
  if (fresh) {
    check('first signup becomes coach', pA?.role === 'coach', pA?.role);
    const st = (await svc('GET', `/rest/v1/settings?coach_id=eq.${uA.id}&select=coach_id,expense_categories`)).data?.[0];
    check('first coach gets a settings row with default categories', Array.isArray(st?.expense_categories) && st.expense_categories.length > 0);
  } else {
    check('first-signup-is-coach (skipped: DB already has a coach)', true, 'not a fresh DB');
    check('later signup becomes client', pA?.role === 'client' && !!pA?.coach_id, pA?.role);
  }

  const uB = await createUser('b', 'Audit Coach B');
  const pB = await profileOf(uB.id);
  check('second signup is a client of the oldest coach', pB?.role === 'client' && !!pB?.coach_id, `${pB?.role}`);

  // Promote via the documented admin function (and A too when the DB was not fresh).
  for (const u of fresh ? [uB] : [uA, uB]) {
    const r = await svc('POST', '/rest/v1/rpc/admin_make_coach', { p_user_id: u.id });
    if (!r.ok) throw new Error(`admin_make_coach: ${r.status} ${errText(r)}`);
  }
  check('admin_make_coach promotes', (await profileOf(uB.id))?.role === 'coach');

  const uC = await createUser('c', 'Audit Client C');
  // C must be a client of OUR coach A (on a non-fresh DB the trigger links it to the real oldest coach).
  if ((await profileOf(uC.id))?.coach_id !== uA.id) {
    const r = await svc('PATCH', `/rest/v1/profiles?id=eq.${uC.id}`, { coach_id: uA.id }, 'return=minimal');
    if (!r.ok) throw new Error(`re-home client C: ${r.status} ${errText(r)}`);
  }

  const tA = await signIn(uA.email);
  const tB = await signIn(uB.email);

  check('authenticated cannot call admin_make_coach',
    !(await rest(tA, 'POST', 'rpc/admin_make_coach', { p_user_id: uA.id })).ok);

  // 1. Seed coach A and coach B with one row in every table.
  async function seed(token, label) {
    const s = {};
    s.venues = await insert(token, 'venues', { name: `Audit Rink ${label}` });
    s.lessons = await insert(token, 'lessons', { date: '2099-01-05', start_time: '10:00', end_time: '10:30', max_students: 1, is_published: true, venue_id: s.venues.id });
    s.hidden = await insert(token, 'lessons', { date: '2099-01-06', start_time: '10:00', end_time: '10:30', max_students: 2, is_published: false });
    s.events = await insert(token, 'events', { name: `Audit Comp ${label}`, event_type: 'competition', start_date: '2099-02-01', is_registrable: true });
    s.clients = await insert(token, 'clients', { name: `Audit Parent ${label}`, email: `rls-audit-${ts}-parent-${label}@example.test` });
    s.students = await insert(token, 'students', { client_id: s.clients.id, name: `Audit Kid ${label}` });
    s.students2 = await insert(token, 'students', { client_id: s.clients.id, name: `Audit Kid2 ${label}` });
    s.invoices = await insert(token, 'invoices', { client_id: s.clients.id, amount: 100, tax_rate: 0, total: 100, status: 'sent' });
    s.invoice_payments = await insert(token, 'invoice_payments', { invoice_id: s.invoices.id, amount: 10 });
    s.bookings = await insert(token, 'bookings', { event_id: s.events.id, student_id: s.students.id });
    s.expenses = await insert(token, 'expenses', { date: '2099-01-01', category: 'Ice Time', amount: 5 });
    s.mileage = await insert(token, 'mileage', { date: '2099-01-01', miles: 10, rate: 0.725, amount: 7.25 });
    s.notifications = await insert(token, 'notifications', { type: 'audit', message: 'audit' });
    s.settings = (await rest(token, 'GET', 'settings?select=*')).data?.[0];
    return s;
  }
  const A = await seed(tA, 'A');
  const B = await seed(tB, 'B');
  check('coach can read own settings row', !!A.settings && A.settings.coach_id === uA.id);

  // Link client C to one of A's clients rows (coach-side link) and give C a student.
  const cC = await insert(tA, 'clients', { name: 'Audit Parent C', email: uC.email });
  {
    const r = await rest(tA, 'PATCH', `clients?id=eq.${cC.id}`, { profile_id: uC.id });
    check('coach can link a client login to a clients row', r.ok, errText(r));
  }
  const tC = await signIn(uC.email);
  const sC = await insert(tC, 'students', { client_id: cC.id, name: 'Audit Kid C' });
  const sC2 = await insert(tC, 'students', { client_id: cC.id, name: 'Audit Kid C2' });
  check('client student insert gets coach_id from parent', sC.coach_id === uA.id, sC.coach_id);

  // 2. anon reads nothing anywhere.
  for (const t of [...TABLES, 'client_settings']) {
    const r = await rest(ANON, 'GET', `${t}?select=*&limit=5`);
    check(`anon reads nothing: ${t}`, !r.ok || (Array.isArray(r.data) && r.data.length === 0), r.ok ? `${r.data.length} rows` : r.status);
    if (t !== 'client_settings') {
      const w = await rest(ANON, 'POST', t, {});
      check(`anon cannot insert: ${t}`, !w.ok, w.status);
    }
  }

  // 3. Coach A vs coach B isolation on every table.
  for (const t of COACH_TABLES) {
    const row = B[t];
    if (!row) { check(`seed present: ${t}`, false, 'missing'); continue; }
    const id = row[PK(t)];
    const r = await rest(tA, 'GET', `${t}?${PK(t)}=eq.${id}&select=*`);
    check(`coach A cannot read B: ${t}`, r.ok && r.data.length === 0, r.ok ? `${r.data.length} rows` : errText(r));
    const all = await rest(tA, 'GET', `${t}?coach_id=eq.${uB.id}&select=coach_id`);
    check(`coach A cannot list B: ${t}`, all.ok && all.data.length === 0, all.ok ? `${all.data.length} rows` : errText(all));
    const u = await rest(tA, 'PATCH', `${t}?${PK(t)}=eq.${id}`, { coach_id: uA.id });
    check(`coach A cannot update B: ${t}`, !u.ok || u.data.length === 0, u.ok ? `${u.data.length} rows` : u.status);
    const d = await rest(tA, 'DELETE', `${t}?${PK(t)}=eq.${id}`);
    check(`coach A cannot delete B: ${t}`, !d.ok || d.data.length === 0, d.ok ? `${d.data.length} rows` : d.status);
  }
  // still there?
  for (const t of COACH_TABLES) {
    const r = await svc('GET', `/rest/v1/${t}?${PK(t)}=eq.${B[t][PK(t)]}&select=coach_id`);
    check(`B row intact after attacks: ${t}`, r.ok && r.data.length === 1 && r.data[0].coach_id === uB.id);
  }
  {
    const r = await rest(tA, 'POST', 'venues', { name: 'forged', coach_id: uB.id });
    check('coach cannot insert with another coach_id', !r.ok, r.status);
    const l = await rest(tA, 'POST', 'lessons', { date: '2099-01-05', start_time: '11:00', end_time: '11:30', venue_id: B.venues.id });
    check('coach cannot reference another coach venue', !l.ok, l.status);
    const i = await rest(tA, 'POST', 'invoices', { client_id: B.clients.id, amount: 1, total: 1 });
    check('coach cannot invoice another coach client', !i.ok, i.status);
    const b = await rest(tA, 'POST', 'bookings', { lesson_id: A.lessons.id, student_id: B.students.id });
    check('coach cannot book another coach student', !b.ok, b.status);
    const sp = await rest(tA, 'POST', 'invoice_payments', { invoice_id: B.invoices.id, amount: 1 });
    check('coach cannot pay another coach invoice', !sp.ok, sp.status);
    const pr = await rest(tA, 'GET', `profiles?id=eq.${uB.id}&select=id`);
    check('coach cannot read another coach profile', pr.ok && pr.data.length === 0);
  }

  // 4. Client C.
  for (const t of ['invoices', 'invoice_payments', 'expenses', 'mileage', 'settings', 'notifications']) {
    const r = await rest(tC, 'GET', `${t}?select=*`);
    check(`client reads nothing: ${t}`, r.ok ? r.data.length === 0 : true, r.ok ? `${r.data.length} rows` : r.status);
  }
  {
    const l = await rest(tC, 'GET', 'lessons?select=id,coach_id,is_published');
    check('client sees only published lessons of own coach',
      l.ok && l.data.length > 0 && l.data.every((x) => x.coach_id === uA.id && x.is_published), JSON.stringify(l.data).slice(0, 80));
    for (const t of ['lessons', 'events', 'venues', 'clients', 'students', 'bookings']) {
      const r = await rest(tC, 'GET', `${t}?coach_id=eq.${uB.id}&select=id`);
      check(`client cannot read other coach: ${t}`, r.ok && r.data.length === 0);
    }
    const cl = await rest(tC, 'GET', 'clients?select=id');
    check('client sees only own clients row', cl.ok && cl.data.length === 1 && cl.data[0].id === cC.id, JSON.stringify(cl.data));
    const st = await rest(tC, 'GET', `students?id=eq.${A.students.id}&select=id`);
    check('client cannot read other family students', st.ok && st.data.length === 0);
    const cs = await rest(tC, 'GET', 'client_settings?select=*');
    check('client_settings returns 1 safe row', cs.ok && cs.data.length === 1 && !('calendar_token' in cs.data[0]) && !('payment_venmo' in cs.data[0]), errText(cs));
    const cs2 = await rest(tC, 'GET', 'settings?select=calendar_token');
    check('client cannot read settings.calendar_token', cs2.ok ? cs2.data.length === 0 : true);

    const role = await rest(tC, 'PATCH', `profiles?id=eq.${uC.id}`, { role: 'coach' });
    check('client cannot change own role', !role.ok && (await profileOf(uC.id))?.role === 'client', role.status);
    const cid = await rest(tC, 'PATCH', `profiles?id=eq.${uC.id}`, { coach_id: uB.id });
    check('client cannot change own coach_id', !cid.ok && (await profileOf(uC.id))?.coach_id === uA.id, cid.status);
    const nm = await rest(tC, 'PATCH', `profiles?id=eq.${uC.id}`, { name: 'Audit Client C2' });
    check('client can change own name', nm.ok, errText(nm));
    const ins = await rest(tC, 'POST', 'profiles', { id: crypto.randomUUID(), role: 'coach' });
    check('client cannot insert profiles', !ins.ok, ins.status);

    // forge coach_id on client-initiated inserts
    const bk = await rest(tC, 'POST', 'bookings', { lesson_id: A.lessons.id, student_id: sC.id, coach_id: uB.id });
    check('client booking succeeds, coach_id forced from lesson', bk.ok && bk.data[0]?.coach_id === uA.id, bk.ok ? bk.data[0]?.coach_id : errText(bk));
    const nf = await rest(tC, 'POST', 'notifications', { type: 'booking', message: 'audit', coach_id: uB.id, lesson_id: A.lessons.id, student_id: sC.id }, 'return=minimal');
    check('client notification insert allowed', nf.ok, errText(nf));
    const nB = await svc('GET', `/rest/v1/notifications?created_by=eq.${uC.id}&select=coach_id`);
    check('client cannot forge notification coach_id', nB.ok && nB.data.length > 0 && nB.data.every((n) => n.coach_id === uA.id), JSON.stringify(nB.data));
    const sf = await rest(tC, 'POST', 'students', { client_id: A.clients.id, name: 'forged' });
    check('client cannot add student to another family', !sf.ok, sf.status);

    // overbooking + duplicates
    const over = await rest(tC, 'POST', 'bookings', { lesson_id: A.lessons.id, student_id: sC2.id });
    check('overbooking rejected (client)', !over.ok && /Lesson is full/.test(errText(over)), errText(over));
    const ovA = await rest(tA, 'POST', 'bookings', { lesson_id: A.lessons.id, student_id: A.students.id });
    check('overbooking rejected (coach)', !ovA.ok && /Lesson is full/.test(errText(ovA)), errText(ovA));
    const dupe = await rest(tA, 'POST', 'bookings', { event_id: A.events.id, student_id: A.students.id });
    check('duplicate active registration rejected', !dupe.ok, errText(dupe));
    const hid = await rest(tC, 'POST', 'bookings', { lesson_id: A.hidden.id, student_id: sC2.id });
    check('client cannot book unpublished lesson', !hid.ok, hid.status);
    const oth = await rest(tC, 'POST', 'bookings', { lesson_id: B.lessons.id, student_id: sC2.id });
    check('client cannot book another coach lesson', !oth.ok, oth.status);
    const foreign = await rest(tC, 'POST', 'bookings', { event_id: A.events.id, student_id: A.students2.id });
    check('client cannot book another family student', !foreign.ok, foreign.status);

    // client may only cancel
    const bid = bk.data?.[0]?.id;
    const comp = await rest(tC, 'PATCH', `bookings?id=eq.${bid}`, { status: 'completed' });
    check('client cannot mark booking completed', !comp.ok || comp.data.length === 0, comp.status);
    const inv = await rest(tC, 'PATCH', `bookings?id=eq.${bid}`, { status: 'cancelled', invoice_id: A.invoices.id });
    check('client cannot attach invoice while cancelling', !inv.ok, inv.status);
    const cancel = await rest(tC, 'PATCH', `bookings?id=eq.${bid}`, { status: 'cancelled', cancelled_at: new Date().toISOString() });
    check('client can cancel own booking', cancel.ok && cancel.data[0]?.status === 'cancelled', errText(cancel));
    const xc = await rest(tC, 'PATCH', `bookings?id=eq.${A.bookings.id}`, { status: 'cancelled' });
    check('client cannot cancel other family booking', !xc.ok || xc.data.length === 0);
    const del = await rest(tC, 'DELETE', `bookings?id=eq.${bid}`);
    check('client cannot delete bookings', !del.ok || del.data.length === 0);
    const ci = await rest(tC, 'POST', 'invoices', { client_id: cC.id, amount: 1, total: 1 });
    check('client cannot create invoices', !ci.ok, ci.status);
  }

  // 5. Payments keep invoices in sync; overpayment rejected.
  {
    const over = await rest(tA, 'POST', 'invoice_payments', { invoice_id: A.invoices.id, amount: 95 });
    check('overpayment rejected', !over.ok, errText(over));
    const p = await rest(tA, 'POST', 'invoice_payments', { invoice_id: A.invoices.id, amount: 90 });
    const inv = (await rest(tA, 'GET', `invoices?id=eq.${A.invoices.id}&select=amount_paid,status`)).data?.[0];
    check('payments derive amount_paid/status=paid', p.ok && Number(inv?.amount_paid) === 100 && inv?.status === 'paid', JSON.stringify(inv));
    await rest(tA, 'DELETE', `invoice_payments?id=eq.${p.data?.[0]?.id}`);
    const inv2 = (await rest(tA, 'GET', `invoices?id=eq.${A.invoices.id}&select=amount_paid,status`)).data?.[0];
    check('deleting a payment reverts to partial', Number(inv2?.amount_paid) === 10 && inv2?.status === 'partial', JSON.stringify(inv2));
  }
}

async function cleanup() {
  for (const id of created.reverse()) {
    const r = await svc('DELETE', `/auth/v1/admin/users/${id}`);
    check(`cleanup user ${id.slice(0, 8)}`, r.ok, r.ok ? '' : `${r.status} ${errText(r)}`);
  }
  // Safety net: nothing owned by the audit users may remain.
  if (created.length) {
    const ids = created.join(',');
    for (const t of COACH_TABLES) {
      const r = await svc('GET', `/rest/v1/${t}?coach_id=in.(${ids})&select=coach_id`);
      check(`cleanup leaves no ${t}`, r.ok && r.data.length === 0, r.ok ? `${r.data.length} left` : r.status);
    }
  }
}

let fatal = null;
try { await main(); } catch (e) { fatal = e; check('audit run completed', false, e.message); }
await cleanup().catch((e) => check('cleanup', false, e.message));

console.table(results);
const failed = results.filter((r) => r.result === 'FAIL').length;
console.log(`\n${results.length - failed} PASS / ${failed} FAIL${fatal ? ` (aborted: ${fatal.message})` : ''}`);
process.exit(failed ? 1 : 0);
