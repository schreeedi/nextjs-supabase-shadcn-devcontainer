-- Audit trail of admin write actions (plan changes, account actions …).
-- Only the service role reads and writes it (admin console, server-side);
-- no policies → invisible for anon/authenticated even with RLS bypass attempts.
--
-- Contains user ids (personal data): keep a retention period, e.g. delete
-- rows older than 12 months with pg_cron, and mention it in the privacy policy.

create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  -- No FK: the entry must survive the deletion of the target account.
  target_user_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_created_at_idx on public.admin_audit (created_at desc);
create index admin_audit_target_idx on public.admin_audit (target_user_id)
  where target_user_id is not null;

alter table public.admin_audit enable row level security;

revoke all on public.admin_audit from anon, authenticated;
