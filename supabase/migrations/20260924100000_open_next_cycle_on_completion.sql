-- Completed stamp cycles issue a reward and immediately open the next card.
--
-- WHAT CHANGES
--   * Policy snapshots are attached before every v2 stamp-cycle reward insert.
--   * A reward insert opens the next cycle atomically for every minting path.
--   * The shared completion helper heals ledger-complete cycles without a reward.
--   * One cutover reconciles every membership to the reward ledger and opens held cards.
--   * Redemption and expiry increment outcome counters without changing cycle arithmetic.
--
-- Forward-only and re-runnable. The cutover is intentionally forward-fix only.

alter table public.customer_memberships
  add column if not exists policy_cutover_notice_at timestamptz;

create or replace function public.snapshot_cycle_reward_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_card record;
  v_age_check boolean := true;
  v_boundary time := time '05:00';
begin
  select cards.reward_policy_version, cards.reward_expires_after_days,
         cards.minimum_spend_pence, cards.one_transaction_per_stamp,
         cards.location_id, locations.trading_day_starts_at
  into v_card
  from public.loyalty_cards cards
  left join public.merchant_locations locations on locations.id = cards.location_id
  where cards.id = new.loyalty_card_id;

  new.reward_policy_version := coalesce(v_card.reward_policy_version, 'legacy_v1');
  if new.source <> 'stamp_cycle' then return new; end if;

  if new.reward_pool_item_id is not null then
    select items.requires_age_check into v_age_check
    from public.reward_pool_items items where items.id = new.reward_pool_item_id;
  end if;
  v_boundary := coalesce(v_card.trading_day_starts_at, time '05:00');
  new.reward_policy_snapshot := coalesce(new.reward_policy_snapshot, '{}'::jsonb)
    || jsonb_build_object(
      'collection', case when new.reward_policy_version = 'v2' then 'next_trading_day' else 'next_uk_business_day' end,
      'expiry', case when v_card.reward_expires_after_days is null then 'never' else 'fixed_days' end,
      'expiry_days', v_card.reward_expires_after_days,
      'age_check', coalesce(v_age_check, true),
      'minimum_spend_pence', v_card.minimum_spend_pence,
      'one_transaction_per_stamp', coalesce(v_card.one_transaction_per_stamp, true),
      'trading_day_starts_at', v_boundary::text,
      'upgrade_items', '[]'::jsonb
    );

  if new.reward_policy_version = 'v2' then
    new.redeemable_from := public.venue_trading_date(new.merchant_id, new.created_at) + 1;
    new.available_from := (
      new.redeemable_from::timestamp + v_boundary
    ) at time zone 'Europe/London';
  end if;
  return new;
end;
$function$;

drop trigger if exists reward_events_snapshot_cycle_policy on public.reward_events;
create trigger reward_events_snapshot_cycle_policy
before insert on public.reward_events
for each row execute function public.snapshot_cycle_reward_policy();

revoke all on function public.snapshot_cycle_reward_policy()
  from public, anon, authenticated, service_role;

create or replace function private.complete_cycle_if_full(
  p_membership_id uuid,
  p_mint_source text,
  p_extra_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_membership record;
  v_card record;
  v_existing uuid;
  v_earned integer;
  v_active_count integer;
  v_total_weight integer;
  v_threshold integer;
  v_pool record;
  v_reward_id uuid;
begin
  select memberships.id, memberships.merchant_id, memberships.customer_id,
         memberships.active_cycle_number
  into v_membership
  from public.customer_memberships memberships
  where memberships.id = p_membership_id
  for update;
  if not found then return null; end if;

  select rewards.id into v_existing
  from public.reward_events rewards
  where rewards.membership_id = p_membership_id
    and rewards.cycle_number = v_membership.active_cycle_number
    and rewards.source = 'stamp_cycle'
  order by rewards.created_at asc limit 1;
  if v_existing is not null then
    update public.customer_memberships
    set active_cycle_number = active_cycle_number + 1, current_stamp_count = 0
    where id = p_membership_id and active_cycle_number = v_membership.active_cycle_number;
    return v_existing;
  end if;

  select cards.* into v_card
  from public.loyalty_cards cards
  where cards.merchant_id = v_membership.merchant_id and cards.is_active
  order by cards.created_at asc limit 1;
  if v_card.id is null then return null; end if;

  select count(*) into v_earned
  from public.stamp_events stamps
  where stamps.membership_id = p_membership_id and stamps.event_type = 'earned'
    and stamps.cycle_number = v_membership.active_cycle_number;
  if v_earned < v_card.stamps_required then return null; end if;

  select count(*), coalesce(sum(items.weight), 0)
  into v_active_count, v_total_weight
  from public.reward_pool_items items
  where items.merchant_id = v_membership.merchant_id
    and items.location_id = v_card.location_id
    and items.loyalty_card_id = v_card.id and items.is_active;
  if v_active_count < 3 or v_total_weight <= 0 then
    raise exception 'At least 3 active reward pool items are required before unlocking a reward'
      using errcode = 'NBS03';
  end if;

  if v_membership.active_cycle_number = 1 then
    select items.* into v_pool from public.reward_pool_items items
    where items.merchant_id = v_membership.merchant_id
      and items.location_id = v_card.location_id
      and items.loyalty_card_id = v_card.id and items.is_active
    order by items.display_order, items.created_at, items.id limit 1;
  else
    v_threshold := floor(random() * v_total_weight)::integer + 1;
    select weighted.* into v_pool from (
      select items.*, sum(items.weight) over (
        order by items.display_order, items.created_at, items.id
      ) as running_weight
      from public.reward_pool_items items
      where items.merchant_id = v_membership.merchant_id
        and items.location_id = v_card.location_id
        and items.loyalty_card_id = v_card.id and items.is_active
    ) weighted
    where weighted.running_weight >= v_threshold
    order by weighted.running_weight limit 1;
  end if;
  if v_pool.id is null then return null; end if;

  insert into public.reward_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, reward_pool_item_id,
    reward_name, reward_terms, redeemable_from, status, cycle_number, metadata
  ) values (
    v_membership.merchant_id, v_membership.customer_id, p_membership_id,
    v_card.id, v_pool.id, v_pool.reward_name, v_pool.reward_terms,
    public.next_uk_business_date(now()), 'unlocked', v_membership.active_cycle_number,
    jsonb_build_object(
      'source', p_mint_source,
      'selection_mode', case when v_membership.active_cycle_number = 1
        then 'first_cycle_default' else 'weighted_random' end
    ) || coalesce(p_extra_metadata, '{}'::jsonb)
  ) returning id into v_reward_id;

  update public.customer_memberships memberships
  set active_cycle_number = memberships.active_cycle_number + 1,
      current_stamp_count = 0
  where memberships.id = p_membership_id
    and memberships.active_cycle_number = v_membership.active_cycle_number;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  ) values (
    'reward_unlocked', v_membership.merchant_id, v_membership.customer_id,
    p_membership_id, 'system', null,
    jsonb_build_object('loyalty_card_id', v_card.id, 'reward_pool_item_id', v_pool.id)
      || coalesce(p_extra_metadata, '{}'::jsonb)
  );
  return v_reward_id;
end;
$function$;

revoke all on function private.complete_cycle_if_full(uuid, text, jsonb)
  from public, anon, authenticated, service_role;

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

  if exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = p_membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = public.venue_trading_date(membership_record.merchant_id, now())
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

  reward_unlocked := new_stamp_count >= card_record.stamps_required;

  if reward_unlocked then
    perform private.complete_cycle_if_full(
      p_membership_id,
      'self_service_qr',
      jsonb_build_object('stamp_event_id', stamp_event_id)
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

revoke all on function private.issue_visit_stamp(uuid,uuid,numeric,numeric,numeric,text,integer,text,jsonb)
  from public, anon, authenticated, service_role;

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

do $do$
begin
  if to_regprocedure('private.claim_loyalty_invite_legacy_v1(uuid,text,text,boolean,text,text)') is null then
    alter function public.claim_loyalty_invite(uuid,text,text,boolean,text,text) set schema private;
    alter function private.claim_loyalty_invite(uuid,text,text,boolean,text,text)
      rename to claim_loyalty_invite_legacy_v1;
  end if;
  if to_regprocedure('private.claim_offer_campaign_legacy_v1(uuid,text,text,boolean)') is null then
    alter function public.claim_offer_campaign(uuid,text,text,boolean) set schema private;
    alter function private.claim_offer_campaign(uuid,text,text,boolean)
      rename to claim_offer_campaign_legacy_v1;
  end if;
end
$do$;

revoke all on function private.claim_loyalty_invite_legacy_v1(uuid,text,text,boolean,text,text)
  from public, anon, authenticated, service_role;
revoke all on function private.claim_offer_campaign_legacy_v1(uuid,text,text,boolean)
  from public, anon, authenticated, service_role;

create or replace function public.settle_referral_bonus(p_referral_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_edge record;
  v_referrer record;
  v_card record;
  v_new_count integer;
  v_bonus_stamp_id uuid;
  v_last_visit_at timestamptz;
  v_today_bonus_count integer;
  v_daily_bonus_cap constant integer := 2;
  v_business_date date;
begin
  select r.* into v_edge from public.referrals r where r.id = p_referral_id for update;

  if v_edge.id is null then
    return 'not_found';
  end if;
  if v_edge.status in ('awarded', 'rejected', 'cancelled', 'expired')
     or v_edge.referrer_bonus_awarded_at is not null then
    return 'skipped_terminal';
  end if;

  -- Membership FKs are SET NULL on churn. Restore either side from the durable
  -- customer + venue identity before qualification and settlement.
  perform public.relink_referral_memberships(p_referral_id);
  select r.* into v_edge
  from public.referrals r
  where r.id = p_referral_id
  for update;

  -- An attributed edge is qualified here if the friend has genuinely visited
  -- (any-path first stamp — e.g. issued outside the self-service hook), so a bonus
  -- is never stranded merely because qualification was not recorded inline.
  if v_edge.status = 'attributed' and v_edge.referred_membership_id is not null then
    perform public.qualify_referral_on_stamp(v_edge.referred_membership_id, null);
    select r.* into v_edge
    from public.referrals r
    where r.id = p_referral_id
    for update;

    -- Qualification can synchronously trigger the concentration fraud check.
    -- Re-read and preserve every terminal decision before entering settlement.
    if v_edge.status in ('awarded', 'rejected', 'cancelled', 'expired')
       or v_edge.referrer_bonus_awarded_at is not null then
      return 'skipped_terminal';
    end if;
    if v_edge.status = 'attributed' then
      return 'not_qualified';
    end if;
  elsif v_edge.status = 'attributed' then
    return 'not_qualified';
  end if;

  if v_edge.status in ('awarded', 'rejected', 'cancelled', 'expired')
     or v_edge.referrer_bonus_awarded_at is not null then
    return 'skipped_terminal';
  end if;

  -- In-flight marker (never a committed resting state).
  update public.referrals
  set status = 'settling'
  where id = p_referral_id
    and status not in ('awarded', 'rejected', 'cancelled', 'expired')
    and referrer_bonus_awarded_at is null;

  -- Revalidate the referrer.
  if v_edge.referrer_membership_id is null then
    perform public.hold_referral_bonus(p_referral_id, 'referrer_membership_inactive');
    return 'held';
  end if;

  select m.id, m.merchant_id, m.customer_id, m.active_cycle_number,
         m.current_stamp_count, m.last_visit_at
  into v_referrer
  from public.customer_memberships m
  where m.id = v_edge.referrer_membership_id
  for update of m;

  if v_referrer.id is null then
    perform public.hold_referral_bonus(p_referral_id, 'referrer_membership_inactive');
    return 'held';
  end if;

  v_business_date := public.venue_trading_date(v_referrer.merchant_id, now());
  v_last_visit_at := v_referrer.last_visit_at;

  select cards.id as loyalty_card_id, cards.location_id, cards.stamps_required
  into v_card
  from public.loyalty_cards cards
  where cards.merchant_id = v_referrer.merchant_id and cards.is_active
  order by cards.created_at asc
  limit 1;

  if v_card.loyalty_card_id is null then
    perform public.hold_referral_bonus(p_referral_id, 'reward_unavailable');
    return 'held';
  end if;

  -- Retain the v1 due marker.
  update public.referrals
  set referrer_bonus_due_at = coalesce(referrer_bonus_due_at, now())
  where id = p_referral_id;

  -- Velocity cap (per referrer per UK business day).
  select count(*)
  into v_today_bonus_count
  from public.referrals
  where referrer_membership_id = v_edge.referrer_membership_id
    and referrer_bonus_awarded_at is not null
    and public.venue_trading_date(v_referrer.merchant_id, referrer_bonus_awarded_at) = v_business_date;

  if v_today_bonus_count >= v_daily_bonus_cap then
    if not exists (
      select 1 from public.fraud_flags
      where merchant_id = v_referrer.merchant_id
        and membership_id = v_referrer.id
        and signal = 'referral_bonus_velocity'
        and status = 'open'
        and public.venue_trading_date(v_referrer.merchant_id, created_at) = v_business_date
    ) then
      insert into public.fraud_flags (
        merchant_id, customer_id, membership_id, signal, severity, metadata
      )
      values (
        v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id,
        'referral_bonus_velocity', 'medium',
        jsonb_build_object('referral_edge_id', p_referral_id, 'cap', v_daily_bonus_cap,
          'business_date', v_business_date, 'observed_awards_today', v_today_bonus_count)
      );
    end if;
    perform public.hold_referral_bonus(p_referral_id, 'daily_bonus_limit');
    return 'held';
  end if;

  -- Award through the normal pipeline. Any unexpected error is caught and recorded
  -- as a temporary hold rather than corrupting the edge or the ledger.
  begin
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata
    )
    values (
      v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id,
      v_card.loyalty_card_id, v_card.location_id,
      'earned', 1, null, v_referrer.active_cycle_number,
      jsonb_build_object(
        'source', 'referral_bonus',
        'referred_membership_id', v_edge.referred_membership_id,
        'referral_edge_id', p_referral_id
      )
    )
    returning id into v_bonus_stamp_id;

    update public.customer_memberships
    set current_stamp_count = current_stamp_count + 1,
        total_stamps_earned = total_stamps_earned + 1,
        last_visit_at = now()
    where id = v_referrer.id
    returning current_stamp_count into v_new_count;

    perform private.complete_cycle_if_full(
      v_referrer.id,
      'referral_bonus',
      jsonb_build_object(
        'referral_id', p_referral_id,
        'stamp_event_id', v_bonus_stamp_id
      )
    );

    update public.referrals
    set status = 'awarded',
        referrer_bonus_awarded_at = now(),
        referrer_stamp_event_id = v_bonus_stamp_id,
        hold_reason = null,
        held_at = null,
        next_retry_at = null,
        last_error = null
    where id = p_referral_id;

    update public.customer_memberships memberships
    set last_visit_at = v_last_visit_at
    where memberships.id = v_referrer.id
      and memberships.last_visit_at is distinct from v_last_visit_at;

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'referral_bonus_awarded', v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id, 'system', null,
      jsonb_build_object('referral_edge_id', p_referral_id, 'referred_membership_id', v_edge.referred_membership_id,
        'bonus_stamp_event_id', v_bonus_stamp_id, 'new_stamp_count', v_new_count)
    );

    perform public.enqueue_notification_event(
      p_event_type := 'referral_bonus_stamp_issued',
      p_customer_id := v_referrer.customer_id,
      p_merchant_id := v_referrer.merchant_id,
      p_membership_id := v_referrer.id,
      p_dedupe_key := 'referral_bonus:' || p_referral_id::text,
      p_payload := jsonb_build_object(
        'title', 'You earned a bonus stamp',
        'body', 'Someone you invited to ' || coalesce((
          select nullif(trim(merchants.business_name), '')
          from public.merchants merchants
          where merchants.id = v_referrer.merchant_id
        ), 'Your venue') || ' collected their first stamp — your bonus stamp is now on your card.',
        'url', '/card/' || v_referrer.id::text
      ),
      p_metadata := jsonb_build_object('referral_edge_id', p_referral_id)
    );

    return 'awarded';
  exception
    when sqlstate 'NBS03' then
      perform public.hold_referral_bonus(p_referral_id, 'reward_unavailable');
      return 'held';
    when others then
      perform public.hold_referral_bonus(
        p_referral_id,
        'temporary_processing_error',
        left(sqlerrm, 500)
      );
      return 'error';
  end;
end;
$$;

revoke all on function public.settle_referral_bonus(uuid) from public, anon, authenticated;
grant execute on function public.settle_referral_bonus(uuid) to service_role;

create or replace function public.reconcile_loyalty_card_threshold_rewards(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_old_stamps_required integer,
  p_new_stamps_required integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_membership record;
  v_reward_id uuid;
  v_minted_count integer := 0;
begin
  if p_old_stamps_required is null
     or p_new_stamps_required is null
     or p_new_stamps_required >= p_old_stamps_required then
    return 0;
  end if;

  for v_membership in
    select memberships.id
    from public.customer_memberships memberships
    where memberships.merchant_id = p_merchant_id
      and (
        select count(*)
        from public.stamp_events stamps
        where stamps.membership_id = memberships.id
          and stamps.event_type = 'earned'
          and stamps.cycle_number = memberships.active_cycle_number
      ) >= p_new_stamps_required
      and not exists (
        select 1 from public.reward_events rewards
        where rewards.membership_id = memberships.id
          and rewards.source = 'stamp_cycle'
          and rewards.cycle_number = memberships.active_cycle_number
      )
    order by memberships.updated_at, memberships.id
    for update
  loop
    v_reward_id := private.complete_cycle_if_full(
      v_membership.id,
      'threshold_reconciliation',
      jsonb_build_object(
        'loyalty_card_id', p_loyalty_card_id,
        'previous_stamps_required', p_old_stamps_required,
        'new_stamps_required', p_new_stamps_required
      )
    );
    if v_reward_id is not null then
      v_minted_count := v_minted_count + 1;
    end if;
  end loop;
  return v_minted_count;
end;
$function$;

revoke all on function public.reconcile_loyalty_card_threshold_rewards(uuid,uuid,integer,integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_loyalty_card_threshold_rewards(uuid,uuid,integer,integer)
  to service_role;

create or replace function public.claim_loyalty_invite(
  p_customer_id uuid, p_claim_token_hash text, p_policy_version text,
  p_marketing_opt_in boolean, p_verified_email text, p_verified_email_hmac text
)
returns table (status text, membership_id uuid, stamps_awarded integer)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare v_result record;
begin
  select * into v_result from private.claim_loyalty_invite_legacy_v1(
    p_customer_id, p_claim_token_hash, p_policy_version, p_marketing_opt_in,
    p_verified_email, p_verified_email_hmac
  );
  if v_result.membership_id is not null then
    perform private.complete_cycle_if_full(v_result.membership_id, 'loyalty_invite', '{}');
  end if;
  status := v_result.status; membership_id := v_result.membership_id;
  stamps_awarded := v_result.stamps_awarded; return next;
end;
$function$;

revoke all on function public.claim_loyalty_invite(uuid,text,text,boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.claim_loyalty_invite(uuid,text,text,boolean,text,text)
  to service_role;

create or replace function public.claim_offer_campaign(
  p_customer_id uuid, p_claim_token_hash text, p_policy_version text,
  p_marketing_opt_in boolean
)
returns table (status text, membership_id uuid, stamps_awarded integer, entitlement_id uuid)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare v_result record;
begin
  select * into v_result from private.claim_offer_campaign_legacy_v1(
    p_customer_id, p_claim_token_hash, p_policy_version, p_marketing_opt_in
  );
  if v_result.membership_id is not null then
    perform private.complete_cycle_if_full(v_result.membership_id, 'offer_campaign', '{}');
  end if;
  status := v_result.status; membership_id := v_result.membership_id;
  stamps_awarded := v_result.stamps_awarded; entitlement_id := v_result.entitlement_id;
  return next;
end;
$function$;

revoke all on function public.claim_offer_campaign(uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.claim_offer_campaign(uuid,text,text,boolean)
  to service_role;

create or replace function public.mint_cycle_reward_if_missing(p_membership_id uuid)
returns uuid
language sql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select private.complete_cycle_if_full(
    p_membership_id, 'cycle_completed_without_reward', jsonb_build_object('healed', true)
  );
$function$;

revoke all on function public.mint_cycle_reward_if_missing(uuid)
  from public, anon, authenticated;
grant execute on function public.mint_cycle_reward_if_missing(uuid) to service_role;

create or replace function public.release_completed_cycles_without_reward(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_membership record;
  v_healed integer := 0;
  v_reward_id uuid;
  v_cursor uuid;
  v_last_merchant_id uuid;
begin
  select scheduler.last_merchant_id into v_cursor
  from public.reward_cycle_heal_scheduler scheduler
  where scheduler.singleton
  for update;

  for v_membership in
    with eligible as (
      select memberships.id,
             memberships.merchant_id,
             row_number() over (
               partition by memberships.merchant_id
               order by
                 (heal_failures.membership_id is not null) asc,
                 heal_failures.last_failed_at asc nulls first,
                 memberships.id
             ) as tenant_round
      from public.customer_memberships memberships
      join public.loyalty_cards cards
        on cards.merchant_id = memberships.merchant_id and cards.is_active
      join public.merchants merchants
        on merchants.id = memberships.merchant_id
      left join public.billing_customers billing
        on billing.merchant_id = memberships.merchant_id
      left join public.reward_cycle_heal_failures heal_failures
        on heal_failures.membership_id = memberships.id
      where public.loyalty_billing_entitled(merchants.requires_billing, billing.status)
        and (
          heal_failures.membership_id is null
          or heal_failures.last_failed_at <= clock_timestamp() - interval '15 minutes'
        )
        and (
          exists (
            select 1
            from public.reward_events rewards
            where rewards.membership_id = memberships.id
              and rewards.cycle_number = memberships.active_cycle_number
              and rewards.source = 'stamp_cycle'
          )
          or (
            (
              select count(*)
              from public.stamp_events stamps
              where stamps.membership_id = memberships.id
                and stamps.event_type = 'earned'
                and stamps.cycle_number = memberships.active_cycle_number
            ) >= cards.stamps_required
            and not exists (
              select 1
              from public.reward_events rewards
              where rewards.membership_id = memberships.id
                and rewards.cycle_number = memberships.active_cycle_number
                and rewards.source = 'stamp_cycle'
            )
          )
        )
    )
    select eligible.id, eligible.merchant_id
    from eligible
    order by
      eligible.tenant_round,
      case when v_cursor is null or eligible.merchant_id > v_cursor then 0 else 1 end,
      eligible.merchant_id,
      eligible.id
    limit greatest(coalesce(p_limit, 500), 1)
  loop
    v_last_merchant_id := v_membership.merchant_id;
    perform 1
    from public.customer_memberships memberships
    where memberships.id = v_membership.id
    for update skip locked;
    if not found then
      continue;
    end if;

    begin
      v_reward_id := private.complete_cycle_if_full(
        v_membership.id,
        'cycle_completed_without_reward',
        jsonb_build_object('healed', true)
      );
      if v_reward_id is null then
        insert into public.reward_cycle_heal_failures (
          membership_id, sqlstate, attempt_count, first_failed_at, last_failed_at
        ) values (
          v_membership.id, 'NBS15', 1, clock_timestamp(), clock_timestamp()
        )
        on conflict (membership_id) do update
        set sqlstate = excluded.sqlstate,
            attempt_count = reward_cycle_heal_failures.attempt_count + 1,
            last_failed_at = excluded.last_failed_at;
      else
        v_healed := v_healed + 1;
        delete from public.reward_cycle_heal_failures failures
        where failures.membership_id = v_membership.id;
      end if;
    exception
      when others then
        insert into public.reward_cycle_heal_failures (
          membership_id, sqlstate, attempt_count, first_failed_at, last_failed_at
        ) values (
          v_membership.id, sqlstate, 1, clock_timestamp(), clock_timestamp()
        )
        on conflict (membership_id) do update
        set sqlstate = excluded.sqlstate,
            attempt_count = reward_cycle_heal_failures.attempt_count + 1,
            last_failed_at = excluded.last_failed_at;
    end;
  end loop;

  if v_last_merchant_id is not null then
    update public.reward_cycle_heal_scheduler scheduler
    set last_merchant_id = v_last_merchant_id,
        updated_at = clock_timestamp()
    where scheduler.singleton;
  end if;

  return v_healed;
end;
$function$;

revoke all on function public.release_completed_cycles_without_reward(integer)
  from public, anon, authenticated;
grant execute on function public.release_completed_cycles_without_reward(integer)
  to service_role;

do $do$
declare
  v_membership record;
  v_violation record;
begin
  if exists (
    select 1
    from public.reward_events rewards
    where rewards.source = 'stamp_cycle'
    group by rewards.membership_id, rewards.cycle_number
    having count(*) > 1
  ) then
    raise exception 'Multiple stamp-cycle rewards exist for one membership cycle';
  end if;

  if exists (
    select 1 from public.reward_events
    where source = 'stamp_cycle' and cycle_number > (
      select active_cycle_number from public.customer_memberships
      where id = reward_events.membership_id
    )
  ) then
    raise exception 'Reward cycle exceeds its membership active cycle';
  end if;

  select memberships.id, memberships.active_cycle_number,
         1 + count(distinct rewards.cycle_number)::integer as expected_cycle
  into v_violation
  from public.customer_memberships memberships
  left join public.reward_events rewards
    on rewards.membership_id = memberships.id and rewards.source = 'stamp_cycle'
  group by memberships.id, memberships.active_cycle_number
  having memberships.active_cycle_number
           <> 1 + count(distinct rewards.cycle_number)::integer
     and not (
       memberships.active_cycle_number + 1
         = 1 + count(distinct rewards.cycle_number)::integer
       and exists (
         select 1
         from public.reward_events active_reward
         where active_reward.membership_id = memberships.id
           and active_reward.source = 'stamp_cycle'
           and active_reward.cycle_number = memberships.active_cycle_number
       )
     )
  limit 1;
  if v_violation.id is not null then
    raise exception 'Cycle ledger precondition failed for membership %: active %, expected %',
      v_violation.id, v_violation.active_cycle_number, v_violation.expected_cycle;
  end if;

  for v_membership in
    select memberships.id
    from public.customer_memberships memberships
    join public.loyalty_cards cards on cards.merchant_id = memberships.merchant_id and cards.is_active
    where (select count(*) from public.stamp_events stamps
           where stamps.membership_id = memberships.id and stamps.event_type = 'earned'
             and stamps.cycle_number = memberships.active_cycle_number) >= cards.stamps_required
      and not exists (
        select 1 from public.reward_events rewards
        where rewards.membership_id = memberships.id
          and rewards.cycle_number = memberships.active_cycle_number
          and rewards.source = 'stamp_cycle'
      )
  loop
    perform private.complete_cycle_if_full(v_membership.id, 'policy_cutover_heal',
      jsonb_build_object('cutover', true));
  end loop;

  for v_membership in
    select memberships.id, memberships.merchant_id, memberships.customer_id,
           memberships.active_cycle_number
    from public.customer_memberships memberships
    where exists (
      select 1 from public.reward_events rewards
      where rewards.membership_id = memberships.id
        and rewards.source = 'stamp_cycle'
        and rewards.cycle_number = memberships.active_cycle_number
    )
    for update
  loop
    update public.customer_memberships
    set active_cycle_number = active_cycle_number + 1,
        current_stamp_count = 0,
        policy_cutover_notice_at = coalesce(policy_cutover_notice_at, now())
    where id = v_membership.id;
    insert into public.audit_logs (
      actor_type, actor_id, merchant_id, customer_id,
      target_table, target_id, action, metadata
    ) values (
      'system', 'system', v_membership.merchant_id, v_membership.customer_id,
      'customer_memberships', v_membership.id, 'cycle_opened_at_policy_cutover',
      jsonb_build_object('cycle_number', v_membership.active_cycle_number)
    );
  end loop;

  update public.customer_memberships memberships
  set policy_cutover_notice_at = coalesce(memberships.policy_cutover_notice_at, now());

  select memberships.id, memberships.active_cycle_number,
         1 + count(distinct rewards.cycle_number)::integer as expected_cycle
  into v_violation
  from public.customer_memberships memberships
  left join public.reward_events rewards
    on rewards.membership_id = memberships.id and rewards.source = 'stamp_cycle'
  group by memberships.id, memberships.active_cycle_number
  having memberships.active_cycle_number <> 1 + count(distinct rewards.cycle_number)::integer
  limit 1;
  if v_violation.id is not null then
    raise exception 'Cycle ledger invariant failed for membership %: active %, expected %',
      v_violation.id, v_violation.active_cycle_number, v_violation.expected_cycle;
  end if;
end
$do$;

alter table public.loyalty_cards
  alter column reward_policy_version set default 'v2';

update public.loyalty_cards set reward_policy_version = 'v2'
where reward_policy_version <> 'v2';

create or replace function public.expire_due_reward_events(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  expired_reward record;
  v_count integer := 0;
begin
  perform public.release_completed_cycles_without_reward();
  for expired_reward in
    update public.reward_events rewards
    set status = 'expired',
        expired_at = coalesce(rewards.expired_at, p_now),
        metadata = rewards.metadata || jsonb_build_object(
          'expired_by', 'scheduled_notification_worker'
        )
    where rewards.status = 'unlocked'
      and rewards.expires_at is not null and rewards.expires_at <= p_now
    returning rewards.*
  loop
    v_count := v_count + 1;
    if expired_reward.source = 'stamp_cycle' then
      update public.customer_memberships memberships
      set total_rewards_expired = memberships.total_rewards_expired + 1
      where memberships.id = expired_reward.membership_id;
      insert into public.audit_logs (
        actor_type, actor_id, merchant_id, customer_id,
        target_table, target_id, action, metadata
      ) values (
        'system', 'system', expired_reward.merchant_id, expired_reward.customer_id,
        'reward_events', expired_reward.id, 'reward_expired',
        jsonb_build_object('membership_id', expired_reward.membership_id,
          'cycle_number', expired_reward.cycle_number,
          'expires_at', expired_reward.expires_at)
      );
    end if;
    perform public.enqueue_notification_event(
      'reward_expired', expired_reward.customer_id, expired_reward.merchant_id,
      expired_reward.membership_id, expired_reward.id, expired_reward.cycle_number,
      public.uk_business_date(expired_reward.expires_at), p_now,
      'reward_expired:' || expired_reward.id::text,
      jsonb_build_object('title', 'Reward expired', 'body', expired_reward.reward_name,
        'url', '/home/rewards', 'rewardEventId', expired_reward.id),
      jsonb_build_object('source', 'reward_expiry')
    );
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.expire_due_reward_events(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_due_reward_events(timestamptz) to service_role;

create or replace function private.redeem_self_service_reward_transition(
  p_reward_event_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_reward record;
  v_collection record;
  v_distance numeric;
  v_geo_flagged boolean := false;
  v_owner_collection boolean := false;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;
  select rewards.id, rewards.status, rewards.source, rewards.merchant_id,
         rewards.customer_id, rewards.membership_id as reward_membership_id,
         rewards.reward_name as assigned_reward_name, customers.auth_user_id,
         cards.location_id, locations.latitude, locations.longitude,
         locations.geofence_radius_meters, locations.require_geofence,
         memberships.current_stamp_count
  into v_reward
  from public.reward_events rewards
  join public.customer_memberships memberships on memberships.id = rewards.membership_id
  join public.customers customers on customers.id = rewards.customer_id
  join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
  left join public.merchant_locations locations on locations.id = cards.location_id
  where rewards.id = p_reward_event_id
  for update of rewards, memberships;

  if v_reward.id is null then raise insufficient_privilege using message = 'Reward not found'; end if;
  if v_reward.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;
  v_owner_collection := coalesce(private.has_current_owner_id_check(
    p_reward_event_id, p_customer_id, v_user_id
  ), false);
  if not public.is_service_role_request() and not v_owner_collection and (
    v_user_id is null or v_reward.auth_user_id is null or v_reward.auth_user_id <> v_user_id
  ) then raise insufficient_privilege using message = 'Reward ownership required'; end if;

  reward_event_id := v_reward.id;
  reward_name := v_reward.assigned_reward_name;
  membership_id := v_reward.reward_membership_id;
  if v_reward.status = 'redeemed' then
    new_stamp_count := v_reward.current_stamp_count;
    return next;
    return;
  end if;

  select * into v_collection
  from private.reward_collection_state(p_reward_event_id, now());
  if v_collection.state <> 'ready' then
    if v_collection.reason = 'One reward per visit day already collected' then
      raise exception '%', v_collection.reason using errcode = 'NBR01';
    end if;
    raise exception '%', coalesce(v_collection.reason, 'Reward is not redeemable');
  end if;

  if coalesce(v_reward.require_geofence, false) then
    if p_latitude is null or p_longitude is null
       or v_reward.latitude is null or v_reward.longitude is null then
      v_geo_flagged := true;
      perform public.record_self_service_geo_flag(
        v_reward.merchant_id, v_reward.customer_id, v_reward.reward_membership_id,
        v_reward.location_id, 'self_service_geofence_unknown', 'reward_redeem',
        p_latitude, p_longitude, null, v_reward.geofence_radius_meters
      );
    else
      v_distance := public.geo_distance_meters(
        p_latitude, p_longitude, v_reward.latitude, v_reward.longitude
      );
      if v_distance > v_reward.geofence_radius_meters then
        v_geo_flagged := true;
        perform public.record_self_service_geo_flag(
          v_reward.merchant_id, v_reward.customer_id, v_reward.reward_membership_id,
          v_reward.location_id, 'self_service_geofence_out_of_range', 'reward_redeem',
          p_latitude, p_longitude, v_distance, v_reward.geofence_radius_meters
        );
      end if;
    end if;
  end if;

  update public.reward_events rewards
  set status = 'redeemed', redeemed_at = now(),
      metadata = rewards.metadata || jsonb_build_object(
        'redeemed_by', case when v_owner_collection then 'merchant_scan' else 'self_service' end,
        'geo_flagged', v_geo_flagged
      )
  where rewards.id = v_reward.id and rewards.status = 'unlocked';
  if not found then raise exception 'Reward already redeemed'; end if;

  update public.customer_memberships memberships
  set total_rewards_redeemed = memberships.total_rewards_redeemed + 1
  where memberships.id = v_reward.reward_membership_id
  returning memberships.current_stamp_count into new_stamp_count;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  ) values (
    'reward_redeemed', v_reward.merchant_id, v_reward.customer_id,
    v_reward.reward_membership_id,
    case when v_owner_collection then 'merchant' else 'customer' end,
    coalesce(v_user_id::text, p_customer_id::text),
    jsonb_build_object('reward_id', v_reward.id,
      'reward_name', v_reward.assigned_reward_name, 'source', v_reward.source,
      'new_stamp_count', new_stamp_count, 'geo_flagged', v_geo_flagged)
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id,
    target_table, target_id, action, metadata
  ) values (
    case when v_owner_collection then 'merchant' else 'customer' end,
    coalesce(v_user_id::text, p_customer_id::text), v_reward.merchant_id,
    v_reward.customer_id, 'reward_events', v_reward.id, 'reward_redeemed',
    jsonb_build_object('source', v_reward.source,
      'new_stamp_count', new_stamp_count, 'geo_flagged', v_geo_flagged)
  );
  return next;
end;
$function$;

revoke all on function private.redeem_self_service_reward_transition(uuid,uuid,numeric,numeric)
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
