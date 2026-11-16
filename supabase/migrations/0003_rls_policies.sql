-- IceBooks Pro 3.0 -- 0003: privileges, row level security, client-safe settings view, availability RPC.
-- Principles:
--   * anon: no table privileges at all, and no policies -> zero rows everywhere.
--   * every policy is TO authenticated, uses (select auth.uid()) / (select private.fn()) (init-plan cached).
--   * no USING (true). RLS ENABLED and FORCED on every public table (postgres keeps BYPASSRLS, so the
--     SECURITY DEFINER helpers/triggers owned by postgres are unaffected).
-- Re-runnable: DROP POLICY IF EXISTS before each CREATE POLICY.

-- =====================================================================================
-- 1. Table privileges
-- =====================================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update, delete on
  public.settings, public.venues, public.lessons, public.events, public.clients, public.students,
  public.invoices, public.invoice_payments, public.bookings, public.expenses, public.mileage, public.notifications
  to authenticated;
-- profiles: rows are created by the signup trigger only; users may edit their display name only.
-- role / coach_id are NOT updatable through the API (column grant + private.tg_profiles_protect).
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;

grant usage on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Future tables must opt in explicitly (Supabase default privileges would otherwise grant anon).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- =====================================================================================
-- 2. Enable + force RLS
-- =====================================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','venues','lessons','events','clients','students',
                           'invoices','invoice_payments','bookings','expenses','mileage','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- =====================================================================================
-- 3. Coach policies: full CRUD on own rows, only while the caller is a coach
-- =====================================================================================
do $$
declare t text;
begin
  foreach t in array array['settings','venues','lessons','events','clients','students',
                           'invoices','invoice_payments','bookings','expenses','mileage','notifications'] loop
    execute format('drop policy if exists coach_all on public.%I', t);
    execute format($p$
      create policy coach_all on public.%I as permissive for all to authenticated
        using      (coach_id = (select auth.uid()) and (select private.is_coach()))
        with check (coach_id = (select auth.uid()) and (select private.is_coach()))
    $p$, t);
  end loop;
end $$;

-- =====================================================================================
-- 4. profiles
-- =====================================================================================
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_select_coach_clients on public.profiles;
create policy profiles_select_coach_clients on public.profiles for select to authenticated
  using (coach_id = (select auth.uid()) and (select private.is_coach()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =====================================================================================
-- 5. Client (role = 'client') policies. private.my_coach_id() is NULL for anyone who is not a client.
-- =====================================================================================

-- lessons: only PUBLISHED lessons of the client's coach
drop policy if exists client_select_lessons on public.lessons;
create policy client_select_lessons on public.lessons for select to authenticated
  using (is_published and coach_id = (select private.my_coach_id()));

-- events / venues of the client's coach
drop policy if exists client_select_events on public.events;
create policy client_select_events on public.events for select to authenticated
  using (coach_id = (select private.my_coach_id()));

drop policy if exists client_select_venues on public.venues;
create policy client_select_venues on public.venues for select to authenticated
  using (coach_id = (select private.my_coach_id()));

-- clients: own row(s). INSERT/UPDATE of the own row is allowed (legacy self sign-up flow);
-- tg_clients_guard forces coach_id = my coach and profile_id = me; no DELETE.
drop policy if exists client_select_own_client on public.clients;
create policy client_select_own_client on public.clients for select to authenticated
  using (profile_id = (select auth.uid()) and (select private.my_coach_id()) is not null);

drop policy if exists client_insert_own_client on public.clients;
create policy client_insert_own_client on public.clients for insert to authenticated
  with check (profile_id = (select auth.uid()) and coach_id = (select private.my_coach_id()));

drop policy if exists client_update_own_client on public.clients;
create policy client_update_own_client on public.clients for update to authenticated
  using (profile_id = (select auth.uid()) and coach_id = (select private.my_coach_id()))
  with check (profile_id = (select auth.uid()) and coach_id = (select private.my_coach_id()));

-- students: full CRUD on students that belong to the caller's own clients rows
drop policy if exists client_select_students on public.students;
create policy client_select_students on public.students for select to authenticated
  using (client_id in (select private.my_client_ids()));

drop policy if exists client_insert_students on public.students;
create policy client_insert_students on public.students for insert to authenticated
  with check (client_id in (select private.my_client_ids()) and coach_id = (select private.my_coach_id()));

drop policy if exists client_update_students on public.students;
create policy client_update_students on public.students for update to authenticated
  using (client_id in (select private.my_client_ids()))
  with check (client_id in (select private.my_client_ids()) and coach_id = (select private.my_coach_id()));

drop policy if exists client_delete_students on public.students;
create policy client_delete_students on public.students for delete to authenticated
  using (client_id in (select private.my_client_ids()));

-- bookings: see own students' bookings; book own students onto PUBLISHED lessons / REGISTRABLE events
-- of their coach; update only to cancel (tg_bookings_guard pins every other column).
drop policy if exists client_select_bookings on public.bookings;
create policy client_select_bookings on public.bookings for select to authenticated
  using (student_id in (select private.my_student_ids()));

drop policy if exists client_insert_bookings on public.bookings;
create policy client_insert_bookings on public.bookings for insert to authenticated
  with check (
    student_id in (select private.my_student_ids())
    and coach_id = (select private.my_coach_id())
    and booked_by = (select auth.uid())
    and status = 'confirmed'
    and invoice_id is null
    and (
      (lesson_id is not null and exists (
         select 1 from public.lessons l
          where l.id = bookings.lesson_id and l.is_published and l.coach_id = (select private.my_coach_id())))
      or
      (event_id is not null and exists (
         select 1 from public.events e
          where e.id = bookings.event_id and e.is_registrable and e.coach_id = (select private.my_coach_id())))
    )
  );

drop policy if exists client_cancel_bookings on public.bookings;
create policy client_cancel_bookings on public.bookings for update to authenticated
  using (student_id in (select private.my_student_ids()) and status = 'confirmed')
  with check (student_id in (select private.my_student_ids()) and status = 'cancelled'
              and coach_id = (select private.my_coach_id()));

-- notifications: clients may INSERT (about their own actions) but not read / change them
drop policy if exists client_insert_notifications on public.notifications;
create policy client_insert_notifications on public.notifications for insert to authenticated
  with check (
    coach_id = (select private.my_coach_id())
    and created_by = (select auth.uid())
    and (student_id is null or student_id in (select private.my_student_ids()))
  );

-- settings / invoices / invoice_payments / expenses / mileage: coach_all only (clients get nothing).

-- =====================================================================================
-- 6. client_settings: the only settings columns a client may read (no payment handles,
--    no calendar_token). Owner-rights view filtered to the caller's coach (or the coach himself).
-- =====================================================================================
drop view if exists public.client_settings;
create view public.client_settings with (security_invoker = false, security_barrier = true) as
  select s.late_cancel_hours,
         s.cancellation_policy,
         coalesce(nullif(s.coach_name, ''), cp.name, '') as coach_name,
         s.custom_lesson_types
    from public.settings s
    join public.profiles cp on cp.id = s.coach_id
   where s.coach_id = (
           select coalesce(me.coach_id, me.id) from public.profiles me where me.id = (select auth.uid())
         );
comment on view public.client_settings is
  'Client-safe settings of the caller''s coach (one row or none). Never exposes payment handles or calendar_token.';
revoke all on public.client_settings from public, anon, authenticated;
grant select on public.client_settings to authenticated;

-- =====================================================================================
-- 7. lesson_spots(): booked-seat counts for lessons visible to the caller (clients cannot read other
--    families' bookings, so the UI needs this to show "spots left"). Counts only, no names.
-- =====================================================================================
create or replace function public.lesson_spots(p_from date default null, p_to date default null)
returns table (lesson_id bigint, booked integer, max_students integer)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.role, p.coach_id from public.profiles p where p.id = auth.uid()
  )
  select l.id,
         (select count(*)::integer from public.bookings b where b.lesson_id = l.id and b.status <> 'cancelled'),
         l.max_students
    from public.lessons l, me
   where ((me.role = 'coach' and l.coach_id = me.id)
       or (me.role = 'client' and l.coach_id = me.coach_id and l.is_published))
     and (p_from is null or l.date >= p_from)
     and (p_to is null or l.date <= p_to)
$$;
revoke all on function public.lesson_spots(date, date) from public, anon;
grant execute on function public.lesson_spots(date, date) to authenticated;
