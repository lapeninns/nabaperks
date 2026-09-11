-- Venue code — accept a valid code without a prior recorded refusal.
--
-- 20260908100000 made issue_venue_code_stamp require a fraud_flags refusal row
-- (self_service_geofence_out_of_range / _unverified) from the last fifteen
-- minutes, raising NBS14 otherwise. That row was never a control: any client
-- can create one by posting a stamp with location_status = 'denied' from
-- anywhere, and the QR id is static per venue. It only forced one wasted GPS
-- submit — charged against the stamp attempt bucket — before the code could
-- be used. On 2026-09-10 a member with location blocked and the unverified
-- grace spent hit that bucket ten times and lost the code form entirely.
--
-- The rotating daily code, the ten-minute boundary, the lockout ledger, the
-- daily one-stamp rule, QR proof, billing, membership ownership and the
-- receipt written in the same transaction are the controls, and every one of
-- them is unchanged here.
--
-- WHAT CHANGES
--   * venue_code_stamp_receipts gains entry_context:
--       after_location_refusal  the receipt answers a recorded refusal (as
--                               before: refusal_flag_id and
--                               original_failure_reason are set)
--       direct_venue_code       the member went straight to the code; both
--                               refusal columns are null
--     Existing rows default to after_location_refusal.
--   * issue_venue_code_stamp no longer raises NBS14. When a recent refusal
--     exists it is still linked and marked reviewed, exactly as before.
--
-- NBS14 stays classified in lib/customer/experience/block-reasons.ts so a
-- client that reaches a database without this migration still gets copy.
--
-- Nothing here logs, raises or records the code, the seed or coordinates.
--
-- Forward-only and re-runnable.

-- 1. Receipt shape ---------------------------------------------------------------
alter table public.venue_code_stamp_receipts
  add column if not exists entry_context text not null
    default 'after_location_refusal';

alter table public.venue_code_stamp_receipts
  alter column original_failure_reason drop not null;

alter table public.venue_code_stamp_receipts
  drop constraint if exists venue_code_stamp_receipts_failure_reason_check,
  drop constraint if exists venue_code_stamp_receipts_entry_context_check;
alter table public.venue_code_stamp_receipts
  add constraint venue_code_stamp_receipts_entry_context_check
    check (entry_context in ('after_location_refusal', 'direct_venue_code'))
    not valid,
  add constraint venue_code_stamp_receipts_failure_reason_check
    check (
      (
        entry_context = 'direct_venue_code'
        and original_failure_reason is null
        and refusal_flag_id is null
      )
      or (
        entry_context = 'after_location_refusal'
        and original_failure_reason in ('location_out_of_range', 'location_required')
      )
    )
    not valid;
alter table public.venue_code_stamp_receipts
  validate constraint venue_code_stamp_receipts_entry_context_check;
alter table public.venue_code_stamp_receipts
  validate constraint venue_code_stamp_receipts_failure_reason_check;

comment on column public.venue_code_stamp_receipts.entry_context is
  'after_location_refusal: the code answered a server-recorded location refusal (refusal columns set). direct_venue_code: the member used the code without a prior refusal (refusal columns null).';

-- 2. Verify the code and issue the stamp -----------------------------------------
-- Same signature and grants as 20260908100000; only the refusal precondition
-- and the receipt/evidence shape change.
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
  v_entry_context text;
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

  -- Right code. If the server recorded a location refusal for this membership
  -- recently, the receipt answers it and the flag is marked reviewed below.
  -- If not, the code stands on its own: it is the presence proof, and the
  -- daily limit, QR proof and every other refusal still apply unchanged.
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
    v_entry_context := 'direct_venue_code';
    v_reason := null;
  else
    v_entry_context := 'after_location_refusal';
    v_reason := case v_flag.signal
      when 'self_service_geofence_out_of_range' then 'location_out_of_range'
      else 'location_required'
    end;
  end if;

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
    refusal_flag_id, original_failure_reason, entry_context, code_day, device_hash
  )
  values (
    v_membership.merchant_id, v_card.location_id, v_membership.customer_id,
    p_membership_id, v_card.id, v_flag.id, v_reason, v_entry_context, v_day,
    v_device_hash
  )
  returning id into v_receipt_id;

  select *
  into v_stamp
  from private.issue_qr_visit_stamp(
    p_membership_id, p_customer_id, p_qr_id,
    null, null, null, 'venue_code', null,
    p_referral_bonuses_pre_drained,
    p_customer_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'kind', 'venue_code',
      'receipt_id', v_receipt_id,
      'entry_context', v_entry_context,
      'refusal_flag_id', v_flag.id,
      'original_failure_reason', v_reason,
      'code_day', v_day,
      'device_hash', v_device_hash
    ))
  );

  if v_stamp.stamp_event_id is null then
    -- A separately settled referral bonus filled the card first; no visit was
    -- recorded (see private.issue_qr_visit_stamp), so there is nothing for the
    -- receipt to evidence.
    delete from public.venue_code_stamp_receipts receipts
    where receipts.id = v_receipt_id;
  else
    if v_flag.id is not null then
      update public.fraud_flags flags
      set status = 'reviewed',
          updated_at = now(),
          metadata = coalesce(flags.metadata, '{}'::jsonb) || jsonb_build_object(
            'reviewed_by', 'venue_code',
            'receipt_id', v_receipt_id
          )
      where flags.id = v_flag.id
        and flags.status = 'open';
    end if;

    insert into public.audit_logs (
      actor_type, actor_id, merchant_id, customer_id,
      target_table, target_id, action, metadata
    )
    values (
      'customer', p_customer_id::text,
      v_membership.merchant_id, v_membership.customer_id,
      'stamp_events', v_stamp.stamp_event_id, 'venue_code_stamp_issued',
      jsonb_strip_nulls(jsonb_build_object(
        'receipt_id', v_receipt_id,
        'entry_context', v_entry_context,
        'original_failure_reason', v_reason,
        'code_day', v_day,
        'new_stamp_count', v_stamp.new_stamp_count
      ))
    );

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id,
      actor_type, actor_id, metadata
    ) values (
      'venue_code_stamp_issued', v_membership.merchant_id, v_membership.customer_id,
      p_membership_id, 'customer', p_customer_id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'outcome', 'issued',
        'entry_context', v_entry_context,
        'original_failure_reason', v_reason,
        'new_stamp_count', v_stamp.new_stamp_count
      ))
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
  'Verifies today''s venue code (returning code_rejected / locked_out rather than raising), writes the receipt — linked to a recent server-recorded location refusal when one exists, direct otherwise — and issues the visit stamp through the shared QR transaction with only the location check bypassed.';
