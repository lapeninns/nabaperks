-- reward_unlocked reports a reward that exists, not a full card.
--
-- private.issue_visit_stamp (last defined in 20260924100000) set
--   reward_unlocked := new_stamp_count >= stamps_required
-- and discarded the return of private.complete_cycle_if_full. That helper
-- returns null without minting when it cannot issue a reward (no active card,
-- too few earned stamps in the active cycle, or no pool item selected), so the
-- guest app could celebrate an unlock with no reward row behind it.
--
-- The body below is copied verbatim from 20260924100000 with one change: the
-- completing stamp captures the helper's reward id, and reward_unlocked is true
-- only when that id is non-null (a freshly minted reward, or the cycle's
-- existing stamp-cycle reward). A full card whose reward could not be issued
-- keeps its stamp, returns reward_unlocked = false, and stays full, which is the
-- state the card and stamp loaders already surface as "reward being sorted"
-- (customer_full_card_without_reward) and which the release/mint repair RPCs
-- heal. The public wrappers (issue_self_service_stamp, issue_venue_code_stamp,
-- join_customer_membership_with_first_stamp, retry_customer_join_first_stamp)
-- pass reward_unlocked through unchanged, so every guest stamp path inherits
-- the fix. Signature, grants and refusal order are unchanged.

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
  billing_status text;
  recent_stamp_count integer;
  v_business_date date;
  v_total_weight integer := 0;
  v_active_reward_count integer := 0;
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
  v_reward_id uuid;
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

  v_business_date := public.venue_trading_date(membership_record.merchant_id, now());

  select count(*)
  into v_active_cycle_stamp_count
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.cycle_number = membership_record.active_cycle_number;

  v_next_cycle_stamp_number := v_active_cycle_stamp_count + 1;

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

  if new_stamp_count >= card_record.stamps_required then
    v_reward_id := private.complete_cycle_if_full(
      p_membership_id,
      'self_service_qr',
      jsonb_build_object('stamp_event_id', stamp_event_id)
    );
  end if;

  -- Only a reward that exists counts as unlocked. A null id means the helper
  -- could not issue one; the stamp stands and the full card is left for the
  -- repair path rather than reported to the guest as an unlock.
  reward_unlocked := v_reward_id is not null;

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

revoke all on function private.issue_visit_stamp(uuid,uuid,numeric,numeric,numeric,text,integer,text,jsonb)
  from public, anon, authenticated, service_role;
