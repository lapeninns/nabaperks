-- Visit stamping — one private transaction for every way a stamp can be earned.
--
-- The 7-argument public.issue_self_service_stamp (20260805100100) has been the
-- only place a visit stamp is written, and its location verifier is the only
-- thing standing between a photographed poster and a free stamp. The venue-code
-- fallback (20260907100000) needs to issue a stamp that bypasses ONLY that
-- verifier, keeping every other refusal (NBS01..NBS08) and the reward unlock.
--
-- The naive way — a `p_skip_location boolean` on the public function — would
-- hand any service-role caller a location bypass. Instead:
--
--   * The body moves, verbatim, into private.issue_visit_stamp with two extra
--     arguments: the actor to record, and `p_presence jsonb`. Nothing in any
--     API role can execute it.
--   * When `p_presence` is supplied, the primitive demands a
--     venue_code_stamp_receipts row for this membership whose transaction_id is
--     pg_current_xact_id() and whose stamp has not landed yet. A receipt can
--     only be written by the venue-code RPC inside its own transaction, so no
--     caller can fabricate presence. This is the xid8 pattern from
--     private.has_current_owner_id_check (20260905141000).
--   * The 9-argument QR wrapper's body moves into private.issue_qr_visit_stamp
--     so the venue-code path gets identical QR proof and referral behaviour.
--   * Both public overloads are re-created as thin wrappers with UNCHANGED
--     identity signatures, defaults, return types and grants
--     (tests/db/rpc-catalogue-parity.test.mjs pins them). Rate limiting and
--     the auth.uid() ownership rule stay in the public 7-argument wrapper,
--     exactly where they were, and the QR wrapper still routes through it for
--     the self-service path so nothing observable changes.
--
-- Stamp metadata for a code-confirmed visit keeps source = 'self_service_qr'
-- (it IS a visit: it counts toward the geofence visit number and never buys a
-- customer out of verification) and records geo_verification = 'venue_code' —
-- never 'verified', never a manual adjustment — plus the presence evidence.
--
-- Forward-only and re-runnable. No ACL is widened.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- 1. The refusal a membership would meet before the location check ------------
-- Read-only twin of the eligibility gate below, in the same order, so a caller
-- can refuse early (or a test can prove parity) without touching any row.
create or replace function private.visit_stamp_refusal_code(
  p_membership_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  membership_record record;
  card_record record;
  billing_status text;
  v_active_cycle_stamp_count integer := 0;
  v_active_reward_count integer := 0;
  v_total_weight integer := 0;
begin
  select
    memberships.id,
    memberships.merchant_id,
    memberships.active_cycle_number,
    merchants.status as merchant_status,
    merchants.requires_billing
  into membership_record
  from public.customer_memberships memberships
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.id = p_membership_id;

  if membership_record.id is null then
    return '42501';
  end if;

  if membership_record.merchant_status not in ('trial', 'active') then
    return 'NBS04';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = membership_record.merchant_id;

  if coalesce(membership_record.requires_billing, true) and billing_status is null then
    return 'NBS05';
  end if;

  if billing_status in ('cancelled', 'suspended') then
    return 'NBS06';
  end if;

  select
    loyalty_cards.id,
    loyalty_cards.location_id,
    loyalty_cards.stamps_required
  into card_record
  from public.loyalty_cards
  where loyalty_cards.merchant_id = membership_record.merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if card_record.id is null then
    return 'NBS07';
  end if;

  select count(*)
  into v_active_cycle_stamp_count
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.cycle_number = membership_record.active_cycle_number;

  if v_active_cycle_stamp_count >= card_record.stamps_required then
    return 'NBS02';
  end if;

  if exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = p_membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = public.uk_business_date(now())
  ) then
    return 'NBS01';
  end if;

  if v_active_cycle_stamp_count + 1 >= card_record.stamps_required then
    select
      count(*),
      coalesce(sum(reward_pool_items.weight), 0)
    into v_active_reward_count, v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = membership_record.merchant_id
      and reward_pool_items.location_id = card_record.location_id
      and reward_pool_items.loyalty_card_id = card_record.id
      and reward_pool_items.is_active;

    if v_active_reward_count < 3 or v_total_weight <= 0 then
      return 'NBS03';
    end if;
  end if;

  return null;
end;
$function$;

revoke all on function private.visit_stamp_refusal_code(uuid)
  from public, anon, authenticated, service_role;

comment on function private.visit_stamp_refusal_code(uuid) is
  'The NBS refusal (or 42501) a visit stamp would meet before location verification, in the primitive''s order; null when a stamp could be issued. Read-only.';

-- 2. The private stamp primitive ---------------------------------------------
-- 20260805100100 body, with exactly these edits:
--   (a) rate limiting and the auth.uid() rule are the public wrapper's job;
--   (b) p_actor_id replaces the inline auth.uid() for event/audit attribution;
--   (c) presence evidence must be an in-transaction receipt (see header);
--   (d) with presence, the location block is skipped and the stamp is recorded
--       as geo_verification = 'venue_code' with the evidence attached.
create or replace function private.issue_visit_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_meters numeric,
  p_location_status text,
  p_capture_elapsed_ms integer,
  p_actor_id text,
  p_presence jsonb
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_actor_id text := coalesce(p_actor_id, p_customer_id::text);
  membership_record record;
  card_record record;
  reward_pool_record record;
  billing_status text;
  recent_stamp_count integer;
  v_business_date date := public.uk_business_date(now());
  v_total_weight integer := 0;
  v_active_reward_count integer := 0;
  v_weight_threshold integer;
  v_distance numeric;
  v_active_cycle_stamp_count integer := 0;
  v_next_cycle_stamp_number integer;
  v_location_status text;
  v_distance_bucket text := 'unknown';
  v_accuracy_bucket text := 'unknown';
  v_confidence text := 'none';
  v_effective_radius_meters integer;
  v_capture_elapsed_bucket text := 'unknown';
  v_visit_number integer;
  v_unverified_used integer;
  v_geo_verification text := 'exempt';
  v_presence_receipt_id uuid;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.active_cycle_number,
    merchants.status as merchant_status,
    merchants.requires_billing
  into membership_record
  from public.customer_memberships memberships
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.id = p_membership_id
  for update of memberships;

  if membership_record.id is null then
    raise insufficient_privilege using message = 'Membership not found';
  end if;

  if membership_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  -- Presence evidence is honoured only from a receipt written by this very
  -- transaction. There is no argument that can switch the location gate off.
  if p_presence is not null then
    select receipts.id
    into v_presence_receipt_id
    from public.venue_code_stamp_receipts receipts
    where receipts.membership_id = p_membership_id
      and receipts.customer_id = p_customer_id
      and receipts.transaction_id = pg_current_xact_id()
      and receipts.stamp_event_id is null
    order by receipts.created_at desc
    limit 1;

    if v_presence_receipt_id is null then
      raise insufficient_privilege
        using message = 'Presence evidence must be recorded in this transaction';
    end if;
  end if;

  if membership_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active'
      using errcode = 'NBS04';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = membership_record.merchant_id;

  if coalesce(membership_record.requires_billing, true) and billing_status is null then
    raise exception 'This merchant loyalty programme is not active yet'
      using errcode = 'NBS05';
  end if;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable'
      using errcode = 'NBS06';
  end if;

  -- One active card per merchant is guaranteed by
  -- loyalty_cards_one_active_per_merchant_idx (20260805100000); the order by
  -- survives as a deterministic tie-break for the pre-index window.
  select
    loyalty_cards.id,
    loyalty_cards.location_id,
    loyalty_cards.stamps_required,
    merchant_locations.latitude,
    merchant_locations.longitude,
    merchant_locations.geofence_radius_meters,
    merchant_locations.require_geofence,
    merchant_locations.soft_geofence_trigger_stamp_number
  into card_record
  from public.loyalty_cards
  left join public.merchant_locations on merchant_locations.id = loyalty_cards.location_id
  where loyalty_cards.merchant_id = membership_record.merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if card_record.id is null then
    raise exception 'This loyalty card is not active'
      using errcode = 'NBS07';
  end if;

  select count(*)
  into v_active_cycle_stamp_count
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.cycle_number = membership_record.active_cycle_number;

  v_next_cycle_stamp_number := v_active_cycle_stamp_count + 1;

  if v_active_cycle_stamp_count >= card_record.stamps_required then
    -- NOTE: the missing-reward heal deliberately does NOT run here. Raising
    -- below aborts the transaction, so any row minted at this point would be
    -- rolled back with it. The heal therefore lives in the sweep
    -- (release_completed_cycles_without_reward, 20260805100200), which runs in
    -- its own transaction and commits.
    raise exception 'A reward is already ready to redeem'
      using errcode = 'NBS02';
  end if;

  if exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = p_membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = v_business_date
  ) then
    raise exception 'Stamp already issued for this UK business day'
      using errcode = 'NBS01';
  end if;

  if v_next_cycle_stamp_number >= card_record.stamps_required then
    select
      count(*),
      coalesce(sum(reward_pool_items.weight), 0)
    into v_active_reward_count, v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = membership_record.merchant_id
      and reward_pool_items.location_id = card_record.location_id
      and reward_pool_items.loyalty_card_id = card_record.id
      and reward_pool_items.is_active;

    if v_active_reward_count < 3 or v_total_weight <= 0 then
      raise exception 'At least 3 active reward pool items are required before unlocking a reward'
        using errcode = 'NBS03';
    end if;
  end if;

  -- Graduated location verification ------------------------------------------
  -- The rule, in one sentence: refuse a stamp only when the device has told us
  -- where it is and that place is not the venue.
  --
  -- Visits 1 and 2 of a membership are exempt outright, so joining and the first
  -- return are never gated on a permission prompt. `v_visit_number` counts this
  -- membership's own in-venue scans for all time, not the cycle, so a customer on
  -- their third card does not get a fresh exemption.
  --
  -- From visit 3 the outcome is one of three, and only one of them refuses:
  --   verified   — coordinates supplied and inside the effective radius.
  --   REFUSED    — coordinates supplied and outside it. This is the only case
  --                where we hold positive evidence of absence, so it is the only
  --                case that blocks.
  --   unverified — permission denied, timed out, unsupported, or the fix was too
  --                imprecise to judge. A phone with location off is not a fraud
  --                signal, so the stamp is allowed against a small lifetime grace
  --                budget and recorded as unverified. Only when that budget is
  --                spent does the customer meet a refusal, and it names the fix.
  --
  -- A code-confirmed visit (p_presence) skips this block entirely: a team member
  -- has told the customer today's code in person, which is stronger evidence
  -- than a phone that said nothing. It is recorded as 'venue_code', never as
  -- 'verified', and it does not draw on the unverified grace budget.
  --
  -- Promotional grants (offer campaigns, loyalty invites) never carry
  -- 'self_service_qr' and so neither consume the exemption nor the grace budget:
  -- they are not visits and must not buy a customer out of verification.
  select count(*)
  into v_visit_number
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.metadata->>'source' = 'self_service_qr';

  v_visit_number := v_visit_number + 1;

  geo_flagged := false;
  v_location_status := 'not_applicable_before_trigger';

  if p_capture_elapsed_ms is not null then
    v_capture_elapsed_bucket := case
      when p_capture_elapsed_ms < 0 then 'invalid'
      when p_capture_elapsed_ms <= 500 then 'under_500ms'
      when p_capture_elapsed_ms <= 1200 then '500_1200ms'
      when p_capture_elapsed_ms <= 3000 then '1200_3000ms'
      else 'over_3000ms'
    end;
  end if;

  if p_presence is not null then
    v_location_status := 'venue_code';
    v_geo_verification := 'venue_code';
    v_confidence := 'attested';
  elsif coalesce(card_record.require_geofence, true)
    and v_visit_number >= public.geofence_first_verified_visit(
      card_record.soft_geofence_trigger_stamp_number
    )
  then
    v_location_status := lower(coalesce(nullif(trim(p_location_status), ''), ''));

    if v_location_status not in (
      'granted', 'denied', 'denied_remembered', 'timeout', 'unsupported', 'unavailable'
    ) then
      v_location_status := case
        when p_latitude is not null and p_longitude is not null then 'granted'
        else 'unavailable'
      end;
    end if;

    if v_location_status = 'granted' then
      if p_latitude is null
        or p_longitude is null
        or card_record.latitude is null
        or card_record.longitude is null then
        v_location_status := 'unavailable';
      elsif p_latitude < -90
        or p_latitude > 90
        or p_longitude < -180
        or p_longitude > 180 then
        v_location_status := 'invalid_coordinates';
      elsif p_accuracy_meters is null then
        v_location_status := 'accuracy_unknown';
        v_confidence := 'low';
      elsif p_accuracy_meters < 0 then
        v_location_status := 'invalid_accuracy';
      else
        v_accuracy_bucket := case
          when p_accuracy_meters <= 25 then 'accuracy_0_25m'
          when p_accuracy_meters <= 100 then 'accuracy_25_100m'
          else 'accuracy_over_100m'
        end;
        v_effective_radius_meters := (
          card_record.geofence_radius_meters + least(p_accuracy_meters, 100) + 10
        )::integer;
        v_distance := public.geo_distance_meters(
          p_latitude, p_longitude, card_record.latitude, card_record.longitude
        );
        v_distance_bucket := case
          when v_distance <= card_record.geofence_radius_meters then 'in_range'
          when v_distance <= v_effective_radius_meters then 'near_margin'
          when v_distance <= 250 then 'out_100_250m'
          when v_distance <= 1000 then 'out_250_1000m'
          else 'out_1km_plus'
        end;

        if p_accuracy_meters > 100 then
          -- Too imprecise to accuse anyone: treated as unverified, not absent.
          v_location_status := 'poor_accuracy';
          v_confidence := 'low';
        elsif v_distance > v_effective_radius_meters then
          v_location_status := 'out_of_range';
          v_confidence := 'medium';
          geo_flagged := true;
          v_geo_verification := 'refused';
          -- No flag is written here, deliberately. Raising below aborts the
          -- transaction, so anything recorded at this point is rolled back with
          -- it — verified empirically: the fraud_flags row never survived.
          -- The refusal is instead recorded by the caller through
          -- record_stamp_location_refusal (20260805100600), which runs in its
          -- own transaction and therefore commits. Losing this signal would be
          -- the worst outcome of the three: out-of-range is the one case we
          -- actually want to see.
          raise exception 'This stamp needs you to be at the venue'
            using errcode = 'NBS10';
        else
          v_location_status := 'in_range';
          v_confidence := 'medium';
          v_geo_verification := 'verified';
        end if;
      end if;
    end if;

    -- Anything that did not resolve to a verified fix is unverified. It is
    -- allowed while the membership still has grace, and refused after that.
    if v_geo_verification <> 'verified' then
      v_geo_verification := 'unverified';
      geo_flagged := true;

      select count(*)
      into v_unverified_used
      from public.stamp_events
      where stamp_events.membership_id = p_membership_id
        and stamp_events.event_type = 'earned'
        and stamp_events.metadata->>'geo_verification' = 'unverified';

      if v_unverified_used >= public.geofence_unverified_grace_limit() then
        raise exception 'Turn on location for this venue to collect your stamp'
          using errcode = 'NBS11';
      end if;
    end if;
  end if;

  begin
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      card_record.id,
      card_record.location_id,
      'earned',
      1,
      v_business_date,
      membership_record.active_cycle_number,
      jsonb_build_object(
        'source', 'self_service_qr',
        'geo_flagged', geo_flagged,
        'geo_verification', v_geo_verification,
        'visit_number', v_visit_number,
        'cycle_stamp_number', v_next_cycle_stamp_number,
        'location_status', v_location_status,
        'distance_bucket', v_distance_bucket,
        'accuracy_bucket', v_accuracy_bucket,
        'confidence', v_confidence,
        'configured_radius_meters', card_record.geofence_radius_meters,
        'effective_radius_meters', v_effective_radius_meters,
        'capture_elapsed_bucket', v_capture_elapsed_bucket
      ) || case
        when p_presence is null then '{}'::jsonb
        else jsonb_build_object('presence_evidence', p_presence)
      end
    )
    returning id into stamp_event_id;
  exception
    when unique_violation then
      raise exception 'Stamp already issued for this UK business day'
        using errcode = 'NBS01';
  end;

  if v_presence_receipt_id is not null then
    update public.venue_code_stamp_receipts receipts
    set stamp_event_id = issue_visit_stamp.stamp_event_id
    where receipts.id = v_presence_receipt_id;
  end if;

  update public.customer_memberships
  set
    current_stamp_count = v_next_cycle_stamp_number,
    total_stamps_earned = total_stamps_earned + 1,
    last_visit_at = now()
  where customer_memberships.id = p_membership_id
  returning current_stamp_count into new_stamp_count;

  reward_unlocked := new_stamp_count >= card_record.stamps_required;

  if reward_unlocked then
    if membership_record.active_cycle_number = 1 then
      select *
      into reward_pool_record
      from public.reward_pool_items
      where reward_pool_items.merchant_id = membership_record.merchant_id
        and reward_pool_items.location_id = card_record.location_id
        and reward_pool_items.loyalty_card_id = card_record.id
        and reward_pool_items.is_active
      order by reward_pool_items.display_order asc,
        reward_pool_items.created_at asc,
        reward_pool_items.id asc
      limit 1;
    else
      v_weight_threshold := floor(random() * v_total_weight)::integer + 1;

      select *
      into reward_pool_record
      from (
        select
          reward_pool_items.*,
          sum(reward_pool_items.weight) over (
            order by reward_pool_items.display_order asc,
              reward_pool_items.created_at asc,
              reward_pool_items.id asc
          ) as running_weight
        from public.reward_pool_items
        where reward_pool_items.merchant_id = membership_record.merchant_id
          and reward_pool_items.location_id = card_record.location_id
          and reward_pool_items.loyalty_card_id = card_record.id
          and reward_pool_items.is_active
      ) weighted_items
      where weighted_items.running_weight >= v_weight_threshold
      order by weighted_items.running_weight asc
      limit 1;
    end if;

    -- The pool was counted earlier in this same transaction, but a merchant can
    -- deactivate an item between that count and this select. Previously the null
    -- row reached the reward_events insert and failed a NOT NULL constraint,
    -- which rolled back the customer's stamp for a venue-side edit. Now the
    -- refusal is explicit, named, and classified as a pool problem — the same
    -- answer the customer would have received a moment earlier.
    if reward_pool_record.id is null then
      raise exception 'At least 3 active reward pool items are required before unlocking a reward'
        using errcode = 'NBS03';
    end if;

    insert into public.reward_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, reward_pool_item_id,
      reward_name, reward_terms, redeemable_from, status, cycle_number, metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      card_record.id,
      reward_pool_record.id,
      reward_pool_record.reward_name,
      reward_pool_record.reward_terms,
      public.next_uk_business_date(now()),
      'unlocked',
      membership_record.active_cycle_number,
      jsonb_build_object(
        'source', 'self_service_qr',
        'selection_mode',
        case
          when membership_record.active_cycle_number = 1 then 'first_cycle_default'
          else 'weighted_random'
        end
      )
    );

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'reward_unlocked', membership_record.merchant_id, membership_record.customer_id,
      p_membership_id, 'system', null,
      jsonb_build_object(
        'loyalty_card_id', card_record.id,
        'reward_pool_item_id', reward_pool_record.id
      )
    );
  end if;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'stamp_issued', membership_record.merchant_id, membership_record.customer_id,
    p_membership_id, 'customer',
    v_actor_id,
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'geo_flagged', geo_flagged,
      'geo_verification', v_geo_verification,
      'visit_number', v_visit_number,
      'cycle_stamp_number', v_next_cycle_stamp_number,
      'location_status', v_location_status
    )
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id,
    target_table, target_id, action, metadata
  )
  values (
    'customer', v_actor_id,
    membership_record.merchant_id, membership_record.customer_id,
    'customer_memberships', p_membership_id, 'stamp_issued',
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'geo_flagged', geo_flagged,
      'geo_verification', v_geo_verification,
      'visit_number', v_visit_number,
      'cycle_stamp_number', v_next_cycle_stamp_number,
      'location_status', v_location_status
    )
  );

  -- Velocity, scoped to this membership. The previous form counted every stamp
  -- at the venue in 15 minutes and fired at 20, which a busy Friday service
  -- reaches honestly; a signal that fires on success trains its readers to
  -- ignore it. One card cannot legitimately be stamped 3 times in 15 minutes,
  -- so that is what is worth a look.
  select count(*)
  into recent_stamp_count
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.metadata->>'source' = 'self_service_qr'
    and stamp_events.created_at > now() - interval '15 minutes';

  if recent_stamp_count >= 3 and not exists (
    select 1
    from public.fraud_flags
    where fraud_flags.membership_id = p_membership_id
      and fraud_flags.signal = 'high_stamp_velocity'
      and fraud_flags.status = 'open'
      and fraud_flags.created_at > now() - interval '15 minutes'
  ) then
    insert into public.fraud_flags (
      merchant_id, customer_id, membership_id, signal, severity, metadata
    )
    values (
      membership_record.merchant_id, membership_record.customer_id, p_membership_id,
      'high_stamp_velocity', 'medium',
      jsonb_build_object(
        'threshold', 3,
        'window_minutes', 15,
        'observed_stamp_count', recent_stamp_count,
        'scope', 'membership'
      )
    );
  end if;

  return next;
end;
$function$;

revoke all on function private.issue_visit_stamp(
  uuid, uuid, numeric, numeric, numeric, text, integer, text, jsonb
) from public, anon, authenticated, service_role;

comment on function private.issue_visit_stamp(uuid, uuid, numeric, numeric, numeric, text, integer, text, jsonb) is
  'The one visit-stamp transaction. Location is verified unless p_presence names a receipt written in this same transaction; every other refusal (NBS01..NBS08) and the reward unlock apply regardless.';

-- 3. The public 7-argument primitive, now a wrapper --------------------------
-- Identity signature, defaults, return type and grants are unchanged. It keeps
-- the two things that belong to a caller-facing entry point — the rate limit
-- and the auth.uid() ownership rule — in the same order as before, then
-- delegates with no presence evidence.
create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_meters numeric default null,
  p_location_status text default null,
  p_capture_elapsed_ms integer default null
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  current_user_id uuid := (select auth.uid());
  v_membership_customer_id uuid;
  v_auth_user_id uuid;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.enforce_rate_limit('selfstamp:' || p_membership_id::text, 10, 900000);

  select memberships.customer_id, customers.auth_user_id
  into v_membership_customer_id, v_auth_user_id
  from public.customer_memberships memberships
  join public.customers customers on customers.id = memberships.customer_id
  where memberships.id = p_membership_id;

  if v_membership_customer_id is null then
    raise insufficient_privilege using message = 'Membership not found';
  end if;

  if v_membership_customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or v_auth_user_id is null
      or v_auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Membership ownership required';
    end if;
  end if;

  return query
  select
    stamp.stamp_event_id, stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
  from private.issue_visit_stamp(
    p_membership_id, p_customer_id, p_latitude, p_longitude,
    p_accuracy_meters, p_location_status, p_capture_elapsed_ms,
    coalesce(current_user_id::text, p_customer_id::text),
    null::jsonb
  ) stamp;
end;
$function$;

comment on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer) is
  'Core visit-stamp entry point. Refusals carry stable SQLSTATEs (NBS01..NBS11); location is verified from the third visit of a membership and only a positive out-of-range fix refuses. Delegates to private.issue_visit_stamp with no presence evidence.';

revoke all on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer)
  from public, anon, authenticated;
grant execute on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer)
  to service_role;

-- 4. The private QR visit-stamp transaction -----------------------------------
-- 20260805100300 wrapper body, verbatim, plus p_actor_id / p_presence. For the
-- self-service path (p_presence null) it still routes through the public
-- 7-argument wrapper so the rate limit and ownership rule fire exactly as
-- before. With presence it calls the private primitive directly: the caller
-- has already proved the customer and written the receipt.
create or replace function private.issue_qr_visit_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_qr_id text,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_meters numeric,
  p_location_status text,
  p_capture_elapsed_ms integer,
  p_referral_bonuses_pre_drained integer,
  p_actor_id text,
  p_presence jsonb
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_membership record;
  v_drained integer := coalesce(p_referral_bonuses_pre_drained, 0);
  v_qr_id text := trim(coalesce(p_qr_id, ''));
begin
  if v_qr_id = '' then
    raise exception 'Venue QR scan proof required' using errcode = 'NBS08';
  end if;

  select
    memberships.merchant_id,
    memberships.customer_id,
    cards.id as loyalty_card_id,
    cards.stamps_required
  into v_membership
  from public.customer_memberships memberships
  join public.loyalty_cards cards
    on cards.merchant_id = memberships.merchant_id
   and cards.is_active
  where memberships.id = p_membership_id
    and memberships.customer_id = p_customer_id
  order by cards.created_at asc
  limit 1;

  if v_membership.merchant_id is null then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if not exists (
    select 1
    from public.qr_codes qr_codes
    where qr_codes.qr_id = v_qr_id
      and qr_codes.merchant_id = v_membership.merchant_id
      and qr_codes.loyalty_card_id = v_membership.loyalty_card_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
  ) then
    raise exception 'Valid venue QR scan proof required' using errcode = 'NBS08';
  end if;

  if p_referral_bonuses_pre_drained is null then
    begin
      v_drained := public.drain_due_referrer_bonuses_for_membership(p_membership_id);
    exception
      when others then
        raise warning 'referral settle-before-stamp skipped for %: %', p_membership_id, sqlerrm;
    end;
  end if;

  if v_drained > 0 then
    select memberships.current_stamp_count
    into new_stamp_count
    from public.customer_memberships memberships
    where memberships.id = p_membership_id;

    if new_stamp_count >= v_membership.stamps_required then
      -- No visit is recorded here: a full card cannot enter the normal location
      -- verifier, so counting this scan as an in-venue visit would weaken the
      -- integrity of the merchant's return-visit metric.
      stamp_event_id := null;
      reward_unlocked := true;
      geo_flagged := false;
      return next;
      return;
    end if;
  end if;

  if p_presence is null then
    select
      stamp.stamp_event_id, stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
    into
      stamp_event_id, new_stamp_count, reward_unlocked, geo_flagged
    from public.issue_self_service_stamp(
      p_membership_id, p_customer_id, p_latitude, p_longitude,
      p_accuracy_meters, p_location_status, p_capture_elapsed_ms
    ) stamp;
  else
    select
      stamp.stamp_event_id, stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
    into
      stamp_event_id, new_stamp_count, reward_unlocked, geo_flagged
    from private.issue_visit_stamp(
      p_membership_id, p_customer_id, p_latitude, p_longitude,
      p_accuracy_meters, p_location_status, p_capture_elapsed_ms,
      p_actor_id, p_presence
    ) stamp;
  end if;

  begin
    perform public.award_referrer_bonus_stamp(p_membership_id, stamp_event_id);
  exception
    when others then
      raise warning 'referral bonus skipped for membership %: %', p_membership_id, sqlerrm;
      insert into public.product_events (
        event_name, merchant_id, customer_id, membership_id,
        actor_type, actor_id, metadata
      ) values (
        'referral_bonus_failed', v_membership.merchant_id,
        v_membership.customer_id, p_membership_id, 'system', 'system',
        jsonb_build_object(
          'outcome', 'failed',
          'stage', 'award_on_stamp',
          'sqlstate', sqlstate,
          'error', left(sqlerrm, 500),
          'stamp_event_id', stamp_event_id
        )
      );
  end;

  return next;
end;
$function$;

revoke all on function private.issue_qr_visit_stamp(
  uuid, uuid, text, numeric, numeric, numeric, text, integer, integer, text, jsonb
) from public, anon, authenticated, service_role;

comment on function private.issue_qr_visit_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer, text, jsonb) is
  'QR visit-stamp transaction shared by self-service stamping and the venue-code fallback: QR proof, referral settle-before-stamp, the stamp itself, and post-stamp referral degradation.';

-- 5. The public 9-argument QR wrapper, now a wrapper ---------------------------
-- Identity signature, defaults, return type and grants are unchanged.
create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_qr_id text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_meters numeric default null,
  p_location_status text default null,
  p_capture_elapsed_ms integer default null,
  p_referral_bonuses_pre_drained integer default null
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
begin
  return query
  select
    stamp.stamp_event_id, stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
  from private.issue_qr_visit_stamp(
    p_membership_id, p_customer_id, p_qr_id, p_latitude, p_longitude,
    p_accuracy_meters, p_location_status, p_capture_elapsed_ms,
    p_referral_bonuses_pre_drained,
    null::text,
    null::jsonb
  ) stamp;
end;
$function$;

comment on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer) is
  'QR visit-stamp wrapper. Accepts a separately committed pre-drain count, keeps full-card scans out of visit metrics, and writes post-stamp referral degradation to product_events. Delegates to private.issue_qr_visit_stamp with no presence evidence.';

revoke all on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
