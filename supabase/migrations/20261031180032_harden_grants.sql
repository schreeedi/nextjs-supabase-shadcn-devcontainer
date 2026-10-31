-- Least privilege for the API roles. Earlier migrations only revoked UPDATE on
-- profiles; Supabase's default grants left INSERT/DELETE/TRUNCATE in place and
-- only the missing policies blocked them. One "users can insert own profile"
-- policy later and a user could create a row with plan = 'business'.
-- Guarded by supabase/tests/database/privileges.test.sql.

-- Profile rows come from handle_new_user and go with auth.users (cascade).
revoke insert, delete, truncate, references, trigger
  on public.profiles from anon, authenticated;

-- TRUNCATE is not subject to RLS. PostgREST can't issue it, but nothing else
-- should be able to either.
revoke truncate, references, trigger on public.jobs from anon, authenticated;

-- Database linter 0029: SECURITY DEFINER in an exposed schema is callable via
-- /rest/v1/rpc. Invoker gives the same answer — the "view own profile" policy
-- lets a user read exactly the row this function reads.
alter function public.plan_at_least(text) security invoker;

-- ── profiles.email mirrors auth.users.email ──────────────────────────
-- handle_new_user copies it on insert only; keep it current on email changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

-- Trigger function only — not callable through the API
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();
