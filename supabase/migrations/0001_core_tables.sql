-- IceBooks Pro 3.0 -- 0001: core tables, constraints, indexes.
-- Target: Supabase Postgres 15+. Safe to re-run (IF NOT EXISTS everywhere).
-- Ids are bigint identity; user ids are uuid (auth.users.id).
-- Every coach-owned table carries coach_id (default auth.uid()) -> profiles(id) ON DELETE CASCADE.

create schema if not exists private;  -- helper / trigger functions (NOT exposed through PostgREST)

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text,
  role        text not null default 'client' check (role in ('coach', 'client')),
  coach_id    uuid references public.profiles (id) on delete set null,  -- a client's coach
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_coach_has_no_coach check (role = 'client' or coach_id is null),
  constraint profiles_not_own_coach check (coach_id is distinct from id)
);
create index if not exists profiles_coach_id_idx on public.profiles (coach_id);
create index if not exists profiles_role_created_idx on public.profiles (role, created_at);
create index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------- settings (one row per coach)
create table if not exists public.settings (
  coach_id               uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  payment_cash           boolean not null default false,
  payment_check          boolean not null default false,
  payment_venmo          text default '',
  payment_paypal         text default '',
  payment_zelle          text default '',
  payment_cashapp        text default '',
  coach_name             text default '',
  coach_email            text default '',
  coach_phone            text default '',
  coach_address          text default '',
  mileage_rate           numeric(8, 4) not null default 0.725 check (mileage_rate >= 0),
  vehicle_expense_method text not null default 'standard' check (vehicle_expense_method in ('standard', 'actual')),
  expense_categories     jsonb not null default '["Ice Time","Music/Choreography","Costumes","Equipment","Travel","Training/Seminars","Coaching Fees","Membership Dues","Insurance"]'::jsonb
                         check (jsonb_typeof(expense_categories) = 'array'),
  custom_lesson_types    jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_lesson_types) = 'array'),
  late_cancel_hours      integer not null default 24 check (late_cancel_hours between 0 and 720),
  cancellation_policy    text not null default '',
  calendar_token         uuid not null default gen_random_uuid() unique,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------- venues
create table if not exists public.venues (
  id          bigint generated always as identity primary key,
  coach_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  address     text default '',
  color       text default '#6366f1',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists venues_coach_id_idx on public.venues (coach_id);

-- ---------------------------------------------------------------- lessons
create table if not exists public.lessons (
  id            bigint generated always as identity primary key,
  coach_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  lesson_type   text not null default 'private',
  venue_id      bigint references public.venues (id) on delete set null,
  max_students  integer not null default 1 check (max_students between 1 and 500),
  is_published  boolean not null default false,
  notes         text default '',
  rate          numeric(10, 2) default 0 check (rate is null or rate >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lessons_end_after_start check (end_time > start_time)
);
create index if not exists lessons_coach_date_idx on public.lessons (coach_id, date);
create index if not exists lessons_venue_id_idx on public.lessons (venue_id);

-- ---------------------------------------------------------------- events
create table if not exists public.events (
  id              bigint generated always as identity primary key,
  coach_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  event_type      text not null default 'personal'
                  check (event_type in ('competition', 'show', 'testing', 'personal', 'blocked')),
  start_date      date not null,
  end_date        date,
  venue_id        bigint references public.venues (id) on delete set null,
  notes           text default '',
  is_registrable  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint events_end_not_before_start check (end_date is null or end_date >= start_date)
);
create index if not exists events_coach_start_idx on public.events (coach_id, start_date);
create index if not exists events_venue_id_idx on public.events (venue_id);

-- ---------------------------------------------------------------- clients (billing contacts / parents)
create table if not exists public.clients (
  id             bigint generated always as identity primary key,
  coach_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  profile_id     uuid references public.profiles (id) on delete set null,  -- linked login (role client)
  name           text not null check (length(btrim(name)) > 0),
  email          text,
  phone          text default '',
  address        text default '',
  city           text default '',
  state          text default '',
  zip            text default '',
  parent2_name   text default '',
  parent2_email  text default '',
  parent2_phone  text default '',
  notes          text default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists clients_coach_id_idx on public.clients (coach_id);
create index if not exists clients_profile_id_idx on public.clients (profile_id);
create unique index if not exists clients_coach_email_uniq
  on public.clients (coach_id, lower(email)) where email is not null and email <> '';

-- ---------------------------------------------------------------- students (skaters)
create table if not exists public.students (
  id          bigint generated always as identity primary key,
  coach_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id   bigint not null references public.clients (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  email       text,
  birthdate   date,
  notes       text default '',
  -- ISI levels
  isi_freestyle text default '', isi_open_freestyle text default '', isi_figures text default '',
  isi_couples text default '', isi_pairs text default '', isi_icedance text default '',
  isi_international_dance text default '', isi_freedance_partnered text default '',
  isi_solo_freedance text default '', isi_synchro text default '', isi_special_skater text default '',
  isi_number text default '',
  -- U.S. Figure Skating levels
  usfsa_basic text default '', usfsa_aspire text default '', usfsa_skating_skills text default '',
  usfsa_singles text default '', usfsa_pattern_dance text default '', usfsa_free_dance text default '',
  usfsa_pairs text default '', usfsa_number text default '', usfsa_adult_skating_skills text default '',
  usfsa_adult_singles text default '', usfsa_adult_pattern_dance text default '',
  usfsa_adult_free_dance text default '', usfsa_adult_solo_free_dance text default '',
  usfsa_adult_pairs text default '', usfsa_adaptive_skating_skills text default '',
  usfsa_adaptive_singles text default '', usfsa_skate_united text default '',
  -- Learn to Skate USA (provisional set; PEOPLE agent may amend -> add a later migration)
  lts_snowplow_sam text default '', lts_basic_skills text default '', lts_free_skate text default '',
  lts_adult text default '', lts_hockey text default '', lts_dance text default '', lts_artistry text default '',
  lts_synchro text default '', lts_pairs text default '', lts_speed text default '', lts_adaptive text default '',
  lts_number text default '',
  -- legacy 2.x single-summary columns (read by the old bundle; kept so imported data is not lost)
  isi_level text default '', usfsa_level text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists students_coach_id_idx on public.students (coach_id);
create index if not exists students_client_id_idx on public.students (client_id);

-- ---------------------------------------------------------------- invoices
create table if not exists public.invoices (
  id               bigint generated always as identity primary key,
  coach_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id        bigint not null references public.clients (id),  -- NO ACTION: blocks deleting a billed client (see tg_clients_before_delete)
  amount           numeric(12, 2) not null default 0 check (amount >= 0),
  tax_rate         numeric(6, 3) not null default 0 check (tax_rate between 0 and 100),
  total            numeric(12, 2) not null default 0 check (total >= 0),
  amount_paid      numeric(12, 2) not null default 0 check (amount_paid >= 0),
  notes            text default '',
  due_date         date,
  status           text not null default 'draft' check (status in ('draft', 'sent', 'partial', 'paid', 'void')),
  paid_at          timestamptz,
  paid_via         text,
  payment_cash     boolean not null default false,
  payment_check    boolean not null default false,
  payment_venmo    text default '',
  payment_paypal   text default '',
  payment_zelle    text default '',
  payment_cashapp  text default '',
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists invoices_coach_created_idx on public.invoices (coach_id, created_at desc);
create index if not exists invoices_client_id_idx on public.invoices (client_id);

-- ---------------------------------------------------------------- invoice_payments
create table if not exists public.invoice_payments (
  id          bigint generated always as identity primary key,
  coach_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  invoice_id  bigint not null references public.invoices (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  paid_at     date not null default current_date,
  method      text default '',
  reference   text default '',
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists invoice_payments_coach_id_idx on public.invoice_payments (coach_id);
create index if not exists invoice_payments_invoice_id_idx on public.invoice_payments (invoice_id);

-- ---------------------------------------------------------------- bookings (lesson bookings + event registrations)
create table if not exists public.bookings (
  id                    bigint generated always as identity primary key,
  coach_id              uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lesson_id             bigint references public.lessons (id) on delete cascade,
  event_id              bigint references public.events (id) on delete cascade,
  student_id            bigint not null references public.students (id) on delete cascade,
  booked_by             uuid default auth.uid() references public.profiles (id) on delete set null,
  status                text not null default 'confirmed' check (status in ('confirmed', 'completed', 'cancelled')),
  cancelled_at          timestamptz,
  is_late_cancellation  boolean not null default false,
  invoice_id            bigint references public.invoices (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint bookings_one_target check (num_nonnulls(lesson_id, event_id) = 1)
);
create index if not exists bookings_coach_id_idx on public.bookings (coach_id);
create index if not exists bookings_lesson_id_idx on public.bookings (lesson_id);
create index if not exists bookings_event_id_idx on public.bookings (event_id);
create index if not exists bookings_student_id_idx on public.bookings (student_id);
create index if not exists bookings_invoice_id_idx on public.bookings (invoice_id);
create index if not exists bookings_booked_by_idx on public.bookings (booked_by);
-- backstop for the trigger check: one ACTIVE booking per student per lesson / event
create unique index if not exists bookings_active_lesson_student_uniq
  on public.bookings (lesson_id, student_id) where lesson_id is not null and status <> 'cancelled';
create unique index if not exists bookings_active_event_student_uniq
  on public.bookings (event_id, student_id) where event_id is not null and status <> 'cancelled';

-- ---------------------------------------------------------------- expenses
create table if not exists public.expenses (
  id              bigint generated always as identity primary key,
  coach_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date            date not null,
  category        text not null default '',
  description     text default '',
  amount          numeric(12, 2) not null check (amount >= 0),
  vendor          text default '',
  payment_method  text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists expenses_coach_date_idx on public.expenses (coach_id, date desc);

-- ---------------------------------------------------------------- mileage
create table if not exists public.mileage (
  id              bigint generated always as identity primary key,
  coach_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date            date not null,
  description     text default '',
  miles           numeric(10, 2) not null check (miles > 0),
  rate            numeric(8, 4) not null default 0.725 check (rate >= 0),
  amount          numeric(12, 2) not null default 0 check (amount >= 0),
  odometer_start  numeric(12, 1) check (odometer_start is null or odometer_start >= 0),
  odometer_end    numeric(12, 1),
  entry_type      text not null default 'manual' check (entry_type in ('manual', 'odometer')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint mileage_odometer_order check (odometer_start is null or odometer_end is null or odometer_end >= odometer_start)
);
create index if not exists mileage_coach_date_idx on public.mileage (coach_id, date desc);

-- ---------------------------------------------------------------- notifications (to the coach)
create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  coach_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type        text not null check (length(btrim(type)) > 0),
  message     text not null default '',
  lesson_id   bigint references public.lessons (id) on delete set null,
  event_id    bigint references public.events (id) on delete set null,
  student_id  bigint references public.students (id) on delete set null,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  read        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notifications_coach_created_idx on public.notifications (coach_id, created_at desc);
create index if not exists notifications_lesson_id_idx on public.notifications (lesson_id);
create index if not exists notifications_event_id_idx on public.notifications (event_id);
create index if not exists notifications_student_id_idx on public.notifications (student_id);
create index if not exists notifications_created_by_idx on public.notifications (created_by);
