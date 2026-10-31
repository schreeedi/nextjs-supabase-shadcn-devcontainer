-- Example starter migration: public profile table linked to auth.users
-- Applied automatically by `supabase start` / `supabase db reset`.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  -- Same names and order as PLANS in lib/plan-features.ts (checked by
  -- lib/plan-features.test.ts). Written only by the service role (billing
  -- webhook, admin) — see the column grants below.
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- `(select auth.uid())` instead of `auth.uid()`: Postgres evaluates it once per
-- query (initPlan) instead of once per row.
-- `to authenticated`: anon requests skip the policy entirely.
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Users may edit their display data, not the row identity, the email (mirrored
-- from auth.users) or the timestamps.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ── Plans: database backstop for lib/plan-features.ts ──────────────────
-- The app gates via planGate(); RLS policies and triggers that must hold even
-- against a buggy server path use plan_at_least('pro').

create or replace function public.plan_rank(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'free' then 0 when 'pro' then 1 when 'business' then 2 else 0 end;
$$;

-- Plan of the signed-in user ≥ p_min? No profile / anon → like Free.
create or replace function public.plan_at_least(p_min text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.plan_rank(coalesce(
    (select p.plan from public.profiles p where p.id = (select auth.uid())),
    'free'
  )) >= public.plan_rank(p_min);
$$;

revoke all on function public.plan_at_least(text) from public, anon;
grant execute on function public.plan_at_least(text) to authenticated, service_role;

-- Keep updated_at current on every UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row on signup (works for OAuth signups too)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Trigger function only — not callable through the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
