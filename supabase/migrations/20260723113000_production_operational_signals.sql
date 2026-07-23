-- Durable, data-free operational signals for production monitoring.
--
-- The public readiness endpoint needs queue age, provider-delivery outcomes
-- and cron health without reading customer payloads. Cron invocations append a
-- bounded record here; one service-role-only RPC reduces the ledgers to safe
-- aggregate metrics.

create table if not exists public.operational_cron_jobs (
  job_name text primary key,
  maximum_gap interval not null check (maximum_gap > interval '0 seconds'),
  monitor_started_at timestamptz not null default now(),
  constraint operational_cron_jobs_name_valid check (
    job_name in (
      'notifications',
      'privacy-retention',
      'merchant-digest',
      'birthday-rewards',
      'referral-bonus-drain',
      'loyalty-invite-drain'
    )
  )
);

insert into public.operational_cron_jobs (job_name, maximum_gap)
values
  ('notifications', interval '30 minutes'),
  ('privacy-retention', interval '26 hours'),
  ('merchant-digest', interval '8 days'),
  ('birthday-rewards', interval '26 hours'),
  ('referral-bonus-drain', interval '30 minutes'),
  ('loyalty-invite-drain', interval '15 minutes')
on conflict (job_name) do update
set maximum_gap = excluded.maximum_gap;

create table if not exists public.operational_cron_runs (
  id bigint generated always as identity primary key,
  job_name text not null
    references public.operational_cron_jobs(job_name) on delete restrict,
  status text not null check (status in ('succeeded', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  constraint operational_cron_runs_time_ordered
    check (completed_at >= started_at),
  constraint operational_cron_runs_error_shape check (
    (status = 'succeeded' and error_code is null)
    or (
      status = 'failed'
      and error_code is not null
      and error_code ~ '^[a-z0-9_]{1,64}$'
    )
  )
);

create index if not exists operational_cron_runs_job_completed_idx
  on public.operational_cron_runs (job_name, completed_at desc);
create index if not exists operational_cron_runs_completed_idx
  on public.operational_cron_runs (completed_at);
create index if not exists notification_deliveries_attempted_non_skipped_idx
  on public.notification_deliveries (attempted_at desc)
  where status <> 'skipped';

alter table public.operational_cron_jobs enable row level security;
alter table public.operational_cron_jobs force row level security;
alter table public.operational_cron_runs enable row level security;
alter table public.operational_cron_runs force row level security;

drop policy if exists operational_cron_jobs_service_read
  on public.operational_cron_jobs;
create policy operational_cron_jobs_service_read
  on public.operational_cron_jobs
  for select to service_role
  using (true);

drop policy if exists operational_cron_runs_service_all
  on public.operational_cron_runs;
create policy operational_cron_runs_service_all
  on public.operational_cron_runs
  for all to service_role
  using (true)
  with check (true);

revoke all on table public.operational_cron_jobs
  from public, anon, authenticated;
revoke all on table public.operational_cron_runs
  from public, anon, authenticated;
grant select on table public.operational_cron_jobs to service_role;
grant select, insert on table public.operational_cron_runs to service_role;
grant usage, select on sequence public.operational_cron_runs_id_seq
  to service_role;

create or replace function public.record_operational_cron_run(
  p_job_name text,
  p_succeeded boolean,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_duration_ms integer,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_started_at is null
    or p_completed_at is null
    or p_completed_at < p_started_at
    or p_duration_ms is null
    or p_duration_ms < 0 then
    raise exception 'Invalid cron timing';
  end if;

  insert into public.operational_cron_runs (
    job_name,
    status,
    started_at,
    completed_at,
    duration_ms,
    error_code
  )
  values (
    p_job_name,
    case when p_succeeded then 'succeeded' else 'failed' end,
    p_started_at,
    p_completed_at,
    p_duration_ms,
    case when p_succeeded then null else p_error_code end
  );

  delete from public.operational_cron_runs
  where completed_at < now() - interval '90 days';
end;
$$;

revoke all on function public.record_operational_cron_run(
  text, boolean, timestamptz, timestamptz, integer, text
) from public, anon, authenticated;
grant execute on function public.record_operational_cron_run(
  text, boolean, timestamptz, timestamptz, integer, text
) to service_role;

create or replace function public.production_operational_signals()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with notification_queue as (
    select coalesce(
      greatest(
        extract(epoch from (now() - min(events.due_at))) / 60.0,
        0
      ),
      0
    ) as age_minutes
    from public.notification_events events
    where
      (events.status = 'queued' and events.due_at <= now())
      or (
        events.status = 'delivering'
        and events.lease_expires_at is not null
        and events.lease_expires_at <= now()
      )
  ),
  loyalty_invite_queue as (
    select coalesce(
      greatest(
        extract(epoch from (now() - min(recipients.next_attempt_at))) / 60.0,
        0
      ),
      0
    ) as age_minutes
    from public.loyalty_invite_recipients recipients
    join public.loyalty_invite_campaigns campaigns
      on campaigns.id = recipients.campaign_id
    where campaigns.status = 'sending'
      and (
        (
          recipients.status = 'queued'
          and recipients.next_attempt_at <= now()
        )
        or (
          recipients.status = 'sending'
          and recipients.lease_expires_at is not null
          and recipients.lease_expires_at <= now()
        )
      )
  ),
  provider_outcomes as (
    select
      count(*)::integer as attempts,
      count(*) filter (
        where outcome in ('retryable_failure', 'permanent_failure', 'failed')
      )::integer as failures
    from (
      select deliveries.status as outcome
      from public.notification_deliveries deliveries
      where deliveries.attempted_at >= now() - interval '24 hours'
        and deliveries.status <> 'skipped'

      union all

      select
        case
          when recipients.failed_at is not null
            or (
              recipients.status = 'queued'
              and recipients.attempt_count > 0
              and recipients.failure_reason is not null
            )
            then 'failed'
          else 'sent'
        end
      from public.loyalty_invite_recipients recipients
      where greatest(
        coalesce(recipients.failed_at, '-infinity'::timestamptz),
        coalesce(recipients.sent_at, '-infinity'::timestamptz),
        case
          when recipients.status = 'queued'
            and recipients.attempt_count > 0
            and recipients.failure_reason is not null
            then recipients.updated_at
          else '-infinity'::timestamptz
        end
      ) >= now() - interval '24 hours'
    ) outcomes
  ),
  latest_runs as (
    select distinct on (runs.job_name)
      runs.job_name,
      runs.status,
      runs.completed_at
    from public.operational_cron_runs runs
    order by runs.job_name, runs.completed_at desc, runs.id desc
  ),
  cron_health as (
    select
      jobs.job_name,
      case
        when latest.completed_at is null
          and now() <= jobs.monitor_started_at + jobs.maximum_gap
          then 'warming'
        when now() > coalesce(
          latest.completed_at,
          jobs.monitor_started_at
        ) + jobs.maximum_gap
          then 'stale'
        when latest.status = 'failed'
          then 'failing'
        else 'ok'
      end as state,
      coalesce((
        select count(*)::integer
        from public.operational_cron_runs failed_runs
        where failed_runs.job_name = jobs.job_name
          and failed_runs.status = 'failed'
          and failed_runs.completed_at > coalesce((
            select max(success_runs.completed_at)
            from public.operational_cron_runs success_runs
            where success_runs.job_name = jobs.job_name
              and success_runs.status = 'succeeded'
          ), '-infinity'::timestamptz)
      ), 0) as consecutive_failures,
      latest.completed_at as last_completed_at
    from public.operational_cron_jobs jobs
    left join latest_runs latest on latest.job_name = jobs.job_name
  )
  select jsonb_build_object(
    'notificationQueueAgeMinutes',
      round(notification_queue.age_minutes::numeric, 3),
    'loyaltyInviteQueueAgeMinutes',
      round(loyalty_invite_queue.age_minutes::numeric, 3),
    'providerDeliveryAttempts24h',
      provider_outcomes.attempts,
    'providerDeliveryFailures24h',
      provider_outcomes.failures,
    'providerDeliveryFailureRate24h',
      case
        when provider_outcomes.attempts = 0 then 0
        else round(
          provider_outcomes.failures::numeric /
            provider_outcomes.attempts::numeric,
          6
        )
      end,
    'cronJobs',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', cron_health.job_name,
            'state', cron_health.state,
            'consecutiveFailures', cron_health.consecutive_failures,
            'lastCompletedAt', cron_health.last_completed_at
          )
          order by cron_health.job_name
        )
        from cron_health
      ), '[]'::jsonb)
  )
  from notification_queue, loyalty_invite_queue, provider_outcomes;
$$;

revoke all on function public.production_operational_signals()
  from public, anon, authenticated;
grant execute on function public.production_operational_signals()
  to service_role;
