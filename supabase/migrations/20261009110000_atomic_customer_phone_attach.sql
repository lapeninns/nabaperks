-- Adding a proven phone to a wallet is one locked transaction.
--
-- Until now the app attached a phone with three PostgREST writes: stage the
-- phone without its verified timestamp, write the customer_phone_attached
-- audit row, then set phone_verified_at. Nothing locked the customer row, so
-- (QA 38c42a1..2c45031):
--
-- * BUG-002: an admin erasure committing between the app's checks and its
--   staging write left the erased row with a verified phone. Erasure sets
--   phone_verified_at to null, which is exactly what the staging guard
--   accepted, and phone sign-in then opened the erased wallet again.
-- * BUG-013: two overlapping confirmations on one wallet each wrote an audit
--   row, and the loser's "mark verified" step found nothing to mark and threw
--   (HTTP 500).
--
-- attach_verified_customer_phone does the whole attach in one transaction:
-- it locks the customer row (FOR UPDATE), re-checks that the wallet is live
-- (not the erased+...@privacy.invalid placeholder every erasure path writes)
-- and has no verified phone, checks that no other wallet holds the phone HMAC,
-- writes the phone with phone_verified_at, and inserts exactly one audit row.
-- It returns a status the app maps to its existing result type:
-- attached | already_has_phone | contact_conflict | wallet_unavailable |
-- audit_failed (the audit insert failed, so the phone write was undone too).
--
-- admin_erase_customer_pii now takes the same row lock before it reads the
-- contact it scrubs, so an erasure and an attach on one wallet serialise:
-- whichever commits second sees the other's result. Its body is otherwise
-- unchanged from 20261006100500, including the erasure GUC and the grants.
-- Only the row lock is shared (no advisory lock), so neither function can
-- deadlock against the purge functions, which take their advisory lock before
-- the row.
--
-- Compatibility: the deployed app (2c45031c) still attaches with the three
-- PostgREST writes and does not call this function. Nothing it writes or reads
-- changes: no table, column, index or trigger is altered. The row lock in the
-- erasure only makes its own read consistent. The new app needs this
-- function, so this migration must be applied before that app is promoted.
--
-- Forward-only and re-runnable (create or replace; grants re-asserted).

create or replace function public.attach_verified_customer_phone(
  p_customer_id uuid,
  p_phone_hmac text,
  p_phone_ciphertext text,
  p_phone_last4 text,
  p_phone_country text,
  p_surface text
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_customer record;
  v_step text := 'phone';
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'attach_verified_customer_phone requires the service role';
  end if;

  if p_customer_id is null
     or coalesce(p_phone_hmac, '') !~ '^[0-9a-f]{64}$'
     or coalesce(btrim(p_phone_ciphertext), '') = ''
     or coalesce(p_phone_last4, '') !~ '^[0-9]{4}$'
     or coalesce(p_phone_country, '') !~ '^[A-Z]{2}$' then
    raise exception using
      errcode = 'invalid_parameter_value',
      message = 'A customer id and a complete phone identity are required';
  end if;

  -- The same vocabulary as lib/customer/contact-event-core.ts.
  if p_surface is null or p_surface not in (
    'home_prompt', 'stamp_prompt', 'profile', 'reward_gate', 'home_login', 'join'
  ) then
    raise exception using
      errcode = 'invalid_parameter_value',
      message = 'Unsupported contact surface';
  end if;

  -- Serialises with admin_erase_customer_pii, the purge functions and any
  -- other attach on this wallet. Under READ COMMITTED the row returned after
  -- the wait is the committed one, so the checks below see an erasure or an
  -- attach that finished while this call waited.
  select customers.id, customers.email, customers.phone_verified_at
  into v_customer
  from public.customers
  where customers.id = p_customer_id
  for update;

  if not found
     or coalesce(v_customer.email, '') like 'erased+%@privacy.invalid' then
    return 'wallet_unavailable';
  end if;

  if v_customer.phone_verified_at is not null then
    return 'already_has_phone';
  end if;

  if exists (
    select 1 from public.customers
    where customers.phone_hmac = p_phone_hmac
      and customers.id <> p_customer_id
  ) then
    return 'contact_conflict';
  end if;

  begin
    update public.customers
    set phone_hmac = p_phone_hmac,
        phone_ciphertext = p_phone_ciphertext,
        phone_last4 = p_phone_last4,
        phone_country = p_phone_country,
        phone_verified_at = now(),
        updated_at = now()
    where customers.id = p_customer_id;

    v_step := 'audit';
    insert into public.audit_logs (
      actor_type, actor_id, customer_id, target_table, target_id, action, metadata
    )
    values (
      'customer', p_customer_id::text, p_customer_id, 'customers', p_customer_id,
      'customer_phone_attached', jsonb_build_object('surface', p_surface)
    );
  exception
    -- Both handlers roll the block back, so neither outcome leaves a phone.
    when unique_violation then
      if v_step = 'phone' then
        -- Another wallet committed this phone after the check above.
        return 'contact_conflict';
      end if;
      return 'audit_failed';
    when others then
      if v_step = 'audit' then
        return 'audit_failed';
      end if;
      raise;
  end;

  return 'attached';
end;
$function$;

revoke all on function public.attach_verified_customer_phone(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.attach_verified_customer_phone(uuid, text, text, text, text, text)
  to service_role;

comment on function public.attach_verified_customer_phone(uuid, text, text, text, text, text) is
  'Adds a proven phone to a live wallet without a verified phone, with its customer_phone_attached audit row, in one transaction under the customer row lock. Service role only.';

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

  -- Lock the row before reading the contact to scrub (the same lock
  -- attach_verified_customer_phone takes), so a phone attach in flight either
  -- commits first and is read and erased here, or waits and then finds the
  -- wallet erased. Capture the phone HMAC before the update nulls it, so
  -- invites keyed only on the hashed phone can still be found and scrubbed.
  select phone_hmac, email_hmac
  into v_phone_hmac, v_email_hmac
  from public.customers
  where id = p_customer_id
  for update;

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
  -- the loyalty ledger are retained. A wallet without a phone never fires the
  -- phone_hmac erasure trigger, so its OTP trusted devices are removed here.
  delete from public.customer_otp_trusted_devices
  where customer_id = p_customer_id;

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

revoke execute on function public.admin_erase_customer_pii(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_erase_customer_pii(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
