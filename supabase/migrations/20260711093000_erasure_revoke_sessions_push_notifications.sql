-- db privacy lifecycle — Wave-3 blocker 2: erasure must de-activate the whole
-- customer, not just the profile row.
--
-- admin_erase_customer_pii (single admin-executed erasure) and
-- admin_purge_stale_customer_pii (retention job) anonymise the customers row
-- and scrub pending invites, but leave the customer's live sessions, push
-- subscriptions, and queued notifications active — so a session keeps working
-- and further notifications still fire at an erased person.
--
-- This migration adds three revocations to BOTH functions, everything else
-- (the admin/self-role gates, anonymisation, invite scrub, audit log, and
-- return payload) is the current source definition, unchanged:
--   1. revoke every non-revoked customer_sessions row,
--   2. disable every push_subscriptions row (enabled=false + revoked_at),
--   3. cancel every not-yet-terminal notification_events row
--      (status 'queued'/'delivering' -> 'cancelled', with cancelled_at so the
--      notification_events_cancelled_coherent CHECK is satisfied).
--
-- Terminal notification history (sent/failed/cancelled/expired) and the loyalty
-- ledger are RETAINED — anonymise-not-delete is unchanged.
--
-- Forward-only and idempotent: both are CREATE OR REPLACE and re-runnable. The
-- service-role self-guard added to admin_purge_stale_customer_pii in
-- 20260711090000 is preserved verbatim, and both ACLs are re-asserted so a
-- future misgrant cannot re-expose them.

create or replace function public.admin_erase_customer_pii(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  admin_user_id uuid;
  surrogate_email text;
  erased_count integer;
  v_phone_hmac text;
  v_email_hmac text;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception 'Unsupported request channel';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Data request notes are required';
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
  end if;

  -- Capture the phone HMAC before the update nulls it, so invites keyed only on
  -- the hashed phone can still be found and scrubbed.
  select phone_hmac, email_hmac
  into v_phone_hmac, v_email_hmac
  from public.customers
  where id = p_customer_id;

  surrogate_email := 'erased+' || replace(p_customer_id::text, '-', '') || '@privacy.invalid';
  perform set_config('app.customer_erasure', 'true', true);

  update public.customers
  set
    auth_user_id = null,
    email = surrogate_email,
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
  where id = p_customer_id;

  get diagnostics erased_count = row_count;
  perform set_config('app.customer_erasure', '', true);

  if erased_count <> 1 then
    raise exception 'Customer not found';
  end if;

  -- De-activate every live surface so no session, device, or pending message
  -- keeps reaching the erased customer. History (terminal notifications) and
  -- the loyalty ledger are retained.
  update public.customer_sessions
  set revoked_at = now()
  where customer_id = p_customer_id
    and revoked_at is null;

  update public.push_subscriptions
  set enabled = false,
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where customer_id = p_customer_id;

  update public.notification_events
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now(),
      metadata = metadata || jsonb_build_object('cancelled_reason', 'customer_erased')
  where customer_id = p_customer_id
    and status in ('queued', 'delivering');

  -- Scrub any invite tied to this customer: cancel live ones, drop every hash.
  update public.pending_reward_invites
  set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
      email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
      claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
  where matched_customer_id = p_customer_id
     or attached_customer_id = p_customer_id
     or (v_phone_hmac is not null and phone_hmac = v_phone_hmac)
     or (v_email_hmac is not null and email_hmac = v_email_hmac);

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, p_merchant_id, p_customer_id, 'customers', p_customer_id,
    'customer_pii_erased',
    jsonb_build_object(
      'request_type', 'deletion', 'channel', p_channel, 'notes', trim(p_notes),
      'surrogate', surrogate_email, 'ledger_retained', true
    )
  );

  return jsonb_build_object(
    'ok', true, 'request_type', 'deletion', 'customer_id', p_customer_id,
    'surrogate', surrogate_email, 'ledger_retained', true
  );
end;
$function$;

create or replace function public.admin_purge_stale_customer_pii(
  p_cutoff timestamp with time zone default (now() - '365 days'::interval)
)
returns integer
language plpgsql
security definer
set search_path to 'public'
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
  loop
    select phone_hmac, email_hmac
    into v_phone_hmac, v_email_hmac
    from public.customers
    where id = stale_customer.id;

    update public.customers
    set
      auth_user_id = null,
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
    where id = stale_customer.id;

    -- Same de-activation as admin_erase_customer_pii, per stale customer.
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
        email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
        claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
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

-- Re-assert both ACLs explicitly (CREATE OR REPLACE keeps prior grants, but be
-- belt-and-braces): never authenticated/anon/PUBLIC; service_role only.
revoke execute on function public.admin_erase_customer_pii(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_erase_customer_pii(uuid, uuid, text, text) to service_role;
revoke execute on function public.admin_purge_stale_customer_pii(timestamp with time zone) from public, anon, authenticated;
grant execute on function public.admin_purge_stale_customer_pii(timestamp with time zone) to service_role;
