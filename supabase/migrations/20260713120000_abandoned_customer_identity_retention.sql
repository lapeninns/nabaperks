create or replace function public.admin_purge_abandoned_customer_identities(
  p_cutoff timestamptz default (now() - interval '7 days')
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  abandoned record;
  purged_count integer := 0;
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'admin_purge_abandoned_customer_identities requires the service role';
  end if;

  perform set_config('app.customer_erasure', 'true', true);

  for abandoned in
    select customers.id
    from public.customers
    where customers.updated_at < p_cutoff
      and customers.phone_hmac is not null
      and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = customers.id
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = customers.id
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = customers.id
      )
      and not exists (
        select 1 from public.consent_records
        where consent_records.customer_id = customers.id
      )
      and not exists (
        select 1 from public.customer_sessions sessions
        where sessions.customer_id = customers.id
          and sessions.revoked_at is null
          and sessions.expires_at > now()
          and sessions.last_seen_at >= p_cutoff
      )
      and not exists (
        select 1 from public.referrals
        where referrals.referrer_customer_id = customers.id
           or referrals.referred_customer_id = customers.id
      )
      and not exists (
        select 1 from public.audit_logs
        where audit_logs.customer_id = customers.id
          and audit_logs.action = 'data_request_logged'
      )
      and not exists (
        select 1 from public.pending_reward_invites invites
        where invites.matched_customer_id = customers.id
           or invites.attached_customer_id = customers.id
           or invites.phone_hmac = customers.phone_hmac
           or (
             customers.email_hmac is not null
             and invites.email_hmac = customers.email_hmac
           )
      )
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('customer-identity:' || abandoned.id::text, 0)
    );

    update public.customers as target
    set auth_user_id = null,
        email = 'erased+' || replace(abandoned.id::text, '-', '') || '@privacy.invalid',
        email_hmac = null,
        email_verified_at = null,
        full_name = null,
        date_of_birth = null,
        phone_hmac = null,
        phone_ciphertext = null,
        phone_last4 = null,
        phone_country = null,
        phone_verified_at = null,
        updated_at = now()
    where target.id = abandoned.id
      and target.updated_at < p_cutoff
      and target.phone_hmac is not null
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = abandoned.id
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = abandoned.id
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = abandoned.id
      )
      and not exists (
        select 1 from public.consent_records
        where consent_records.customer_id = abandoned.id
      )
      and not exists (
        select 1 from public.customer_sessions sessions
        where sessions.customer_id = abandoned.id
          and sessions.revoked_at is null
          and sessions.expires_at > now()
          and sessions.last_seen_at >= p_cutoff
      )
      and not exists (
        select 1 from public.referrals
        where referrals.referrer_customer_id = abandoned.id
           or referrals.referred_customer_id = abandoned.id
      )
      and not exists (
        select 1 from public.audit_logs
        where audit_logs.customer_id = abandoned.id
          and audit_logs.action = 'data_request_logged'
      )
      and not exists (
        select 1 from public.pending_reward_invites invites
        where invites.matched_customer_id = abandoned.id
           or invites.attached_customer_id = abandoned.id
           or invites.phone_hmac = target.phone_hmac
           or (
             target.email_hmac is not null
             and invites.email_hmac = target.email_hmac
           )
      );

    if not found then
      continue;
    end if;

    update public.customer_sessions
    set revoked_at = now()
    where customer_id = abandoned.id
      and revoked_at is null;

    update public.push_subscriptions
    set enabled = false,
        revoked_at = coalesce(revoked_at, now()),
        updated_at = now()
    where customer_id = abandoned.id;

    update public.notification_events
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now(),
        metadata = metadata || jsonb_build_object(
          'cancelled_reason',
          'abandoned_identity_erased'
        )
    where customer_id = abandoned.id
      and status in ('queued', 'delivering');

    purged_count := purged_count + 1;
  end loop;

  perform set_config('app.customer_erasure', '', true);
  return purged_count;
end;
$$;

revoke all on function public.admin_purge_abandoned_customer_identities(timestamptz)
  from public, anon, authenticated;
grant execute on function public.admin_purge_abandoned_customer_identities(timestamptz)
  to service_role;
