alter table public.qr_status_email_outbox add column provider_payload text, add column last_attempt_at timestamptz;

create function public.claim_qr_status_emails(p_merchant_id uuid default null, p_limit integer default 20)
returns setof public.qr_status_email_outbox language plpgsql security definer set search_path = public as $$
begin
  update public.qr_status_email_outbox set status = 'failed', failure_code = 'retry_exhausted', lease_id = null, lease_until = null
    where status in ('queued', 'sending') and (lease_until is null or lease_until <= now())
    and (attempts >= 12 or changed_at <= now() - interval '20 hours');
  return query
    with due as (
      select id from public.qr_status_email_outbox
      where status in ('queued', 'sending') and next_attempt_at <= now()
        and (lease_until is null or lease_until <= now())
        and (p_merchant_id is null or merchant_id = p_merchant_id)
        and attempts < 12 and changed_at > now() - interval '20 hours'
      order by changed_at, id limit greatest(1, least(p_limit, 50)) for update skip locked
    )
    update public.qr_status_email_outbox o set status = 'sending', attempts = attempts + 1,
      lease_id = gen_random_uuid(), lease_until = now() + interval '5 minutes', last_attempt_at = now()
    from due where o.id = due.id returning o.*;
end;
$$;
create function public.finish_qr_status_email(p_id uuid, p_lease_id uuid, p_outcome text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_outcome not in ('sent', 'temporary', 'permanent') or p_outcome is null then raise exception 'Invalid delivery outcome'; end if;
  update public.qr_status_email_outbox set
    status = case when p_outcome = 'sent' then 'sent'
      when p_outcome = 'permanent' or attempts >= 12 or changed_at <= now() - interval '20 hours' then 'failed' else 'queued' end,
    sent_at = case when p_outcome = 'sent' then now() else null end,
    failure_code = case when p_outcome = 'sent' then null else p_outcome end,
    next_attempt_at = now() + make_interval(secs => least(3600, (60 * power(2, least(attempts, 6)))::integer)),
    lease_id = null, lease_until = null
    where id = p_id and lease_id = p_lease_id and status = 'sending' and lease_until > now();
  return found;
end;
$$;
revoke all on function public.claim_qr_status_emails(uuid, integer), public.finish_qr_status_email(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_qr_status_emails(uuid, integer), public.finish_qr_status_email(uuid, uuid, text) to service_role;

-- Persist before the first network request, then return the same bytes on retry.
create function public.prepare_qr_status_email(p_id uuid, p_lease_id uuid, p_payload text)
returns text language plpgsql security definer set search_path = public as $$
declare v_row public.qr_status_email_outbox%rowtype; v_payload jsonb;
begin
  select * into v_row from public.qr_status_email_outbox
    where id = p_id and lease_id = p_lease_id and status = 'sending'
      and lease_until > now() and changed_at > now() - interval '20 hours' for update;
  if not found then raise exception 'Delivery lease expired'; end if;
  if v_row.provider_payload is not null then return v_row.provider_payload; end if;
  v_payload := p_payload::jsonb;
  if p_payload is null or jsonb_typeof(v_payload) <> 'object'
    or v_payload->'to' is distinct from jsonb_build_array(v_row.recipient)
    or nullif(v_payload->>'from', '') is null
    or jsonb_typeof(v_payload->'subject') is distinct from 'string'
    or jsonb_typeof(v_payload->'text') is distinct from 'string'
    or jsonb_typeof(v_payload->'html') is distinct from 'string' then
    raise exception 'Invalid email payload';
  end if;
  update public.qr_status_email_outbox set provider_payload = p_payload where id = p_id;
  return p_payload;
end;
$$;
revoke all on function public.prepare_qr_status_email(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.prepare_qr_status_email(uuid, uuid, text) to service_role;

alter table public.operational_cron_jobs drop constraint operational_cron_jobs_name_valid;
alter table public.operational_cron_jobs add constraint operational_cron_jobs_name_valid check (
  job_name in ('notifications', 'privacy-retention', 'merchant-digest', 'birthday-rewards', 'referral-bonus-drain',
    'loyalty-invite-drain', 'billing-trial-sync', 'qr-status-email-drain'));
insert into public.operational_cron_jobs(job_name, maximum_gap) values ('qr-status-email-drain', interval '15 minutes');
-- Keep the exact seven-job response understood by the currently deployed app.
-- The new app reads v2 and requires the QR delivery job as well. This also
-- keeps application rollback compatible after the additive database release.
alter function public.production_operational_signals() rename to production_operational_signals_base;
create function public.production_operational_signals()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_set(signals, '{cronJobs}', (
    select coalesce(jsonb_agg(job), '[]'::jsonb)
    from jsonb_array_elements(signals->'cronJobs') job
    where job->>'name' <> 'qr-status-email-drain'
  )) from (select public.production_operational_signals_base() as signals) source;
$$;
-- Only v2 includes QR delivery health; legacy application rollback keeps its
-- existing seven-job contract and outcome inventory.
create function public.production_operational_signals_v2()
returns jsonb language sql stable security definer set search_path = public as $$
  with base as (select public.production_operational_signals_base() as signals),
  qr as (
    select count(*) filter (where last_attempt_at >= now() - interval '24 hours'
        and (status in ('sent', 'failed') or failure_code is not null)) as attempts,
      count(*) filter (where last_attempt_at >= now() - interval '24 hours'
        and (status = 'failed' or failure_code is not null)) as failures,
      coalesce(greatest(extract(epoch from (now() - min(changed_at) filter (
        where status in ('queued', 'sending')))) / 60.0, 0), 0) as age_minutes
    from public.qr_status_email_outbox
  ), totals as (
    select signals, qr.age_minutes,
      (signals->>'providerDeliveryAttempts24h')::bigint + qr.attempts as attempts,
      (signals->>'providerDeliveryFailures24h')::bigint + qr.failures as failures
    from base, qr
  )
  select signals || jsonb_build_object(
    'notificationQueueAgeMinutes', greatest((signals->>'notificationQueueAgeMinutes')::numeric, round(age_minutes::numeric, 3)),
    'providerDeliveryAttempts24h', attempts,
    'providerDeliveryFailures24h', failures,
    'providerDeliveryFailureRate24h', case when attempts = 0 then 0 else round(failures::numeric / attempts, 6) end
  ) from totals;
$$;
revoke all on function public.production_operational_signals_base() from public, anon, authenticated, service_role;
revoke all on function public.production_operational_signals(), public.production_operational_signals_v2() from public, anon, authenticated;
grant execute on function public.production_operational_signals(), public.production_operational_signals_v2() to service_role;
notify pgrst, 'reload schema';
