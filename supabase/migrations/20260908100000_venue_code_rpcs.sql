-- Venue code — the RPCs that make the fallback live.
--
-- 20260907100000 laid down the seed, the receipt and the lockout ledger, and
-- 20260907100100 gave the private stamp transaction a presence argument that
-- is honoured only from a receipt written in the same transaction. This file
-- adds the four entry points:
--
--   get_venue_code_today / rotate_venue_code   owner, authenticated JWT
--   consume_venue_code_attempt                 service role, committed FIRST
--   issue_venue_code_stamp                     service role
--
-- HOW A CODE BECOMES A STAMP
-- 1. The customer scanned the venue QR and the location check refused (NBS10
--    or NBS11). The app recorded that refusal through
--    record_stamp_location_refusal in its own transaction (20260902123000).
-- 2. The customer types today's code. The app charges
--    consume_venue_code_attempt in its own transaction so the throttle survives
--    whatever happens next, then calls issue_venue_code_stamp.
-- 3. issue_venue_code_stamp verifies the code BEFORE any eligibility check and
--    NEVER raises for a wrong code — it returns a status — so the lockout
--    ledger commits. A right code then requires a server-recorded refusal on
--    this membership within the last fifteen minutes (NBS14 otherwise: a code
--    alone is not a way in), writes the receipt, and hands the shared QR
--    transaction the presence evidence. Every other refusal (billing, daily
--    limit, full card, reward pool, QR proof) propagates unchanged and rolls
--    the receipt back with it.
--
-- STABLE CODES
--   NBS14  right code, but no recent recorded location refusal
--   NBC01  attempts locked out for fifteen minutes
--   NBC02  the code is not six digits
-- Mirrored in lib/customer/experience/block-reasons.ts in this same change.
-- Wrong code is a returned status ('code_rejected' / 'locked_out'), not a code.
--
-- Nothing here logs, raises or records the code, the seed or coordinates.
--
-- Forward-only and re-runnable.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- When the current code stops being accepted (05:00 Europe/London next day).
create or replace function private.venue_code_rotates_at(
  p_at timestamptz default now()
)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $function$
  select ((private.venue_code_day(p_at) + 1)::timestamp + interval '5 hours')
    at time zone 'Europe/London';
$function$;

revoke all on function private.venue_code_rotates_at(timestamptz)
  from public, anon, authenticated, service_role;

-- 1. Owner reads today's code ---------------------------------------------------
-- Bound to auth.uid(): the caller must own the merchant. Volatile because the
-- first read of a venue creates its seed.
create or replace function public.get_venue_code_today(
  p_merchant_id uuid
)
returns table (code text, rotates_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  code := private.venue_code_for(p_merchant_id, now());
  rotates_at := private.venue_code_rotates_at(now());
  return next;
end;
$function$;

revoke all on function public.get_venue_code_today(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_venue_code_today(uuid) to authenticated;

comment on function public.get_venue_code_today(uuid) is
  'Today''s six-digit venue code for the signed-in owner''s merchant, and when it rotates. Owner only.';

-- 2. Owner resets the code ------------------------------------------------------
-- A new seed, effective immediately. Audited without the code.
create or replace function public.rotate_venue_code(
  p_merchant_id uuid
)
returns table (code text, rotates_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_owner_id uuid := (select auth.uid());
begin
  if v_owner_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  insert into private.venue_code_seeds (merchant_id, seed, rotated_at, rotated_by_user_id)
  values (p_merchant_id, extensions.gen_random_bytes(32), now(), v_owner_id)
  on conflict (merchant_id) do update
    set seed = excluded.seed,
        rotated_at = excluded.rotated_at,
        rotated_by_user_id = excluded.rotated_by_user_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  )
  values (
    'merchant', v_owner_id::text, p_merchant_id, 'merchants', p_merchant_id,
    'venue_code_reset',
    jsonb_build_object('venue_code_day', private.venue_code_day(now()))
  );

  code := private.venue_code_for(p_merchant_id, now());
  rotates_at := private.venue_code_rotates_at(now());
  return next;
end;
$function$;

revoke all on function public.rotate_venue_code(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rotate_venue_code(uuid) to authenticated;

comment on function public.rotate_venue_code(uuid) is
  'Replaces the merchant''s venue-code seed so today''s code changes immediately. Owner only; audited without the code.';

-- 3. The committed-first attempt charge ------------------------------------------
-- Runs in its own transaction before the verify call (the lesson of
-- 20260902123000): a refused attempt must still count. An active lockout
-- refuses here with NBC01 before any bucket is charged.
create or replace function public.consume_venue_code_attempt(
  p_membership_id uuid,
  p_customer_id uuid,
  p_device_hash text,
  p_network_hash text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_membership record;
  v_locked_until timestamptz;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  if p_membership_id is null or p_customer_id is null then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  select memberships.id, memberships.merchant_id, memberships.customer_id
  into v_membership
  from public.customer_memberships memberships
  where memberships.id = p_membership_id;

  if v_membership.id is null or v_membership.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  select lockouts.locked_until
  into v_locked_until
  from public.venue_code_attempt_lockouts lockouts
  where lockouts.membership_id = p_membership_id;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Too many venue code attempts'
      using errcode = 'NBC01';
  end if;

  -- Membership, then device, then venue, then network. Any refusal rolls back
  -- the earlier charges in this transaction, which is the intended shape.
  perform public.enforce_rate_limit(
    'venuecode:membership:' || p_membership_id::text, 10, 900000
  );
  if coalesce(p_device_hash, '') <> '' then
    perform public.enforce_rate_limit('venuecode:device:' || p_device_hash, 20, 900000);
  end if;
  perform public.enforce_rate_limit(
    'venuecode:merchant:' || v_membership.merchant_id::text, 100, 900000
  );
  -- Local development has no verified client IP; the network bucket is then
  -- simply not charged rather than pooling every caller under one key.
  if coalesce(p_network_hash, '') <> '' then
    perform public.enforce_rate_limit('venuecode:net:' || p_network_hash, 30, 900000);
  end if;
end;
$function$;

revoke all on function public.consume_venue_code_attempt(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_venue_code_attempt(uuid, uuid, text, text)
  to service_role;

comment on function public.consume_venue_code_attempt(uuid, uuid, text, text) is
  'Charges the venue-code attempt throttles (membership, device, venue, network) in its own transaction and refuses an active lockout with NBC01.';

-- 4. Verify the code and issue the stamp -----------------------------------------
create or replace function public.issue_venue_code_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_qr_id text,
  p_code text,
  p_device_hash text,
  p_referral_bonuses_pre_drained integer
)
returns table (
  status text,
  attempts_remaining integer,
  locked_until timestamptz,
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_membership record;
  v_entered text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  v_lock record;
  v_failed integer;
  v_window_reset boolean;
  v_flag record;
  v_reason text;
  v_card record;
  v_receipt_id uuid;
  v_stamp record;
  v_day date := private.venue_code_day(now());
  v_device_hash text := nullif(coalesce(p_device_hash, ''), '');
  v_accepted boolean;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  if p_membership_id is null or p_customer_id is null then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if v_entered !~ '^[0-9]{6}$' then
    raise exception 'Venue code must be six digits'
      using errcode = 'NBC02';
  end if;

  -- Lock the membership first so concurrent attempts on one card serialise
  -- through the lockout ledger and the daily-limit check alike.
  select memberships.id, memberships.merchant_id, memberships.customer_id
  into v_membership
  from public.customer_memberships memberships
  where memberships.id = p_membership_id
  for update;

  if v_membership.id is null or v_membership.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  select *
  into v_lock
  from public.venue_code_attempt_lockouts lockouts
  where lockouts.membership_id = p_membership_id
  for update;

  if v_lock.locked_until is not null and v_lock.locked_until > now() then
    status := 'locked_out';
    attempts_remaining := 0;
    locked_until := v_lock.locked_until;
    return next;
    return;
  end if;

  -- Today's code, or — for ten minutes after the 05:00 roll — yesterday's, so
  -- a code read out just before the boundary still lands.
  v_accepted := v_entered = coalesce(private.venue_code_for(v_membership.merchant_id, now()), '')
    or v_entered = coalesce(
      private.venue_code_for(v_membership.merchant_id, now() - interval '10 minutes'), ''
    );

  if not v_accepted then
    -- Wrong code. Recorded by RETURNING, never by raising, so the ledger commits.
    v_window_reset := v_lock.membership_id is null
      or v_lock.window_started_at < now() - interval '15 minutes';
    v_failed := case when v_window_reset then 1 else v_lock.failed_count + 1 end;

    insert into public.venue_code_attempt_lockouts (
      membership_id, merchant_id, failed_count, window_started_at, last_failed_at, locked_until
    )
    values (
      p_membership_id, v_membership.merchant_id, v_failed, now(), now(),
      case when v_failed >= 5 then now() + interval '15 minutes' end
    )
    on conflict (membership_id) do update
      set failed_count = excluded.failed_count,
          window_started_at = case
            when v_window_reset then excluded.window_started_at
            else venue_code_attempt_lockouts.window_started_at
          end,
          last_failed_at = excluded.last_failed_at,
          locked_until = excluded.locked_until,
          updated_at = now()
    returning * into v_lock;

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id,
      actor_type, actor_id, metadata
    ) values (
      'venue_code_rejected', v_membership.merchant_id, v_membership.customer_id,
      p_membership_id, 'customer', p_customer_id::text,
      jsonb_build_object(
        'outcome', 'blocked',
        'failed_count', v_lock.failed_count,
        'locked', v_lock.locked_until is not null
      )
    );

    status := case when v_lock.locked_until is not null then 'locked_out' else 'code_rejected' end;
    attempts_remaining := greatest(5 - v_lock.failed_count, 0);
    locked_until := v_lock.locked_until;
    return next;
    return;
  end if;

  -- Right code. It is a fallback for a refused location check, never a way in
  -- on its own: the refusal must have been recorded by the server recently.
  select flags.id, flags.signal
  into v_flag
  from public.fraud_flags flags
  where flags.membership_id = p_membership_id
    and flags.customer_id = p_customer_id
    and flags.signal in (
      'self_service_geofence_out_of_range', 'self_service_geofence_unverified'
    )
    and coalesce((flags.metadata->>'last_attempt_at')::timestamptz, flags.created_at)
      > now() - interval '15 minutes'
  order by coalesce((flags.metadata->>'last_attempt_at')::timestamptz, flags.created_at) desc
  limit 1
  for update;

  if v_flag.id is null then
    raise exception 'Scan the venue QR before entering today''s code'
      using errcode = 'NBS14';
  end if;

  v_reason := case v_flag.signal
    when 'self_service_geofence_out_of_range' then 'location_out_of_range'
    else 'location_required'
  end;

  delete from public.venue_code_attempt_lockouts lockouts
  where lockouts.membership_id = p_membership_id;

  select cards.id, cards.location_id
  into v_card
  from public.loyalty_cards cards
  where cards.merchant_id = v_membership.merchant_id
    and cards.is_active
  order by cards.created_at asc
  limit 1;

  if v_card.id is null then
    raise exception 'This loyalty card is not active'
      using errcode = 'NBS07';
  end if;

  -- The receipt is the only thing that can switch the location gate off, and
  -- only inside this transaction (20260907100100).
  insert into public.venue_code_stamp_receipts (
    merchant_id, location_id, customer_id, membership_id, loyalty_card_id,
    refusal_flag_id, original_failure_reason, code_day, device_hash
  )
  values (
    v_membership.merchant_id, v_card.location_id, v_membership.customer_id,
    p_membership_id, v_card.id, v_flag.id, v_reason, v_day, v_device_hash
  )
  returning id into v_receipt_id;

  select *
  into v_stamp
  from private.issue_qr_visit_stamp(
    p_membership_id, p_customer_id, p_qr_id,
    null, null, null, 'venue_code', null,
    p_referral_bonuses_pre_drained,
    p_customer_id::text,
    jsonb_build_object(
      'kind', 'venue_code',
      'receipt_id', v_receipt_id,
      'refusal_flag_id', v_flag.id,
      'original_failure_reason', v_reason,
      'code_day', v_day,
      'device_hash', v_device_hash
    )
  );

  if v_stamp.stamp_event_id is null then
    -- A separately settled referral bonus filled the card first; no visit was
    -- recorded (see private.issue_qr_visit_stamp), so there is nothing for the
    -- receipt to evidence.
    delete from public.venue_code_stamp_receipts receipts
    where receipts.id = v_receipt_id;
  else
    update public.fraud_flags flags
    set status = 'reviewed',
        updated_at = now(),
        metadata = coalesce(flags.metadata, '{}'::jsonb) || jsonb_build_object(
          'reviewed_by', 'venue_code',
          'receipt_id', v_receipt_id
        )
    where flags.id = v_flag.id
      and flags.status = 'open';

    insert into public.audit_logs (
      actor_type, actor_id, merchant_id, customer_id,
      target_table, target_id, action, metadata
    )
    values (
      'customer', p_customer_id::text,
      v_membership.merchant_id, v_membership.customer_id,
      'stamp_events', v_stamp.stamp_event_id, 'venue_code_stamp_issued',
      jsonb_build_object(
        'receipt_id', v_receipt_id,
        'original_failure_reason', v_reason,
        'code_day', v_day,
        'new_stamp_count', v_stamp.new_stamp_count
      )
    );

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id,
      actor_type, actor_id, metadata
    ) values (
      'venue_code_stamp_issued', v_membership.merchant_id, v_membership.customer_id,
      p_membership_id, 'customer', p_customer_id::text,
      jsonb_build_object(
        'outcome', 'issued',
        'original_failure_reason', v_reason,
        'new_stamp_count', v_stamp.new_stamp_count
      )
    );
  end if;

  status := 'issued';
  attempts_remaining := null;
  locked_until := null;
  stamp_event_id := v_stamp.stamp_event_id;
  new_stamp_count := v_stamp.new_stamp_count;
  reward_unlocked := v_stamp.reward_unlocked;
  return next;
end;
$function$;

revoke all on function public.issue_venue_code_stamp(uuid, uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.issue_venue_code_stamp(uuid, uuid, text, text, text, integer)
  to service_role;

comment on function public.issue_venue_code_stamp(uuid, uuid, text, text, text, integer) is
  'Verifies today''s venue code (returning code_rejected / locked_out rather than raising), requires a recent server-recorded location refusal (NBS14), writes the receipt, and issues the visit stamp through the shared QR transaction with only the location check bypassed.';

notify pgrst, 'reload schema';
