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
      lease_id = gen_random_uuid(), lease_until = now() + interval '5 minutes'
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

alter table public.operational_cron_jobs drop constraint operational_cron_jobs_name_valid;
alter table public.operational_cron_jobs add constraint operational_cron_jobs_name_valid check (
  job_name in ('notifications', 'privacy-retention', 'merchant-digest', 'birthday-rewards', 'referral-bonus-drain',
    'loyalty-invite-drain', 'billing-trial-sync', 'qr-status-email-drain'));
insert into public.operational_cron_jobs(job_name, maximum_gap) values ('qr-status-email-drain', interval '15 minutes');
-- Keep the exact seven-job response understood by the currently deployed app.
-- The new app reads v2 and requires the QR delivery job as well. This also
-- keeps application rollback compatible after the additive database release.
alter function public.production_operational_signals() rename to production_operational_signals_v2;
create function public.production_operational_signals()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_set(signals, '{cronJobs}', (
    select coalesce(jsonb_agg(job), '[]'::jsonb)
    from jsonb_array_elements(signals->'cronJobs') job
    where job->>'name' <> 'qr-status-email-drain'
  )) from (select public.production_operational_signals_v2() as signals) source;
$$;
revoke all on function public.production_operational_signals(), public.production_operational_signals_v2() from public, anon, authenticated;
grant execute on function public.production_operational_signals(), public.production_operational_signals_v2() to service_role;
notify pgrst, 'reload schema';
