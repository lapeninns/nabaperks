-- The 365-day stale-PII purge skips a customer who is using the app
-- (QA BUG-059, 38c42a1..2c45031).
--
-- admin_purge_stale_customer_pii treated a customer as stale when their
-- customers, membership, reward and stamp timestamps were all older than the
-- cutoff. Signing in, opening /home or viewing a card moves none of those; it
-- only moves customer_sessions.last_seen_at (touch_customer_session). So a
-- customer signed in and using their card today, whose last stamp was over a
-- year ago, was anonymised and signed out by the nightly privacy-retention
-- cron, and their card stayed on the anonymised row. Sessions now last until
-- log out, so such a customer can stay signed in for over a year.
--
-- Both the candidate select and the guarded update now also require that the
-- customer has no live session (not revoked, not expired) used since the
-- cutoff: the rule admin_purge_abandoned_customer_identities already applies
-- (20261006100400). A customer without such a session is purged exactly as
-- before. Everything else is unchanged from 20261006100500: signature,
-- security definer, search_path, the service-role guard, the per-customer
-- advisory lock and row lock, the erasure GUC, what is scrubbed and revoked,
-- and the grants.
--
-- Compatibility: the deployed app (2c45031c) calls this function with the
-- same argument and reads the same integer result; it only purges fewer rows.
-- Forward-only and re-runnable (create or replace; grants re-asserted).

create or replace function public.admin_purge_stale_customer_pii(
  p_cutoff timestamp with time zone default (now() - '365 days'::interval)
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  stale_customer record;
  purged_count integer := 0;
  v_phone_hmac text;
  v_email_hmac text;
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'admin_purge_stale_customer_pii requires the service role';
  end if;

  perform set_config('app.customer_erasure', 'true', true);

  for stale_customer in
    select customers.id
    from public.customers
    where customers.updated_at < p_cutoff
      and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = customers.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = customers.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = customers.id
          and stamp_events.created_at >= p_cutoff
      )
      -- Signed in and used since the cutoff: an active customer (BUG-059).
      and not exists (
        select 1 from public.customer_sessions sessions
        where sessions.customer_id = customers.id
          and sessions.revoked_at is null
          and sessions.expires_at > now()
          and sessions.last_seen_at >= p_cutoff
      )
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('customer-identity:' || stale_customer.id::text, 0)
    );

    select customers.phone_hmac, customers.email_hmac
    into v_phone_hmac, v_email_hmac
    from public.customers
    where customers.id = stale_customer.id
    for update;

    update public.customers as target
    set auth_user_id = null,
        email = 'erased+' || replace(stale_customer.id::text, '-', '') || '@privacy.invalid',
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
    where target.id = stale_customer.id
      and target.updated_at < p_cutoff
      and coalesce(target.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = stale_customer.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = stale_customer.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = stale_customer.id
          and stamp_events.created_at >= p_cutoff
      )
      and not exists (
        select 1 from public.customer_sessions sessions
        where sessions.customer_id = stale_customer.id
          and sessions.revoked_at is null
          and sessions.expires_at > now()
          and sessions.last_seen_at >= p_cutoff
      );

    if not found then
      continue;
    end if;

    -- A wallet without a phone never fires the phone_hmac erasure trigger.
    delete from public.customer_otp_trusted_devices
    where customer_id = stale_customer.id;

    update public.customer_sessions
    set revoked_at = now()
    where customer_id = stale_customer.id
      and revoked_at is null;

    update public.push_subscriptions
    set enabled = false,
        revoked_at = coalesce(revoked_at, now()),
        updated_at = now()
    where customer_id = stale_customer.id;

    update public.notification_events
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now(),
        metadata = metadata || jsonb_build_object('cancelled_reason', 'customer_erased')
    where customer_id = stale_customer.id
      and status in ('queued', 'delivering');

    update public.pending_reward_invites
    set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
        email_hmac = null,
        phone_hmac = null,
        email_masked = null,
        phone_last4 = null,
        claim_token_hash = 'scrubbed:' || id::text,
        updated_at = now()
    where matched_customer_id = stale_customer.id
       or attached_customer_id = stale_customer.id
       or (v_phone_hmac is not null and phone_hmac = v_phone_hmac)
       or (v_email_hmac is not null and email_hmac = v_email_hmac);

    purged_count := purged_count + 1;
  end loop;

  perform set_config('app.customer_erasure', '', true);
  return purged_count;
end;
$function$;

revoke execute on function public.admin_purge_stale_customer_pii(timestamp with time zone)
  from public, anon, authenticated;
grant execute on function public.admin_purge_stale_customer_pii(timestamp with time zone)
  to service_role;


comment on function public.admin_purge_stale_customer_pii(timestamp with time zone) is
  'Anonymises customers with no customer, membership, reward or stamp activity and no live session used since the cutoff. Service role only.';

notify pgrst, 'reload schema';
