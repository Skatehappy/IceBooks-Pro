-- Keep-alive probe for the scheduled GitHub Actions workflow (free-tier projects pause after inactivity).
-- Read-only, returns only the server time, touches no tables, so exposing it to anon leaks nothing.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
