-- IceBooks Pro 3.0 -- 0002: helper functions, integrity triggers, signup trigger, admin function.
-- All SECURITY DEFINER functions pin search_path = '' and fully qualify every object.
-- Re-runnable: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.

-- =====================================================================================
-- 1. RLS helper functions (private schema; STABLE; called as (select private.fn()) in policies)
-- =====================================================================================

-- Caller's role ('coach' | 'client'), null for anon / service role.
create or replace function private.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

-- True when the caller is a coach.
create or replace function private.is_coach()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'coach' from public.profiles p where p.id = auth.uid()), false)
$$;

-- The coach a CLIENT belongs to (null for coaches, anon, unknown users).
create or replace function private.my_coach_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.coach_id from public.profiles p where p.id = auth.uid() and p.role = 'client'
$$;

-- clients rows linked to the calling login.
create or replace function private.my_client_ids()
returns setof bigint language sql stable security definer set search_path = '' as $$
  select c.id from public.clients c where c.profile_id = auth.uid()
$$;

-- students belonging to the calling login's clients rows.
create or replace function private.my_student_ids()
returns setof bigint language sql stable security definer set search_path = '' as $$
  select s.id from public.students s join public.clients c on c.id = s.client_id
  where c.profile_id = auth.uid()
$$;

revoke all on function private.my_role(), private.is_coach(), private.my_coach_id(),
  private.my_client_ids(), private.my_student_ids() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_role(), private.is_coach(), private.my_coach_id(),
  private.my_client_ids(), private.my_student_ids() to authenticated;

-- =====================================================================================
-- 2. Generic triggers
-- =====================================================================================

create or replace function private.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- coach_id never moves between tenants (blocks "steal/donate a row" via UPDATE).
create or replace function private.tg_coach_id_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.coach_id is distinct from old.coach_id then
    raise exception 'coach_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

-- Parent row (TG_ARGV[0] table, FK column TG_ARGV[1]) must belong to the same coach.
create or replace function private.tg_parent_same_coach()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parent_id bigint := (to_jsonb(new) ->> tg_argv[1])::bigint;
  v_owner uuid;
begin
  if v_parent_id is null then return new; end if;
  execute format('select coach_id from public.%I where id = $1', tg_argv[0]) into v_owner using v_parent_id;
  if v_owner is null then
    raise exception '% % not found', tg_argv[0], v_parent_id using errcode = '23503';
  end if;
  if v_owner is distinct from new.coach_id then
    raise exception '% % belongs to another coach', tg_argv[0], v_parent_id using errcode = '42501';
  end if;
  return new;
end $$;

-- =====================================================================================
-- 3. profiles: role / coach_id are not changeable through the API
-- =====================================================================================
create or replace function private.tg_profiles_protect()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- current_user is the API role for direct PostgREST writes; SECURITY DEFINER code runs as the owner.
  if current_user in ('anon', 'authenticated')
     and (new.role is distinct from old.role or new.coach_id is distinct from old.coach_id or new.id is distinct from old.id) then
    raise exception 'role and coach_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

-- =====================================================================================
-- 4. settings: accept legacy JSON-string-encoded arrays (2.x wrote JSON.stringify(...))
-- =====================================================================================
create or replace function private.tg_settings_normalize()
returns trigger language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.expense_categories) = 'string' then
    new.expense_categories := (new.expense_categories #>> '{}')::jsonb;
  end if;
  if jsonb_typeof(new.custom_lesson_types) = 'string' then
    new.custom_lesson_types := (new.custom_lesson_types #>> '{}')::jsonb;
  end if;
  return new;
end $$;

-- =====================================================================================
-- 5. clients: client logins may only create/edit their OWN row under THEIR coach;
--    a coach may only link profile_id to one of their own client logins.
-- =====================================================================================
create or replace function private.tg_clients_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_my_coach uuid;
begin
  if v_uid is null then return new; end if;  -- service role / SQL editor
  select p.role, p.coach_id into v_role, v_my_coach from public.profiles p where p.id = v_uid;

  if v_role = 'client' then
    if tg_op = 'INSERT' then
      new.coach_id := v_my_coach;
      new.profile_id := v_uid;
    elsif new.profile_id is distinct from old.profile_id then
      raise exception 'profile_id cannot be changed' using errcode = '42501';
    end if;
  elsif v_role = 'coach' and new.profile_id is not null
        and (tg_op = 'INSERT' or new.profile_id is distinct from old.profile_id) then
    if not exists (select 1 from public.profiles p
                   where p.id = new.profile_id and p.role = 'client' and p.coach_id = new.coach_id) then
      raise exception 'That login is not one of your clients' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Friendly message instead of a raw FK error (invoices.client_id is NO ACTION).
-- Skipped when the whole coach account is being deleted (profile already gone -> cascade cleanup).
create or replace function private.tg_clients_before_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = old.coach_id)
     and exists (select 1 from public.invoices i where i.client_id = old.id) then
    raise exception 'This client has invoices. Delete their invoices first.' using errcode = '23503';
  end if;
  return old;
end $$;

-- =====================================================================================
-- 6. students: coach_id always derived from the parent client row (clients cannot forge it)
-- =====================================================================================
create or replace function private.tg_students_set_coach()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select c.coach_id into v_owner from public.clients c where c.id = new.client_id;
  if v_owner is null then
    raise exception 'Client % not found', new.client_id using errcode = '23503';
  end if;
  new.coach_id := v_owner;
  return new;
end $$;

-- =====================================================================================
-- 7. bookings: derive coach_id, validate tenancy, client restrictions, capacity, duplicates
-- =====================================================================================
create or replace function private.tg_bookings_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_owner uuid;
  v_max integer;
  v_published boolean;
  v_registrable boolean;
  v_taken integer;
  v_becomes_active boolean;
begin
  if v_uid is not null then
    select p.role into v_role from public.profiles p where p.id = v_uid;
  end if;

  -- --- owner derived from the lesson / event (lock the lesson row: serialises capacity checks)
  if new.lesson_id is not null then
    select l.coach_id, l.max_students, l.is_published into v_owner, v_max, v_published
      from public.lessons l where l.id = new.lesson_id for update;
    if v_owner is null then raise exception 'Lesson not found' using errcode = '23503'; end if;
  else
    select e.coach_id, e.is_registrable into v_owner, v_registrable
      from public.events e where e.id = new.event_id;
    if v_owner is null then raise exception 'Event not found' using errcode = '23503'; end if;
  end if;
  new.coach_id := v_owner;

  if not exists (select 1 from public.students s where s.id = new.student_id and s.coach_id = v_owner) then
    raise exception 'Student does not belong to this coach' using errcode = '42501';
  end if;
  if new.invoice_id is not null
     and (tg_op = 'INSERT' or new.invoice_id is distinct from old.invoice_id)
     and not exists (select 1 from public.invoices i where i.id = new.invoice_id and i.coach_id = v_owner) then
    raise exception 'Invoice belongs to another coach' using errcode = '42501';
  end if;

  -- --- client logins: book (insert) or cancel (update) only
  if v_role = 'client' then
    if tg_op = 'INSERT' then
      if new.lesson_id is not null and not v_published then
        raise exception 'Lesson is not open for booking' using errcode = '42501';
      end if;
      if new.event_id is not null and not v_registrable then
        raise exception 'Event is not open for registration' using errcode = '42501';
      end if;
      new.status := 'confirmed';
      new.booked_by := v_uid;
      new.invoice_id := null;
      new.cancelled_at := null;
      new.is_late_cancellation := false;
    else
      if old.status <> 'confirmed' or new.status <> 'cancelled'
         or new.lesson_id is distinct from old.lesson_id or new.event_id is distinct from old.event_id
         or new.student_id is distinct from old.student_id or new.booked_by is distinct from old.booked_by
         or new.invoice_id is distinct from old.invoice_id or new.created_at is distinct from old.created_at then
        raise exception 'Clients may only cancel their own confirmed bookings' using errcode = '42501';
      end if;
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
  end if;

  if new.status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  -- --- capacity + duplicates when a row becomes (or moves as) an active booking
  v_becomes_active := new.status <> 'cancelled' and (
    tg_op = 'INSERT' or old.status = 'cancelled'
    or new.lesson_id is distinct from old.lesson_id or new.event_id is distinct from old.event_id
    or new.student_id is distinct from old.student_id);

  if v_becomes_active then
    if new.lesson_id is not null then
      if exists (select 1 from public.bookings b
                 where b.lesson_id = new.lesson_id and b.student_id = new.student_id
                   and b.status <> 'cancelled' and b.id is distinct from new.id) then
        raise exception 'Student already booked' using errcode = '23505';
      end if;
      select count(*) into v_taken from public.bookings b
       where b.lesson_id = new.lesson_id and b.status <> 'cancelled' and b.id is distinct from new.id;
      if v_taken >= v_max then
        raise exception 'Lesson is full' using errcode = 'P0001';
      end if;
    else
      if exists (select 1 from public.bookings b
                 where b.event_id = new.event_id and b.student_id = new.student_id
                   and b.status <> 'cancelled' and b.id is distinct from new.id) then
        raise exception 'Student already registered' using errcode = '23505';
      end if;
    end if;
  end if;

  return new;
end $$;

-- =====================================================================================
-- 8. notifications: coach_id from the caller's coach for client inserts; referenced rows same coach
-- =====================================================================================
create or replace function private.tg_notifications_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_my_coach uuid;
begin
  if v_uid is not null then
    select p.role, p.coach_id into v_role, v_my_coach from public.profiles p where p.id = v_uid;
  end if;
  -- Clients have no UPDATE policy; an UPDATE in a client session can only be an FK "set null"
  -- (e.g. the client deleted a student), which needs no checks.
  if tg_op = 'UPDATE' and v_role = 'client' then
    return new;
  end if;
  if v_role = 'client' then
    new.coach_id := v_my_coach;
    new.created_by := v_uid;
    new.read := false;
    if new.student_id is not null
       and not exists (select 1 from private.my_student_ids() s(id) where s.id = new.student_id) then
      raise exception 'Not your student' using errcode = '42501';
    end if;
  end if;
  if new.lesson_id is not null and not exists
       (select 1 from public.lessons l where l.id = new.lesson_id and l.coach_id = new.coach_id) then
    raise exception 'Lesson belongs to another coach' using errcode = '42501';
  end if;
  if new.event_id is not null and not exists
       (select 1 from public.events e where e.id = new.event_id and e.coach_id = new.coach_id) then
    raise exception 'Event belongs to another coach' using errcode = '42501';
  end if;
  if new.student_id is not null and not exists
       (select 1 from public.students s where s.id = new.student_id and s.coach_id = new.coach_id) then
    raise exception 'Student belongs to another coach' using errcode = '42501';
  end if;
  return new;
end $$;

-- =====================================================================================
-- 9. invoices <-> invoice_payments: amount_paid / status always derived from payments
-- =====================================================================================

-- BEFORE INSERT/UPDATE on invoices: amount_paid := sum(payments); derive partial/paid; revert on 0.
create or replace function private.tg_invoices_derive()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_paid numeric(12, 2);
begin
  if tg_op = 'INSERT' then
    v_paid := 0;
  else
    select coalesce(sum(p.amount), 0) into v_paid from public.invoice_payments p where p.invoice_id = new.id;
  end if;
  new.amount_paid := v_paid;

  if new.total < v_paid then
    raise exception 'Invoice total cannot be less than the amount already paid (%)', v_paid using errcode = '23514';
  end if;

  -- remember that it was sent (legacy "mark sent" set only status), so a later revert lands on 'sent'
  if new.status = 'sent' and new.sent_at is null then
    new.sent_at := now();
  end if;

  if new.status <> 'void' then
    if v_paid > 0 then
      if v_paid >= new.total then
        new.status := 'paid';
        new.paid_at := coalesce(new.paid_at, now());
      else
        new.status := 'partial';
        new.paid_at := null;
      end if;
    elsif new.status = 'partial'
          or (tg_op = 'UPDATE' and old.amount_paid > 0 and new.status = 'paid') then
      -- all payments removed: back to sent (if it was ever sent) or draft
      new.status := case when new.sent_at is not null then 'sent' else 'draft' end;
      new.paid_at := null;
    end if;
    -- a manual "Mark paid" with no payment rows (legacy flow) is kept as-is.
    if new.status = 'paid' then new.paid_at := coalesce(new.paid_at, now()); end if;
  end if;
  return new;
end $$;

-- BEFORE INSERT/UPDATE on invoice_payments: owner from invoice; no payments on void; no overpayment.
create or replace function private.tg_invoice_payments_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_total numeric(12, 2);
  v_status text;
  v_others numeric(12, 2);
begin
  select i.coach_id, i.total, i.status into v_owner, v_total, v_status
    from public.invoices i where i.id = new.invoice_id for update;
  if v_owner is null then raise exception 'Invoice not found' using errcode = '23503'; end if;
  if v_owner is distinct from new.coach_id then
    raise exception 'Invoice belongs to another coach' using errcode = '42501';
  end if;
  if v_status = 'void' then
    raise exception 'Cannot record a payment on a void invoice' using errcode = '23514';
  end if;
  select coalesce(sum(p.amount), 0) into v_others from public.invoice_payments p
   where p.invoice_id = new.invoice_id and p.id is distinct from new.id;
  if v_others + new.amount > v_total then
    raise exception 'Payment exceeds balance due (%)', greatest(v_total - v_others, 0) using errcode = '23514';
  end if;
  return new;
end $$;

-- AFTER INSERT/UPDATE/DELETE on invoice_payments: re-derive the affected invoice(s).
create or replace function private.tg_invoice_payments_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- The UPDATE is a "touch": tg_invoices_derive recomputes amount_paid/status in its BEFORE trigger.
  if tg_op in ('UPDATE', 'DELETE') then
    update public.invoices set amount_paid = amount_paid where id = old.invoice_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.invoice_id is distinct from old.invoice_id) then
    update public.invoices set amount_paid = amount_paid where id = new.invoice_id;
  end if;
  return null;
end $$;

-- =====================================================================================
-- 10. Trigger wiring
-- =====================================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','venues','lessons','events','clients','students',
                           'invoices','invoice_payments','bookings','expenses','mileage','notifications'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function private.tg_set_updated_at()', t);
  end loop;
  foreach t in array array['settings','venues','lessons','events','clients','students',
                           'invoices','invoice_payments','bookings','expenses','mileage','notifications'] loop
    -- "zzz_" = fires after every other BEFORE trigger (name order), so it also catches a
    -- coach_id change derived by a trigger (e.g. a booking moved to another coach's lesson).
    execute format('drop trigger if exists zzz_coach_id_immutable on public.%I', t);
    execute format('create trigger zzz_coach_id_immutable before update on public.%I
                    for each row execute function private.tg_coach_id_immutable()', t);
  end loop;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function private.tg_profiles_protect();

drop trigger if exists settings_normalize on public.settings;
create trigger settings_normalize before insert or update on public.settings
  for each row execute function private.tg_settings_normalize();

drop trigger if exists lessons_venue_same_coach on public.lessons;
create trigger lessons_venue_same_coach before insert or update of venue_id, coach_id on public.lessons
  for each row execute function private.tg_parent_same_coach('venues', 'venue_id');

drop trigger if exists events_venue_same_coach on public.events;
create trigger events_venue_same_coach before insert or update of venue_id, coach_id on public.events
  for each row execute function private.tg_parent_same_coach('venues', 'venue_id');

drop trigger if exists invoices_client_same_coach on public.invoices;
create trigger invoices_client_same_coach before insert or update of client_id, coach_id on public.invoices
  for each row execute function private.tg_parent_same_coach('clients', 'client_id');

drop trigger if exists clients_guard on public.clients;
create trigger clients_guard before insert or update on public.clients
  for each row execute function private.tg_clients_guard();

drop trigger if exists clients_before_delete on public.clients;
create trigger clients_before_delete before delete on public.clients
  for each row execute function private.tg_clients_before_delete();

drop trigger if exists students_set_coach on public.students;
create trigger students_set_coach before insert or update of client_id, coach_id on public.students
  for each row execute function private.tg_students_set_coach();

drop trigger if exists bookings_guard on public.bookings;
create trigger bookings_guard before insert or update on public.bookings
  for each row execute function private.tg_bookings_guard();

drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before insert or update on public.notifications
  for each row execute function private.tg_notifications_guard();

-- "zz_" so it runs after invoices_client_same_coach (triggers fire in name order)
drop trigger if exists zz_invoices_derive on public.invoices;
create trigger zz_invoices_derive before insert or update on public.invoices
  for each row execute function private.tg_invoices_derive();

drop trigger if exists invoice_payments_guard on public.invoice_payments;
create trigger invoice_payments_guard before insert or update on public.invoice_payments
  for each row execute function private.tg_invoice_payments_guard();

drop trigger if exists invoice_payments_sync on public.invoice_payments;
create trigger invoice_payments_sync after insert or update or delete on public.invoice_payments
  for each row execute function private.tg_invoice_payments_sync();

-- =====================================================================================
-- 11. Signup: auth.users -> profiles (+ settings for the first coach; client linking)
-- =====================================================================================
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_coach uuid;
  v_name text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
                          nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                          'Client');
begin
  -- Serialise concurrent signups so exactly one account can become the first coach.
  perform pg_advisory_xact_lock(hashtext('icebooks.first_coach'));

  select p.id into v_coach from public.profiles p
   where p.role = 'coach' order by p.created_at, p.id limit 1;

  if v_coach is null then
    insert into public.profiles (id, name, email, role, coach_id)
    values (new.id, v_name, new.email, 'coach', null)
    on conflict (id) do nothing;
    insert into public.settings (coach_id, coach_name, coach_email)
    values (new.id, v_name, coalesce(new.email, ''))
    on conflict (coach_id) do nothing;
  else
    insert into public.profiles (id, name, email, role, coach_id)
    values (new.id, v_name, new.email, 'client', v_coach)
    on conflict (id) do nothing;
    if coalesce(new.email, '') <> '' then
      update public.clients c set profile_id = new.id
       where c.coach_id = v_coach and c.profile_id is null
         and c.email is not null and lower(c.email) = lower(new.email);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profiles.email in sync when a user changes their auth email.
create or replace function private.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (new.email is distinct from old.email)
  execute function private.handle_user_email_change();

-- =====================================================================================
-- 12. Admin: promote an existing account to an additional coach (service role / SQL only)
-- =====================================================================================
create or replace function public.admin_make_coach(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text; v_email text;
begin
  update public.profiles set role = 'coach', coach_id = null
   where id = p_user_id
  returning name, email into v_name, v_email;
  if not found then
    raise exception 'No profile for user %', p_user_id using errcode = 'P0002';
  end if;
  -- a coach is no longer a client login of anybody
  update public.clients set profile_id = null where profile_id = p_user_id;
  insert into public.settings (coach_id, coach_name, coach_email)
  values (p_user_id, coalesce(v_name, ''), coalesce(v_email, ''))
  on conflict (coach_id) do nothing;
end $$;

revoke all on function public.admin_make_coach(uuid) from public, anon, authenticated;
grant execute on function public.admin_make_coach(uuid) to service_role;

-- Trigger functions are never called directly.
revoke all on function private.tg_set_updated_at(), private.tg_coach_id_immutable(), private.tg_parent_same_coach(),
  private.tg_profiles_protect(), private.tg_settings_normalize(), private.tg_clients_guard(),
  private.tg_clients_before_delete(), private.tg_students_set_coach(), private.tg_bookings_guard(),
  private.tg_notifications_guard(), private.tg_invoices_derive(), private.tg_invoice_payments_guard(),
  private.tg_invoice_payments_sync(), private.handle_new_user(), private.handle_user_email_change()
  from public, anon, authenticated;
