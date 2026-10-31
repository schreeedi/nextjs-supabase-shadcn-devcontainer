-- Row level security with two real users: B must never see or change A's
-- rows. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- Two users; handle_new_user creates their profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', '{"full_name":"A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', '{"full_name":"B"}');

insert into public.jobs (queue, type, user_id)
values ('default', 'test', '00000000-0000-0000-0000-00000000000a');

update public.profiles set plan = 'pro'
where id = '00000000-0000-0000-0000-00000000000a';

-- ── as user B ────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select results_eq(
  'select id from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid)$$,
  'B sees only their own profile');
select is_empty('select 1 from public.jobs', 'B sees none of A''s jobs');

select lives_ok(
  $$update public.profiles set full_name = 'hacked'
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  'updating A''s profile as B runs …');
select throws_ok(
  $$update public.profiles set plan = 'business'
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'B cannot raise their own plan');
select throws_ok(
  $$insert into public.profiles (id, plan)
    values ('00000000-0000-0000-0000-0000000000cc', 'business')$$,
  '42501', null, 'B cannot insert a profile with a plan');
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'B cannot delete their profile to re-create it');
select is(public.plan_at_least('pro'), false, 'plan_at_least sees B''s plan (free)');

-- ── as user A ────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select full_name from public.profiles), 'A',
  '… but changes nothing (A''s name is untouched)');
select is((select count(*)::int from public.jobs), 1, 'A sees their own job');
select is(public.plan_at_least('pro'), true, 'plan_at_least sees A''s plan (pro)');

-- ── email mirror follows auth.users ──────────────────────────────────
reset role;
update auth.users set email = 'a-new@example.test'
where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select email from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'a-new@example.test', 'profiles.email follows an auth email change');

select * from finish();
rollback;
