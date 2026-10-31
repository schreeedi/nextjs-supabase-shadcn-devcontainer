-- Background jobs on Supabase Queues (pgmq). Why: docs/adr/001-background-jobs-on-pgmq.md
--
-- Every piece of async work (mails, exports, webhooks, syncs …) is a row in
-- public.jobs plus a pgmq message pointing to it:
--   - public.jobs is the source of truth: status, attempts, last error, result
--     — queryable, visible to the owning user, kept after completion.
--   - the pgmq message is the delivery mechanism: visibility timeout = lease,
--     set_vt = delayed retry, archive = done/dead (pgmq.a_<queue>).
--
-- Flow:  app → enqueue_job()  →  worker → worker_claim_jobs()
--        → handler → worker_finish_job(ok | retry | permanent failure)
-- Only the service role (server code, worker) can call the functions.
--
-- New queue: `select pgmq.create('<name>');` in a migration, then a handler
-- in scripts/worker/plan.mjs.

create extension if not exists pgmq;

select pgmq.create('default');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  queue text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  -- Optional owner: lets the UI show "your export is running".
  user_id uuid references auth.users (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts between 1 and 50),
  last_error text,
  result jsonb,
  msg_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index jobs_user_id_idx on public.jobs (user_id) where user_id is not null;
create index jobs_queue_status_idx on public.jobs (queue, status);
-- Monitoring: dead jobs of the last days
create index jobs_dead_idx on public.jobs (finished_at) where status = 'dead';

alter table public.jobs enable row level security;

-- Users see their own jobs (status display); all writes go through the
-- service-role functions below.
create policy "Users can view own jobs"
  on public.jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- TRUNCATE is not subject to RLS; PostgREST can't issue it, but nothing else
-- should be able to either.
revoke insert, update, delete, truncate, references, trigger
  on public.jobs from anon, authenticated;

-- ── enqueue ───────────────────────────────────────────────────────────

create or replace function public.enqueue_job(
  p_queue text,
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_user_id uuid default null,
  p_delay_seconds integer default 0,
  p_max_attempts integer default 5
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_msg bigint;
begin
  if not exists (select 1 from pgmq.list_queues() q where q.queue_name = p_queue) then
    raise exception 'unknown queue %', p_queue using errcode = '22023';
  end if;

  insert into public.jobs (queue, type, payload, user_id, max_attempts)
  values (p_queue, p_type, coalesce(p_payload, '{}'::jsonb), p_user_id, p_max_attempts)
  returning id into v_id;

  -- Same transaction: the message exists exactly when the job row does.
  v_msg := pgmq.send(p_queue, jsonb_build_object('job_id', v_id), greatest(0, p_delay_seconds));
  update public.jobs set msg_id = v_msg where id = v_id;
  return v_id;
end;
$$;

-- ── claim ─────────────────────────────────────────────────────────────

-- Leases up to p_batch messages for p_vt seconds. A worker that crashes
-- mid-job simply lets the lease expire; the message reappears.
create or replace function public.worker_claim_jobs(
  p_queue text,
  p_batch integer default 10,
  p_vt integer default 60
)
returns table (
  msg_id bigint,
  job_id uuid,
  type text,
  payload jsonb,
  user_id uuid,
  attempts integer,
  max_attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
-- The OUT columns (attempts, max_attempts …) share names with jobs columns;
-- inside SQL statements the column wins.
#variable_conflict use_column
declare
  v_r record;
  v_job public.jobs;
begin
  for v_r in
    select r.msg_id as mid, r.read_ct, r.message
      from pgmq.read(p_queue, p_vt, greatest(1, least(p_batch, 100))) r
  loop
    select * into v_job
      from public.jobs j
     where j.id = (v_r.message ->> 'job_id')::uuid
       for update;

    -- Orphan (job row deleted) or already finished: drop the message.
    if not found or v_job.status in ('done', 'dead') then
      perform pgmq.archive(p_queue, v_r.mid);
      continue;
    end if;

    -- Poison sweep: a message read far more often than attempts allow kept
    -- crashing the worker before it could report back.
    if v_r.read_ct > v_job.max_attempts + 2 then
      update public.jobs
         set status = 'dead',
             last_error = coalesce(last_error, 'worker never finished the job'),
             attempts = greatest(attempts, max_attempts),
             finished_at = now(),
             updated_at = now()
       where id = v_job.id;
      perform pgmq.archive(p_queue, v_r.mid);
      continue;
    end if;

    update public.jobs
       set status = 'running', attempts = attempts + 1, updated_at = now()
     where id = v_job.id
     returning * into v_job;

    msg_id := v_r.mid;
    job_id := v_job.id;
    type := v_job.type;
    payload := v_job.payload;
    user_id := v_job.user_id;
    attempts := v_job.attempts;
    max_attempts := v_job.max_attempts;
    return next;
  end loop;
end;
$$;

-- ── finish ────────────────────────────────────────────────────────────

-- Returns the outcome: 'done' | 'retry' | 'dead' | 'stale'.
-- 'stale' = already finished (a retried finish call after a network blip),
-- so calling it twice is safe.
create or replace function public.worker_finish_job(
  p_queue text,
  p_msg_id bigint,
  p_job_id uuid,
  p_ok boolean,
  p_error text default null,
  p_result jsonb default null,
  p_permanent boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_delay integer;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.status in ('done', 'dead') then
    perform pgmq.archive(p_queue, p_msg_id);
    return 'stale';
  end if;

  if p_ok then
    update public.jobs
       set status = 'done', result = p_result, last_error = null,
           finished_at = now(), updated_at = now()
     where id = p_job_id;
    perform pgmq.archive(p_queue, p_msg_id);
    return 'done';
  end if;

  if p_permanent or v_job.attempts >= v_job.max_attempts then
    update public.jobs
       set status = 'dead', last_error = left(p_error, 4000),
           finished_at = now(), updated_at = now()
     where id = p_job_id;
    perform pgmq.archive(p_queue, p_msg_id); -- dead letter = pgmq.a_<queue> + status 'dead'
    return 'dead';
  end if;

  -- Exponential backoff: 10 s, 20 s, 40 s … capped at 1 h.
  v_delay := least(3600, (10 * power(2, v_job.attempts - 1))::integer);
  update public.jobs
     set status = 'queued', last_error = left(p_error, 4000), updated_at = now()
   where id = p_job_id;
  perform pgmq.set_vt(p_queue, p_msg_id, v_delay);
  return 'retry';
end;
$$;

-- ── monitoring ────────────────────────────────────────────────────────

-- Backlog and failures per queue — for /api/health/ready and the worker's
-- monitor loop.
create or replace function public.queue_health(p_dead_window_hours integer default 24)
returns table (
  queue_name text,
  queue_length bigint,
  oldest_msg_age_sec integer,
  dead_recent bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select m.queue_name::text,
         m.queue_length,
         m.oldest_msg_age_sec,
         (select count(*)
            from public.jobs j
           where j.queue = m.queue_name
             and j.status = 'dead'
             and j.finished_at > now() - make_interval(hours => p_dead_window_hours))
    from pgmq.metrics_all() m;
$$;

revoke all on function public.enqueue_job(text, text, jsonb, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.worker_claim_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.worker_finish_job(text, bigint, uuid, boolean, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.queue_health(integer) from public, anon, authenticated;
grant execute on function public.enqueue_job(text, text, jsonb, uuid, integer, integer) to service_role;
grant execute on function public.worker_claim_jobs(text, integer, integer) to service_role;
grant execute on function public.worker_finish_job(text, bigint, uuid, boolean, text, jsonb, boolean) to service_role;
grant execute on function public.queue_health(integer) to service_role;

-- Keep updated_at current on direct updates too (set_updated_at from the
-- profiles migration).
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
