-- What the API roles may do — grants and function privileges, independent of
-- RLS. A missing policy is not a lock: the moment someone adds one, a stray
-- grant becomes a hole. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ── profiles: users edit display data, nothing else ──────────────────
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  'authenticated cannot insert profiles (rows come from handle_new_user)');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated cannot delete profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE'),
  'authenticated cannot truncate profiles');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'plan', 'INSERT'),
  'authenticated cannot insert a plan');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'plan', 'UPDATE'),
  'authenticated cannot update the plan');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'),
  'authenticated cannot update the mirrored email');
select ok(has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'),
  'authenticated can update full_name');
select ok(not has_table_privilege('anon', 'public.profiles', 'INSERT'),
  'anon cannot insert profiles');
select ok(not has_table_privilege('anon', 'public.profiles', 'DELETE'),
  'anon cannot delete profiles');

-- ── jobs: read-only for users ────────────────────────────────────────
select ok(not has_table_privilege('authenticated', 'public.jobs', 'INSERT'),
  'authenticated cannot insert jobs');
select ok(not has_table_privilege('authenticated', 'public.jobs', 'UPDATE'),
  'authenticated cannot update jobs');
select ok(not has_table_privilege('authenticated', 'public.jobs', 'DELETE'),
  'authenticated cannot delete jobs');
select ok(not has_table_privilege('authenticated', 'public.jobs', 'TRUNCATE'),
  'authenticated cannot truncate jobs');

-- ── admin_audit: service role only ───────────────────────────────────
select ok(not has_table_privilege('authenticated', 'public.admin_audit', 'SELECT'),
  'authenticated cannot read the admin audit');
select ok(not has_table_privilege('anon', 'public.admin_audit', 'SELECT'),
  'anon cannot read the admin audit');

-- ── functions ────────────────────────────────────────────────────────
select ok(not has_function_privilege('authenticated',
  'public.enqueue_job(text, text, jsonb, uuid, integer, integer)', 'EXECUTE'),
  'authenticated cannot enqueue jobs directly');
select ok(not has_function_privilege('authenticated',
  'public.worker_claim_jobs(text, integer, integer)', 'EXECUTE'),
  'authenticated cannot claim jobs');
select ok(not has_function_privilege('authenticated',
  'public.worker_finish_job(text, bigint, uuid, boolean, text, jsonb, boolean)', 'EXECUTE'),
  'authenticated cannot finish jobs');
select ok(not has_function_privilege('authenticated', 'public.queue_health(integer)', 'EXECUTE'),
  'authenticated cannot read queue health');
select ok(not has_function_privilege('anon', 'public.plan_at_least(text)', 'EXECUTE'),
  'anon cannot call plan_at_least');
-- Database linter 0029: no SECURITY DEFINER in an exposed schema where an
-- invoker function gives the same answer (users can read their own profile).
select is((select prosecdef from pg_proc where oid = 'public.plan_at_least(text)'::regprocedure),
  false, 'plan_at_least runs as security invoker');

-- ── pgmq is not reachable through the API ────────────────────────────
select ok(not has_schema_privilege('authenticated', 'pgmq', 'USAGE'),
  'authenticated has no usage on the pgmq schema');

select * from finish();
rollback;
