-- Add due referral-bonus backlog count and age to the data-free production
-- readiness signal. A fresh cron run is not enough proof: the drain may run
-- successfully while qualified/held work remains overdue. The backlog includes
-- unresolved settlement states plus attributed edges that already have a real
-- qualifying visit. Promotional/imported/admin stamps never make work due.
--
-- This replaces only the stable aggregate RPC. Its service-role-only ACL is
-- restated explicitly so an additive migration cannot broaden read access.

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
  referral_bonus_due as (
    select coalesce(
      referrals.next_retry_at,
      referrals.qualified_at,
      qualifying_stamp.earned_at,
      referrals.created_at
    ) as due_at
    from public.referrals referrals
    left join lateral (
      select min(stamp_events.created_at) as earned_at
      from public.stamp_events stamp_events
      where stamp_events.membership_id =
          referrals.referred_membership_id
        and stamp_events.event_type = 'earned'
        and coalesce(stamp_events.metadata->>'source', '') not in (
          'referral_bonus', 'imported', 'manual_adjustment', 'loyalty_invite'
        )
    ) qualifying_stamp on true
    where referrals.referrer_bonus_awarded_at is null
      and (referrals.next_retry_at is null or referrals.next_retry_at <= now())
      and (
        referrals.status in ('qualified', 'held', 'settling')
        or (
          referrals.status = 'attributed'
          and qualifying_stamp.earned_at is not null
        )
      )
  ),
  referral_bonus_backlog as (
    select
      count(*)::integer as backlog_count,
      coalesce(
        greatest(
          extract(epoch from (now() - min(referral_bonus_due.due_at))) / 60.0,
          0
        ),
        0
      ) as age_minutes
    from referral_bonus_due
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
    'referralBonusBacklogCount',
      referral_bonus_backlog.backlog_count,
    'referralBonusBacklogAgeMinutes',
      round(referral_bonus_backlog.age_minutes::numeric, 3),
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
  from
    notification_queue,
    loyalty_invite_queue,
    referral_bonus_backlog,
    provider_outcomes;
$$;

revoke all on function public.production_operational_signals()
  from public, anon, authenticated;
grant execute on function public.production_operational_signals()
  to service_role;

notify pgrst, 'reload schema';
