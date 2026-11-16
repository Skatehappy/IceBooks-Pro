# IceBooks Pro 3.0 — database schema & security

Source of truth: `supabase/migrations/0001_core_tables.sql`, `0002_functions_triggers.sql`, `0003_rls_policies.sql`
(apply in order; each file is re-runnable). Edge functions: `supabase/functions/{send-invoice,calendar-feed}`.

## Tables (schema `public`)

Every table also has `created_at` / `updated_at` (trigger-maintained). `coach_id uuid not null default auth.uid()`
→ `profiles(id) ON DELETE CASCADE` on every coach-owned table, so deleting a coach's auth user removes all their data.

| Table | Key columns / constraints |
|---|---|
| `profiles` | `id` = `auth.users.id` (cascade), `name`, `email`, `role` ∈ coach/client, `coach_id` (client's coach; null for coaches, CHECK) |
| `settings` | PK `coach_id`; payment flags/handles, coach contact, `mileage_rate` ≥0 (0.725), `vehicle_expense_method` ∈ standard/actual, `expense_categories` jsonb array (9 defaults), `custom_lesson_types` jsonb array, `late_cancel_hours` 0–720 (24), `cancellation_policy`, `calendar_token` uuid unique |
| `venues` | `name` non-blank, `address`, `color` |
| `lessons` | `date`, `start_time`, `end_time` (CHECK end > start), `lesson_type`, `venue_id` → venues (set null), `max_students` 1–500, `is_published`, `notes`, `rate` ≥0 |
| `events` | `name`, `event_type` ∈ competition/show/testing/personal/blocked, `start_date`, `end_date` ≥ start, `venue_id`, `notes`, `is_registrable` |
| `clients` | `profile_id` → profiles (set null), contact + parent2 fields, `notes`; UNIQUE `(coach_id, lower(email))` where email not null/'' |
| `students` | `client_id` → clients (cascade), `name`, `email`, `birthdate`, `notes`, level columns: ISI ×12, USFSA ×19, LTS ×12 (`lts_snowplow_sam, lts_basic_skills, lts_free_skate, lts_adult, lts_hockey, lts_dance, lts_artistry, lts_synchro, lts_pairs, lts_speed, lts_adaptive, lts_number`), legacy `isi_level`, `usfsa_level` |
| `invoices` | `client_id` → clients (NO ACTION; deleting a billed client is refused with a clear message), `amount`/`total` ≥0, `tax_rate` 0–100, `amount_paid` (derived), `status` ∈ draft/sent/partial/paid/void, `paid_at`, `paid_via`, payment flags/handles, `sent_at`, `due_date`, `notes` |
| `invoice_payments` | `invoice_id` → invoices (cascade), `amount` > 0, `paid_at` date, `method`, `reference`, `notes` |
| `bookings` | exactly one of `lesson_id` / `event_id` (cascade), `student_id` (cascade), `booked_by`, `status` ∈ confirmed/completed/cancelled, `cancelled_at`, `is_late_cancellation`, `invoice_id` (set null). Partial UNIQUE on (lesson_id, student_id) and (event_id, student_id) where status ≠ cancelled |
| `expenses` | `date`, `category`, `description`, `amount` ≥0, `vendor`, `payment_method` |
| `mileage` | `date`, `miles` > 0, `rate` ≥0, `amount` ≥0, `odometer_start/end` (end ≥ start), `entry_type` ∈ manual/odometer |
| `notifications` | `type`, `message`, `lesson_id`/`event_id`/`student_id` (set null), `created_by`, `read` |

Indexes: `coach_id` (usually composite with the sort column) on every table, every FK column, `profiles(role, created_at)`.

### Extra read surfaces
- **`public.client_settings`** (view, owner rights, `security_barrier`): `late_cancel_hours, cancellation_policy, coach_name, custom_lesson_types`
  of the caller's coach (or the coach's own row). 0 or 1 row. Never exposes payment handles or `calendar_token`.
  Client code: `supabase.from('client_settings').select('*').maybeSingle()`.
- **`public.lesson_spots(p_from date default null, p_to date default null)`** → `(lesson_id, booked, max_students)` for lessons the
  caller may see (coach: own; client: coach's published). Clients cannot read other families' bookings, so use this for "spots left":
  `supabase.rpc('lesson_spots', { p_from, p_to })`.

## Access matrix (RLS enabled **and forced** on all 13 tables; all policies `TO authenticated`; no `using (true)`)

| Table | anon | coach (role=coach, own `coach_id`) | client (role=client) |
|---|---|---|---|
| profiles | — | SELECT own + own clients' profiles; UPDATE `name` only | SELECT own; UPDATE `name` only |
| settings | — | CRUD own | — (use `client_settings`) |
| venues, events | — | CRUD | SELECT of own coach |
| lessons | — | CRUD | SELECT published of own coach |
| clients | — | CRUD (may link `profile_id` only to one of their client logins) | SELECT / INSERT / UPDATE own row (`profile_id` = me; `coach_id`, `profile_id` forced) |
| students | — | CRUD | CRUD for students of own clients rows |
| bookings | — | CRUD | SELECT own students'; INSERT for own students on published lessons / registrable events of own coach; UPDATE confirmed → cancelled only |
| notifications | — | CRUD | INSERT only (coach_id/created_by forced) |
| invoices, invoice_payments, expenses, mileage | — | CRUD | — |

anon has no table privileges at all (requests get `permission denied`). Coach policies also require `private.is_coach()`, so a
demoted coach loses access instantly. `role` / `coach_id` / `id` on profiles cannot be changed through the API (column grant
`UPDATE(name)` + trigger `profiles_protect`). Helpers (`private.my_role/is_coach/my_coach_id/my_client_ids/my_student_ids`) are
`SECURITY DEFINER`, `search_path=''`, in the unexposed `private` schema, and are called as `(select private.fn())`.

## Triggers

| Trigger | Table | Does |
|---|---|---|
| `on_auth_user_created` | auth.users | creates profile. Under `pg_advisory_xact_lock`: no coach yet → role coach + `settings` row; else role client, `coach_id` = oldest coach, links a `clients` row of that coach with the same email (case-insensitive, `profile_id` null). Name = `raw_user_meta_data.name` ‖ email local part |
| `on_auth_user_email_changed` | auth.users | keeps `profiles.email` in sync |
| `set_updated_at` | all | `updated_at = now()` |
| `zzz_coach_id_immutable` | all coach tables | rejects any change of `coach_id` (incl. trigger-derived) |
| `profiles_protect` | profiles | rejects role/coach_id/id changes from `anon`/`authenticated` |
| `settings_normalize` | settings | accepts legacy JSON-string arrays for `expense_categories` / `custom_lesson_types` |
| `lessons_venue_same_coach`, `events_venue_same_coach`, `invoices_client_same_coach` | | referenced parent must belong to the same coach |
| `clients_guard` | clients | client logins: force `coach_id`=my coach, `profile_id`=me, cannot relink; coach: link only to own client logins |
| `clients_before_delete` | clients | "This client has invoices. Delete their invoices first." |
| `students_set_coach` | students | `coach_id` := parent client's coach |
| `bookings_guard` | bookings | `coach_id` := lesson/event coach; student/invoice same coach; clients: insert confirmed only on published/registrable, update = cancel only; locks lesson `FOR UPDATE`, raises **`Lesson is full`**, `Student already booked`, `Student already registered`; sets `cancelled_at` |
| `notifications_guard` | notifications | clients: `coach_id` := my coach, `created_by` := me, `read` := false, student must be mine; referenced rows same coach |
| `zz_invoices_derive` | invoices | `amount_paid` := Σ payments (direct writes ignored); paid ≥ total → `paid` + `paid_at`; 0 < paid < total → `partial`; payments back to 0 → `sent` (if `sent_at`) else `draft`; status `sent` stamps `sent_at`; `void` untouched; total < paid rejected. A manual "mark paid" with no payment rows is kept |
| `invoice_payments_guard` | invoice_payments | `coach_id` must match invoice; no payments on void; rejects **`Payment exceeds balance due (x)`** |
| `invoice_payments_sync` | invoice_payments | after I/U/D re-derives the invoice |

## Applying

**Supabase CLI** (recommended):
```bash
supabase link --project-ref <ref>
supabase db push                       # applies supabase/migrations/*.sql in order
supabase functions deploy send-invoice
supabase functions deploy calendar-feed --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="IceBooks <invoices@yourdomain.com>"
```
**Management API / SQL editor**: run the three files in order (`POST https://api.supabase.com/v1/projects/<ref>/database/query`
with `{"query": "<file contents>"}` and a personal access token, or paste into Dashboard → SQL Editor).

Existing 2.x project: these migrations use `create table if not exists`, so an old table with the same name is **not** altered —
migrate data into fresh tables (or rename old ones first) and re-run. Back up first.

Verify: `SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_KEY=… node scripts/rls-audit.mjs` (creates & deletes throwaway users,
prints PASS/FAIL, exit ≠ 0 on failure). Dashboard → Advisors will flag `client_settings` as a SECURITY DEFINER view: intended (it
filters to the caller's coach and exposes only safe columns).

## Creating an additional coach

The account must sign up first (it becomes a client). Then, as service role / in the SQL editor only:
```sql
select public.admin_make_coach('<auth user uuid>');
-- find the uuid: select id, email, role from public.profiles where lower(email) = lower('coach2@example.com');
```
It sets `role='coach'`, clears `coach_id`, unlinks any `clients.profile_id` pointing at that user and creates the `settings` row.
`EXECUTE` is revoked from `anon`/`authenticated`. Via REST with the service key: `POST /rest/v1/rpc/admin_make_coach {"p_user_id":"<uuid>"}`.
New sign-ups always attach to the **oldest** coach.

## Edge functions
- `send-invoice` (verify_jwt) — POST `{invoice_id}`; reads invoice/client/settings with the caller's JWT (RLS), emails via Resend
  (`to` client, `cc` parent2, `reply_to` coach email), body shows total, paid-to-date, **balance due**, due date, payment methods,
  cancellation policy; then sets `sent_at` (+ `status='sent'` if draft). Errors: `{error}` ∈ `unauthorized, bad_request, not_found,
  invoice_void, client_has_no_email, email_not_configured, email_failed`.
- `calendar-feed` (verify_jwt=false) — GET `?token=<settings.calendar_token>`; service-role lookup; `text/calendar` of lessons
  (last 180 days onward, booked student names, TENTATIVE when unpublished) + all-day events; 404 on unknown token. URL:
  `${SUPABASE_URL}/functions/v1/calendar-feed?token=${settings.calendar_token}`. Rotate: `update settings set calendar_token = gen_random_uuid()`.
