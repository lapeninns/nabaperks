-- Venue trading days align earning, rotating codes and standard reward collection.
--
-- WHAT CHANGES
--   * Every primary venue location has an owner-configurable London day boundary.
--   * The canonical venue_trading_date function drives stored stamp dates.
--   * Venue codes derive from the same merchant boundary.
--   * A member may collect one stamp-cycle reward per venue trading day.
--
-- Forward-only and re-runnable.

alter table public.merchant_locations
  add column if not exists trading_day_starts_at time not null default '05:00';

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'merchant_locations_trading_day_starts_at_check'
      and conrelid = 'public.merchant_locations'::regclass
  ) then
    alter table public.merchant_locations
      add constraint merchant_locations_trading_day_starts_at_check
      check (trading_day_starts_at >= time '00:00' and trading_day_starts_at <= time '12:00')
      not valid;
  end if;
end
$do$;

alter table public.merchant_locations
  validate constraint merchant_locations_trading_day_starts_at_check;

create or replace function private.venue_trading_date(
  p_location_id uuid,
  p_at timestamptz default now()
)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select (
    (p_at at time zone 'Europe/London')
    - coalesce((
        select locations.trading_day_starts_at
        from public.merchant_locations locations
        where locations.id = p_location_id
      ), time '05:00')
  )::date;
$function$;

revoke all on function private.venue_trading_date(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.venue_trading_date(
  p_merchant_id uuid,
  p_at timestamptz default now()
)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select private.venue_trading_date((
    select locations.id
    from public.merchant_locations locations
    where locations.merchant_id = p_merchant_id
    order by locations.is_primary desc, locations.created_at asc, locations.id asc
    limit 1
  ), p_at);
$function$;

revoke all on function public.venue_trading_date(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.venue_trading_date(uuid, timestamptz) to service_role;

create or replace function private.venue_code_day(
  p_merchant_id uuid,
  p_at timestamptz default now()
)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.venue_trading_date(p_merchant_id, p_at);
$function$;

revoke all on function private.venue_code_day(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function private.venue_code_rotates_at(
  p_merchant_id uuid,
  p_at timestamptz default now()
)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select (
    (public.venue_trading_date(p_merchant_id, p_at) + 1)::timestamp
    + coalesce((
        select locations.trading_day_starts_at
        from public.merchant_locations locations
        where locations.merchant_id = p_merchant_id
        order by locations.is_primary desc, locations.created_at asc, locations.id asc
        limit 1
      ), time '05:00')
  ) at time zone 'Europe/London';
$function$;

revoke all on function private.venue_code_rotates_at(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function private.venue_code_for(
  p_merchant_id uuid,
  p_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_seed bytea;
  v_day date := private.venue_code_day(p_merchant_id, p_at);
  v_digest text;
begin
  if p_merchant_id is null
    or not exists (select 1 from public.merchants where id = p_merchant_id) then
    return null;
  end if;
  select seed into v_seed from private.venue_code_seeds where merchant_id = p_merchant_id;
  if v_seed is null then
    insert into private.venue_code_seeds (merchant_id, seed)
    values (p_merchant_id, extensions.gen_random_bytes(32))
    on conflict (merchant_id) do nothing;
    select seed into v_seed from private.venue_code_seeds where merchant_id = p_merchant_id;
  end if;
  v_digest := encode(extensions.hmac(
    convert_to(p_merchant_id::text || ':' || v_day::text, 'UTF8'), v_seed, 'sha256'
  ), 'hex');
  return lpad((((('x' || left(v_digest, 12))::bit(48))::bigint % 1000000)::text), 6, '0');
end;
$function$;

revoke all on function private.venue_code_for(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.get_venue_code_today(p_merchant_id uuid)
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
  rotates_at := private.venue_code_rotates_at(p_merchant_id, now());
  return next;
end;
$function$;

revoke all on function public.get_venue_code_today(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_venue_code_today(uuid) to authenticated;

create or replace function public.rotate_venue_code(p_merchant_id uuid)
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
  set seed = excluded.seed, rotated_at = excluded.rotated_at,
      rotated_by_user_id = excluded.rotated_by_user_id;
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', v_owner_id::text, p_merchant_id, 'merchants', p_merchant_id,
    'venue_code_reset', jsonb_build_object(
      'venue_code_day', private.venue_code_day(p_merchant_id, now())
    )
  );
  code := private.venue_code_for(p_merchant_id, now());
  rotates_at := private.venue_code_rotates_at(p_merchant_id, now());
  return next;
end;
$function$;

revoke all on function public.rotate_venue_code(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.rotate_venue_code(uuid) to authenticated;

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
  v_business_date date;
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

  v_business_date := public.venue_trading_date(membership_record.merchant_id, now());

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



create or replace function nabaperks_internal.settle_referral_bonus_with_visit(p_referral_id uuid)
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
  v_total_weight integer := 0;
  v_active_reward_count integer := 0;
  v_weight_threshold integer;
  v_reward record;
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

  select m.id, m.merchant_id, m.customer_id, m.active_cycle_number, m.current_stamp_count
  into v_referrer
  from public.customer_memberships m
  where m.id = v_edge.referrer_membership_id
  for update of m;

  if v_referrer.id is null then
    perform public.hold_referral_bonus(p_referral_id, 'referrer_membership_inactive');
    return 'held';
  end if;

  v_business_date := public.venue_trading_date(v_referrer.merchant_id, now());

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

  -- Full card.
  if v_referrer.current_stamp_count >= v_card.stamps_required then
    perform public.hold_referral_bonus(p_referral_id, 'card_full');
    return 'held';
  end if;

  -- A completing bonus must be able to select a fulfilable reward.
  if v_referrer.current_stamp_count + 1 >= v_card.stamps_required then
    select count(*), coalesce(sum(reward_pool_items.weight), 0)
    into v_active_reward_count, v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = v_referrer.merchant_id
      and reward_pool_items.location_id = v_card.location_id
      and reward_pool_items.loyalty_card_id = v_card.loyalty_card_id
      and reward_pool_items.is_active;

    if v_active_reward_count < 3 or v_total_weight <= 0 then
      perform public.hold_referral_bonus(p_referral_id, 'reward_unavailable');
      return 'held';
    end if;
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

    if v_new_count >= v_card.stamps_required then
      if v_referrer.active_cycle_number = 1 then
        select *
        into v_reward
        from public.reward_pool_items
        where reward_pool_items.merchant_id = v_referrer.merchant_id
          and reward_pool_items.location_id = v_card.location_id
          and reward_pool_items.loyalty_card_id = v_card.loyalty_card_id
          and reward_pool_items.is_active
        order by reward_pool_items.display_order asc,
          reward_pool_items.created_at asc,
          reward_pool_items.id asc
        limit 1;
      else
        v_weight_threshold := floor(random() * v_total_weight)::integer + 1;
        select *
        into v_reward
        from (
          select
            reward_pool_items.*,
            sum(reward_pool_items.weight) over (
              order by reward_pool_items.display_order asc,
                reward_pool_items.created_at asc,
                reward_pool_items.id asc
            ) as running_weight
          from public.reward_pool_items
          where reward_pool_items.merchant_id = v_referrer.merchant_id
            and reward_pool_items.location_id = v_card.location_id
            and reward_pool_items.loyalty_card_id = v_card.loyalty_card_id
            and reward_pool_items.is_active
        ) weighted_items
        where weighted_items.running_weight >= v_weight_threshold
        order by weighted_items.running_weight asc
        limit 1;
      end if;

      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id, reward_pool_item_id,
        reward_name, reward_terms, redeemable_from, status, cycle_number, metadata
      )
      values (
        v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id, v_card.loyalty_card_id,
        v_reward.id, v_reward.reward_name, v_reward.reward_terms,
        public.next_uk_business_date(now()), 'unlocked', v_referrer.active_cycle_number,
        jsonb_build_object('source', 'referral_bonus',
          'selection_mode',
          case when v_referrer.active_cycle_number = 1 then 'first_cycle_default' else 'weighted_random' end)
      );

      insert into public.product_events (
        event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
      )
      values (
        'reward_unlocked', v_referrer.merchant_id, v_referrer.customer_id, v_referrer.id, 'system', null,
        jsonb_build_object('loyalty_card_id', v_card.loyalty_card_id, 'source', 'referral_bonus')
      );
    end if;

    update public.referrals
    set status = 'awarded',
        referrer_bonus_awarded_at = now(),
        referrer_stamp_event_id = v_bonus_stamp_id,
        hold_reason = null,
        held_at = null,
        next_retry_at = null,
        last_error = null
    where id = p_referral_id;

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
          'body', 'Someone you invited to ' || coalesce((select nullif(trim(business_name), '') from public.merchants where id = v_referrer.merchant_id), 'Your venue') || ' collected their first stamp — your bonus stamp is now on your card.',
          'url', '/card/' || v_referrer.id::text),
      p_metadata := jsonb_build_object('referral_edge_id', p_referral_id)
    );

    return 'awarded';
  exception
    when others then
      perform public.hold_referral_bonus(p_referral_id, 'temporary_processing_error', left(sqlerrm, 500));
      return 'error';
  end;
end;
$$;

revoke all on function nabaperks_internal.settle_referral_bonus_with_visit(uuid)
  from public, anon, authenticated, service_role;


create or replace function public.issue_merchant_direct_reward(
  p_merchant_id uuid,
  p_membership_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_expires_in_days integer default 30,
  p_reason text default null
)
returns table (
  reward_event_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_merchant record;
  v_membership record;
  v_card_id uuid;
  v_billing_status text;
  v_name text := btrim(coalesce(p_reward_name, ''));
  v_terms text := btrim(coalesce(p_reward_terms, ''));
  v_expires_in integer := coalesce(p_expires_in_days, 30);
  v_business_date date := public.venue_trading_date(p_merchant_id, now());
  v_membership_today integer;
  v_merchant_today integer;
  v_reward_id uuid;
begin
  select merchants.id, merchants.status, merchants.owner_user_id, merchants.requires_billing, merchants.business_name
  into v_merchant from public.merchants where merchants.id = p_merchant_id for update;
  if v_merchant.id is null then raise insufficient_privilege using message = 'Merchant not found'; end if;
  if not public.is_service_role_request() then
    if current_user_id is null or v_merchant.owner_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Merchant owner access required';
    end if;
  end if;

  select customer_memberships.id, customer_memberships.customer_id into v_membership
  from public.customer_memberships
  where customer_memberships.id = p_membership_id and customer_memberships.merchant_id = p_merchant_id
  for update;
  if v_membership.id is null then raise exception 'Membership not found for merchant'; end if;

  if v_name = '' or char_length(v_name) > 100 then raise exception 'Reward name must be 1 to 100 characters'; end if;
  if char_length(v_terms) not between 12 and 500 then raise exception 'Reward terms must be between 12 and 500 characters'; end if;
  if v_expires_in not between 1 and 365 then raise exception 'Reward expiry must be between 1 and 365 days'; end if;

  if v_merchant.status not in ('trial', 'active') then raise exception 'This merchant loyalty programme is not active'; end if;
  select billing_customers.status into v_billing_status from public.billing_customers where billing_customers.merchant_id = p_merchant_id;
  if coalesce(v_merchant.requires_billing, true) and v_billing_status is null then raise exception 'This merchant loyalty programme is not active yet'; end if;
  if v_billing_status in ('cancelled', 'suspended') then raise exception 'This merchant loyalty programme is unavailable'; end if;

  select loyalty_cards.id into v_card_id from public.loyalty_cards
  where loyalty_cards.merchant_id = p_merchant_id and loyalty_cards.is_active
  order by loyalty_cards.created_at asc limit 1;
  if v_card_id is null then raise exception 'This loyalty card is not active'; end if;

  select count(*) into v_membership_today from public.reward_events
  where reward_events.membership_id = p_membership_id and reward_events.source = 'merchant_direct'
    and public.venue_trading_date(p_merchant_id, reward_events.created_at) = v_business_date;
  if v_membership_today >= 1 then raise exception 'A reward has already been sent to this member today'; end if;

  select count(*) into v_merchant_today from public.reward_events
  where reward_events.merchant_id = p_merchant_id and reward_events.source = 'merchant_direct'
    and public.venue_trading_date(p_merchant_id, reward_events.created_at) = v_business_date;
  if v_merchant_today >= 100 then raise exception 'Daily sent-reward limit reached for this merchant'; end if;

  v_reward_id := public.internal_issue_merchant_direct_reward(
    p_merchant_id, p_membership_id, v_membership.customer_id, v_card_id,
    v_name, v_terms, v_expires_in, p_reason,
    coalesce(current_user_id::text, p_merchant_id::text), v_merchant.business_name
  );

  reward_event_id := v_reward_id;
  expires_at := now() + make_interval(days => v_expires_in);
  return next;
end;
$$;

revoke all on function public.issue_merchant_direct_reward(uuid, uuid, text, text, integer, text) from public;
grant execute on function public.issue_merchant_direct_reward(uuid, uuid, text, text, integer, text) to authenticated, service_role;


create or replace function private.standard_reward_daily_cap_reached(
  p_reward_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce((
    select rewards.source = 'stamp_cycle' and exists (
      select 1
      from public.reward_events redeemed
      where redeemed.membership_id = rewards.membership_id
        and redeemed.id <> rewards.id
        and redeemed.source = 'stamp_cycle'
        and redeemed.status = 'redeemed'
        and public.venue_trading_date(redeemed.merchant_id, redeemed.redeemed_at)
          = public.venue_trading_date(rewards.merchant_id, p_at)
    )
    from public.reward_events rewards
    where rewards.id = p_reward_id
  ), false);
$function$;

revoke all on function private.standard_reward_daily_cap_reached(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.list_pending_next_stamp_available(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (
  membership_id uuid,
  customer_id uuid,
  merchant_id uuid,
  loyalty_card_id uuid,
  location_id uuid,
  cycle_number integer,
  business_date date,
  last_earned_business_date date,
  dedupe_key text,
  business_name text
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
begin
  if p_now is null then
    raise exception 'Notification candidate time is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Notification candidate limit must be between 1 and 500';
  end if;

  return query
  with eligible as (
    select
      memberships.id as membership_id,
      memberships.customer_id,
      memberships.merchant_id,
      selected_card.id as loyalty_card_id,
      selected_card.location_id,
      memberships.active_cycle_number as cycle_number,
      current_day.business_date,
      latest_earned.earned_business_date as last_earned_business_date,
      concat_ws(
        ':',
        'next_stamp_available',
        memberships.id::text,
        memberships.active_cycle_number::text,
        current_day.business_date::text
      ) as dedupe_key,
      merchants.business_name
    from public.customer_memberships memberships
    join public.merchants merchants on merchants.id = memberships.merchant_id
    join lateral (
      select cards.id, cards.location_id, cards.is_active
      from public.loyalty_cards cards
      where cards.merchant_id = memberships.merchant_id
      order by cards.is_active desc, cards.created_at asc, cards.id asc
      limit 1
    ) selected_card on selected_card.is_active
    cross join lateral (
      select private.venue_trading_date(
        selected_card.location_id,
        p_now
      ) as business_date
    ) current_day
    join lateral (
      select stamps.earned_business_date
      from public.stamp_events stamps
      where stamps.membership_id = memberships.id
        and stamps.event_type = 'earned'
        and stamps.stamps_delta > 0
        and stamps.earned_business_date is not null
      order by stamps.earned_business_date desc, stamps.created_at desc, stamps.id desc
      limit 1
    ) latest_earned
      on latest_earned.earned_business_date < current_day.business_date
  )
  select
    eligible.membership_id,
    eligible.customer_id,
    eligible.merchant_id,
    eligible.loyalty_card_id,
    eligible.location_id,
    eligible.cycle_number,
    eligible.business_date,
    eligible.last_earned_business_date,
    eligible.dedupe_key,
    eligible.business_name
  from eligible
  where not exists (
    select 1
    from public.notification_events notifications
    where notifications.event_type = 'next_stamp_available'
      and notifications.membership_id = eligible.membership_id
      and notifications.cycle_number is not distinct from eligible.cycle_number
      and notifications.business_date = eligible.business_date
  )
  order by eligible.last_earned_business_date, eligible.membership_id
  limit p_limit;
end;
$function$;

revoke all on function public.list_pending_next_stamp_available(timestamptz, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_pending_next_stamp_available(timestamptz, integer)
  to service_role;

notify pgrst, 'reload schema';
