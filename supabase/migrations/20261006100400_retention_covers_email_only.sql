-- Abandoned-identity retention covers wallets created by email.
--
-- admin_purge_abandoned_customer_identities (20260713120000, the latest and
-- only definition) anonymises a customer that verified a contact but never
-- joined or earned anything. It selected only rows with a phone, so an
-- email-only wallet created at the join page and then abandoned would be kept
-- for ever. It now also covers a row with a verified email and no phone.
-- Erased placeholder rows stay excluded (their email is the erased+ surrogate
-- and email_verified_at is null). Every other eligibility rule, including the
-- pending-invite match by email_hmac, is unchanged.
--
-- The phone_hmac -> NULL trigger that removes OTP trusted devices
-- (purge_customer_otp_devices_after_erasure) never fires for a wallet without
-- a phone, so the purge now deletes the customer's trusted devices itself.
--
-- Forward-only and re-runnable (create or replace); grants re-asserted.

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
      and (
        customers.phone_hmac is not null
        or (
          customers.email_hmac is not null
          and customers.email_verified_at is not null
        )
      )
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
      and (
        target.phone_hmac is not null
        or (
          target.email_hmac is not null
          and target.email_verified_at is not null
        )
      )
      and coalesce(target.email, '') not like 'erased+%@privacy.invalid'
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

    -- A wallet without a phone never fires the phone_hmac erasure trigger.
    delete from public.customer_otp_trusted_devices
    where customer_id = abandoned.id;

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

notify pgrst, 'reload schema';
