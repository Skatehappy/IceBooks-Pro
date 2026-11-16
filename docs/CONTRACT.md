# IceBooks Pro 3.0 — rebuild contract

Real React source (Vite) replacing the old minified bundle. The OLD behavior is recorded in
`legacy/bundle-readable.reference.js` (beautified, minified identifiers: `$`=supabase, `he`=reload, `D`=toast,
`l`=styles, `q`=clients, `ue`=students, `I`=lessons, `We`=bookings, `B`=invoices, `de`=isCoach, `ne`=payment settings,
`Tn`=settings id, `n`=profile). READ the relevant legacy lines for every feature you own and preserve its behavior
(validation messages, calculations, button labels, emoji, layout). Do not copy mangled names — write clear code.

## Stack / rules
- React 18 function components, JS (not TS), inline styles from `useApp().styles` (see `src/ui/styles.js`), no CSS framework.
- Allowed deps (already installed): `@supabase/supabase-js`, `papaparse`, `read-excel-file`, `write-excel-file`, `vitest`. Don't add others without need.
- Never hardcode secrets. Supabase client: `import { supabase } from '../lib/supabase.js'` (or `useApp().supabase`).
- Each agent edits ONLY the files it owns (below). Shared files (`src/context.jsx`, `src/App.jsx`, `src/ui/*`, `src/lib/{format,constants,supabase}.js`, `package.json`) are owned by the lead: if you need a change, make a minimal ADDITIVE edit and say so in your report.
- Pure logic goes in `src/lib/*.js` with vitest tests next to it (`*.test.js`). Run `npx vitest run` and `npx vite build` before reporting. Do not run git commands that commit/push; the lead commits.
- Views are default-exported components with no props; they read everything from `useApp()`.

## `useApp()` (src/context.jsx)
`{ supabase, session, profile, isCoach, data, settings, saveSettings(patch), reload(), toast(msg), notify(type,msg,{lessonId,eventId,studentId}), nav(tab, params), consumeNavParams(), tab, setTab, isMobile, styles, signOut }`
- `data = { lessons, events, venues, clients, students, bookings, invoices, invoicePayments, expenses, mileage, notifications }` (arrays; coach sees everything of theirs, a client sees only RLS-visible rows: own clients/students/bookings, coach's published lessons, events, venues).
- `settings` = row of `settings` (see schema) with defaults. `saveSettings(patch)` UPSERTs on coach_id and updates state; throws on error.
- After every write call `await reload()` then `toast(...)`. Errors: `toast('Error: ' + e.message)`.
- `nav('invoices', { clientId })` switches tab; target view calls `consumeNavParams()` once (in an effect) to read it.
- Shared UI: `src/ui/Modal.jsx` (`<Modal title onClose full footer>`).
- Tabs → files: calendar+booking → `CalendarView`; clients → `ClientsView`; students → `StudentsView`; mystudents (client role) → `MyStudentsView`; events → `EventsView`; venues → `VenuesView`; invoices → `InvoicesView`; expenses → `ExpensesView`; mileage → `MileageView`; reports → `ReportsView`; settings → `SettingsView`.

## Database (PostgreSQL / Supabase; ids are `bigint generated always as identity`, user ids are `uuid`)
Multi-tenant: every coach-owned table has `coach_id uuid not null default auth.uid() references profiles(id)`; RLS scopes rows to the owning coach. UI code does NOT need to send `coach_id` on coach inserts (column default). Clients (role `client`) never write `coach_id`; DB triggers set it.

- `profiles(id uuid pk = auth.users.id, name, email, role 'coach'|'client', coach_id uuid null /*client's coach*/, created_at)`
- `settings(coach_id uuid pk, payment_cash bool, payment_check bool, payment_venmo, payment_paypal, payment_zelle, payment_cashapp, coach_name, coach_email, coach_phone, coach_address, mileage_rate numeric default 0.725, vehicle_expense_method text default 'standard' ('standard'|'actual'), expense_categories jsonb, custom_lesson_types jsonb default '[]', late_cancel_hours int default 24, cancellation_policy text default '', calendar_token uuid default gen_random_uuid(), updated_at)` — one row per coach, created at signup.
- `venues(id, coach_id, name, address, color)`
- `lessons(id, coach_id, date, start_time, end_time, lesson_type, venue_id, max_students, is_published, notes, rate)`
- `events(id, coach_id, name, event_type, start_date, end_date, venue_id, notes, is_registrable)`
- `clients(id, coach_id, profile_id uuid null, name, email, phone, address, city, state, zip, parent2_name, parent2_email, parent2_phone, notes, created_at)` — unique per coach on `lower(email)` when email not null.
- `students(id, coach_id, client_id, name, email, birthdate, notes, created_at, <level columns>)` level columns (all text, default ''): `isi_freestyle, isi_open_freestyle, isi_figures, isi_couples, isi_pairs, isi_icedance, isi_international_dance, isi_freedance_partnered, isi_solo_freedance, isi_synchro, isi_special_skater, isi_number, usfsa_basic, usfsa_aspire, usfsa_skating_skills, usfsa_singles, usfsa_pattern_dance, usfsa_free_dance, usfsa_pairs, usfsa_number, usfsa_adult_skating_skills, usfsa_adult_singles, usfsa_adult_pattern_dance, usfsa_adult_free_dance, usfsa_adult_solo_free_dance, usfsa_adult_pairs, usfsa_adaptive_skating_skills, usfsa_adaptive_singles, usfsa_skate_united` PLUS Learn to Skate: `lts_snowplow_sam, lts_basic_skills, lts_free_skate, lts_adult, lts_hockey, lts_number` (the people-agent finalizes the Learn-to-Skate set and tells the lead the exact column names; schema is then amended).
- `bookings(id, coach_id, lesson_id null, event_id null, student_id, booked_by uuid, status 'confirmed'|'completed'|'cancelled', cancelled_at, is_late_cancellation bool, invoice_id null, created_at)`; DB rejects overbooking (more non-cancelled bookings than `lessons.max_students`) and double-booking the same student on one lesson.
- `invoices(id, coach_id, client_id, amount, tax_rate, total, amount_paid numeric default 0, notes, due_date, status 'draft'|'sent'|'partial'|'paid'|'void', paid_at, paid_via, payment_cash, payment_check, payment_venmo, payment_paypal, payment_zelle, payment_cashapp, sent_at, created_at)`
- `invoice_payments(id, coach_id, invoice_id, amount, paid_at date, method, reference, notes, created_at)` — a trigger keeps `invoices.amount_paid` and `status` (partial/paid) in sync.
- `expenses(id, coach_id, date, category, description, amount, vendor, payment_method)`
- `mileage(id, coach_id, date, description, miles, rate, amount, odometer_start, odometer_end, entry_type 'manual'|'odometer')`
- `notifications(id, coach_id, type, message, lesson_id, event_id, student_id, read bool, created_at)` — inserted by clients too (trigger sets coach_id).
- Edge functions: `send-invoice` (POST `{invoice_id}` with the user's JWT; emails the client via Resend; marks invoice sent) invoked with `supabase.functions.invoke('send-invoice', { body: { invoice_id } })`; `calendar-feed` (GET `?token=<settings.calendar_token>` returns an .ics of the coach's lessons+events; used for the "Live Sync URL").
- First account to sign up becomes the coach; every later account is a client (linked to the coach and, if a `clients` row has the same email, linked via `clients.profile_id`).

## Ownership
| Agent | Files |
|---|---|
| SCHEMA | `supabase/migrations/*`, `supabase/functions/*`, `scripts/rls-audit.mjs`, `docs/SCHEMA.md` |
| CAL | `src/views/CalendarView.jsx`, `src/modals/{Lesson,CopyDay,CopyWeek}Modal.jsx`, `src/lib/{ics,booking,calendar}.js` + tests |
| PEOPLE | `src/views/{ClientsView,StudentsView,MyStudentsView}.jsx`, `src/modals/{Client,Student}Modal.jsx`, `src/lib/{levels,clientImport}.js` + tests |
| BILLING | `src/views/{InvoicesView,SettingsView}.jsx`, `src/modals/{Invoice,Payment}Modal.jsx`, `src/lib/invoice.js` + tests |
| OPS | `src/views/{EventsView,VenuesView,ExpensesView,MileageView,ReportsView}.jsx`, `src/modals/{Event,Venue,Expense,Mileage,RegisterCompetition}Modal.jsx`, `src/lib/{reports,mileage}.js` + tests, notifications panel (inside EventsView or a `src/ui/Notifications.jsx` the lead mounts) |
