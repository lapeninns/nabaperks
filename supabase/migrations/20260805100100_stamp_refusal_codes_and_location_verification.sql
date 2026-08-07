-- Loyalty integrity — stable refusal codes, graduated location verification,
-- a reward-pool race guard, and a velocity signal worth reading.
--
-- Four changes that all live inside the stamping path, applied together because
-- they touch one function body and restating it four times would be worse.
--
-- 1. STABLE SQLSTATES (NBS01..NBS11)
-- Two layers classified stamp failures by matching the ENGLISH TEXT of an
-- exception: join_customer_membership_with_first_stamp (20260713100000:160-180)
-- and lib/customer/experience/block-reasons.ts. Both are brittle in the same
-- way — the literals live in a different file from the matcher, so a copy edit
-- silently reclassifies a refusal — and both were already wrong in one case:
-- 'A reward is already ready to redeem' fell into the `'%loyalty programme%'`
-- arm and was recorded as `billing_unavailable` / `venue_action`, telling the
-- venue to fix its billing when the customer simply had a reward to redeem.
--
--   NBS01  stamp already issued for this UK business day
--   NBS02  a reward is already ready to redeem
--   NBS03  reward pool unavailable (fewer than 3 active items, or none selectable)
--   NBS04  merchant not active
--   NBS05  billing not set up yet
--   NBS06  billing cancelled or suspended
--   NBS07  no active loyalty card
--   NBS08  venue QR scan proof required
--   NBS10  location supplied and outside the venue
--   NBS11  location required and unverified grace spent
--
-- Ownership and identity refusals keep insufficient_privilege (42501), which is
-- already a stable code and already classified by lib/customer/join-rpc-error.ts.
--
-- 2. GRADUATED LOCATION VERIFICATION
-- Before: `require_geofence` defaulted to false, and even when enabled it was
-- evaluated on exactly ONE stamp per cycle and NEVER blocked — out_of_range set
-- a flag and fell through to the insert. A printed QR photographed once could be
-- stamped from anywhere, for ever, and nine stamps in ten were never looked at.
--
-- After: verification is on by default and applies to every visit from the third
-- onward, but it refuses only on positive evidence of absence. See the block
-- comment on the geofence section for the three outcomes. The design constraint
-- was explicit: tighten proof of visit without losing a customer who is standing
-- in the venue with location switched off.
--
-- 3. REWARD-POOL RACE
-- The weighted select could return no row if a merchant deactivated an item
-- between the pool count and the draw, and the null then failed a NOT NULL
-- constraint on reward_events — rolling back the customer's stamp. It now
-- raises NBS03, the same answer the pool count would have given.
--
-- 4. VELOCITY SIGNAL
-- Was merchant-wide, >= 20 earned stamps in 15 minutes. A busy service reaches
-- that honestly, so the flag fired on success. Now scoped to the membership at
-- >= 3 in 15 minutes, which one card cannot reach legitimately.
--
-- Forward-only and re-runnable. No ACL is widened: every function below is
-- restated with its full revoke/grant.

-- 1. Verification thresholds, as functions so SQL and TypeScript cite one source
-- ----------------------------------------------------------------------------
-- soft_geofence_trigger_stamp_number has meant "the one stamp number that gets a
-- location probe" since 20260619120000. Its meaning changes here to "the first
-- visit number that must be verified", which is the same default (3) and the
-- same column, so no venue configuration moves.
create or replace function public.geofence_first_verified_visit(
  p_configured integer default null
)
returns integer
language sql
immutable
set search_path = public, auth, extensions
as $function$
  select greatest(coalesce(p_configured, 3), 1);
$function$;

comment on function public.geofence_first_verified_visit(integer) is
  'First lifetime visit number of a membership that must present a verified location. Visits below it are exempt so joining and the first return are never gated on a permission prompt.';

-- The lifetime allowance of unverified visits per membership, once verification
-- has started. Small enough that a farmed QR cannot ride it, large enough that a
-- customer with location switched off keeps collecting while they fix it.
create or replace function public.geofence_unverified_grace_limit()
returns integer
language sql
immutable
set search_path = public, auth, extensions
as $function$
  select 3;
$function$;

comment on function public.geofence_unverified_grace_limit() is
  'Lifetime unverified visits allowed per membership before location becomes mandatory.';

revoke all on function public.geofence_first_verified_visit(integer) from public, anon, authenticated;
revoke all on function public.geofence_unverified_grace_limit() from public, anon, authenticated;
grant execute on function public.geofence_first_verified_visit(integer) to service_role;
grant execute on function public.geofence_unverified_grace_limit() to service_role;

-- 2. Verification on by default ------------------------------------------------
-- The column stays, so a venue that genuinely cannot hold a GPS fix (a cellar
-- bar, a thick-walled coaching inn) can still be exempted deliberately. What
-- changes is the default answer: on.
alter table public.merchant_locations
  alter column require_geofence set default true;

-- 3. Mint a missing reward for a completed cycle --------------------------------
-- A cycle can reach stamps_required WITHOUT a reward_event existing. The visit
-- stamp path always mints on the completing stamp, but the promotional grants do
-- not: claim_loyalty_invite (+2) and claim_offer_campaign (+N) write stamp_events
-- and move the counter, and neither mints. A 2-stamp card met by a +2 invite
-- therefore lands on a full cycle with nothing to redeem, and every later scan
-- raises 'A reward is already ready to redeem' about a reward that does not exist.
--
-- That was already a dead end. It becomes a worse one once rewards expire
-- (20260805100200): expiry is what releases a full cycle, and a cycle with no
-- reward row has nothing to expire, so the card would never recover.
--
-- Healing it here rather than in each grant path fixes every producer at once —
-- the two grants above, admin adjustments, and anything added later — because
-- this is the single place that notices the state.
--
-- Returns the reward_events id (existing or newly minted), or null when the
-- cycle is not complete or the venue's pool cannot furnish a reward.
create or replace function public.mint_cycle_reward_if_missing(
  p_membership_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_membership record;
  v_card record;
  v_earned integer;
  v_existing uuid;
  v_total_weight integer := 0;
  v_active_reward_count integer := 0;
  v_weight_threshold integer;
  v_pool record;
  v_reward_id uuid;
begin
  select memberships.id, memberships.merchant_id, memberships.customer_id,
         memberships.active_cycle_number
  into v_membership
  from public.customer_memberships memberships
  where memberships.id = p_membership_id
  for update;

  if v_membership.id is null then
    return null;
  end if;

  -- An existing reward for this cycle is the common case and the cheap exit.
  select reward_events.id
  into v_existing
  from public.reward_events
  where reward_events.membership_id = p_membership_id
    and reward_events.cycle_number = v_membership.active_cycle_number
    and reward_events.source = 'stamp_cycle'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select loyalty_cards.id, loyalty_cards.location_id, loyalty_cards.stamps_required
  into v_card
  from public.loyalty_cards
  where loyalty_cards.merchant_id = v_membership.merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if v_card.id is null then
    return null;
  end if;

  select count(*)
  into v_earned
  from public.stamp_events
  where stamp_events.membership_id = p_membership_id
    and stamp_events.event_type = 'earned'
    and stamp_events.cycle_number = v_membership.active_cycle_number;

  -- Not complete: nothing to mint, and nothing wrong.
  if v_earned < v_card.stamps_required then
    return null;
  end if;

  select count(*), coalesce(sum(reward_pool_items.weight), 0)
  into v_active_reward_count, v_total_weight
  from public.reward_pool_items
  where reward_pool_items.merchant_id = v_membership.merchant_id
    and reward_pool_items.location_id = v_card.location_id
    and reward_pool_items.loyalty_card_id = v_card.id
    and reward_pool_items.is_active;

  if v_active_reward_count < 3 or v_total_weight <= 0 then
    return null;
  end if;

  if v_membership.active_cycle_number = 1 then
    select * into v_pool
    from public.reward_pool_items
    where reward_pool_items.merchant_id = v_membership.merchant_id
      and reward_pool_items.location_id = v_card.location_id
      and reward_pool_items.loyalty_card_id = v_card.id
      and reward_pool_items.is_active
    order by reward_pool_items.display_order asc,
      reward_pool_items.created_at asc, reward_pool_items.id asc
    limit 1;
  else
    v_weight_threshold := floor(random() * v_total_weight)::integer + 1;

    select * into v_pool
    from (
      select reward_pool_items.*,
        sum(reward_pool_items.weight) over (
          order by reward_pool_items.display_order asc,
            reward_pool_items.created_at asc, reward_pool_items.id asc
        ) as running_weight
      from public.reward_pool_items
      where reward_pool_items.merchant_id = v_membership.merchant_id
        and reward_pool_items.location_id = v_card.location_id
        and reward_pool_items.loyalty_card_id = v_card.id
        and reward_pool_items.is_active
    ) weighted_items
    where weighted_items.running_weight >= v_weight_threshold
    order by weighted_items.running_weight asc
    limit 1;
  end if;

  if v_pool.id is null then
    return null;
  end if;

  insert into public.reward_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, reward_pool_item_id,
    reward_name, reward_terms, redeemable_from, status, cycle_number, metadata
  )
  values (
    v_membership.merchant_id, v_membership.customer_id, p_membership_id,
    v_card.id, v_pool.id, v_pool.reward_name, v_pool.reward_terms,
    public.next_uk_business_date(now()), 'unlocked', v_membership.active_cycle_number,
    jsonb_build_object(
      'source', 'cycle_completed_without_reward',
      'selection_mode',
      case when v_membership.active_cycle_number = 1
        then 'first_cycle_default' else 'weighted_random' end
    )
  )
  returning id into v_reward_id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'reward_unlocked', v_membership.merchant_id, v_membership.customer_id,
    p_membership_id, 'system', null,
    jsonb_build_object(
      'loyalty_card_id', v_card.id,
      'reward_pool_item_id', v_pool.id,
      'healed', true
    )
  );

  return v_reward_id;
end;
$function$;

comment on function public.mint_cycle_reward_if_missing(uuid) is
  'Mints the reward_events row for a cycle that reached stamps_required without one (promotional grants do not mint). Idempotent: returns the existing reward when there is one.';

revoke all on function public.mint_cycle_reward_if_missing(uuid) from public, anon, authenticated;
grant execute on function public.mint_cycle_reward_if_missing(uuid) to service_role;

-- 4. The stamping primitive, restated -----------------------------------------
-- This is the 20260626090000 body with four changes and nothing else:
--   (a) every refusal now carries a stable SQLSTATE (section 1);
--   (b) graduated geofence verification replaces the single advisory probe;
--   (c) the reward-pool selection can no longer roll a customer's stamp back;
--   (d) stamp velocity is scoped to the membership rather than the whole venue.
-- Signature, return type and defaults are unchanged, so this replaces in place.
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
as $$
declare
  current_user_id uuid := (select auth.uid());
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
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.enforce_rate_limit('selfstamp:' || p_membership_id::text, 10, 900000);

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.active_cycle_number,
    customers.auth_user_id,
    merchants.status as merchant_status,
    merchants.requires_billing
  into membership_record
  from public.customer_memberships memberships
  join public.customers customers on customers.id = memberships.customer_id
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.id = p_membership_id
  for update of memberships;

  if membership_record.id is null then
    raise insufficient_privilege using message = 'Membership not found';
  end if;

  if membership_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or membership_record.auth_user_id is null
      or membership_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Membership ownership required';
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

  if coalesce(card_record.require_geofence, true)
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
      )
    )
    returning id into stamp_event_id;
  exception
    when unique_violation then
      raise exception 'Stamp already issued for this UK business day'
        using errcode = 'NBS01';
  end;

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
    coalesce(current_user_id::text, p_customer_id::text),
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
    'customer', coalesce(current_user_id::text, p_customer_id::text),
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
$$;

comment on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer) is
  'Core visit-stamp primitive. Refusals carry stable SQLSTATEs (NBS01..NBS11); location is verified from the third visit of a membership and only a positive out-of-range fix refuses.';

revoke all on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer)
  from public, anon, authenticated;
grant execute on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer)
  to service_role;

-- 5. The QR wrapper, restated --------------------------------------------------
-- Unchanged except that its two refusals now carry NBS08. The referral
-- settle-before-stamp behaviour is untouched here and is addressed separately.
create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_qr_id text,
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
as $$
declare
  v_membership record;
  v_drained integer := 0;
  v_qr_id text := trim(coalesce(p_qr_id, ''));
begin
  if v_qr_id = '' then
    raise exception 'Venue QR scan proof required' using errcode = 'NBS08';
  end if;

  select
    memberships.merchant_id,
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

  begin
    v_drained := public.drain_due_referrer_bonuses_for_membership(p_membership_id);
  exception
    when others then
      raise warning 'referral settle-before-stamp skipped for %: %', p_membership_id, sqlerrm;
  end;

  if v_drained > 0 then
    select memberships.current_stamp_count
    into new_stamp_count
    from public.customer_memberships memberships
    where memberships.id = p_membership_id;

    if new_stamp_count >= v_membership.stamps_required then
      select stamp_events.id
      into stamp_event_id
      from public.stamp_events stamp_events
      where stamp_events.membership_id = p_membership_id
        and stamp_events.event_type = 'earned'
        and stamp_events.metadata->>'source' = 'referral_bonus'
      order by stamp_events.created_at desc, stamp_events.id desc
      limit 1;

      reward_unlocked := true;
      geo_flagged := false;
      return next;
      return;
    end if;
  end if;

  select
    stamp.stamp_event_id, stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
  into
    stamp_event_id, new_stamp_count, reward_unlocked, geo_flagged
  from public.issue_self_service_stamp(
    p_membership_id, p_customer_id, p_latitude, p_longitude,
    p_accuracy_meters, p_location_status, p_capture_elapsed_ms
  ) stamp;

  begin
    perform public.award_referrer_bonus_stamp(p_membership_id, stamp_event_id);
  exception
    when others then
      raise warning 'referral bonus skipped for membership %: %', p_membership_id, sqlerrm;
  end;

  return next;
end;
$$;

revoke all on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer)
  from public, anon, authenticated;
grant execute on function public.issue_self_service_stamp(uuid, uuid, text, numeric, numeric, numeric, text, integer)
  to service_role;

notify pgrst, 'reload schema';
