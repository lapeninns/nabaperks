-- V2 collection timing, window previews and closure-aware expiry.
--
-- WHAT CHANGES
--   * V2 rewards become available at the next venue trading-day boundary.
--   * Issue-time expiry is stored against an immutable 56-day default horizon.
--   * Windowed rewards snap to a configured window end; venues without windows
--     snap to the trading-day boundary after the horizon.
--   * Closure overlap extends open V2 rewards through a bounded fixpoint and
--     can never shorten an already-issued reward.
--
-- Forward-only and re-runnable.

-- 1. V2 horizon default ---------------------------------------------------------

alter table public.loyalty_cards
  alter column reward_expires_after_days set default 56;

update public.loyalty_cards
set reward_expires_after_days = 56,
    updated_at = now()
where reward_expires_after_days = 30;

-- 2. Trading-day and recurring-window helpers ----------------------------------

create or replace function private.v2_available_from(
  p_location_id uuid,
  p_issued_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_merchant_id uuid;
  v_starts_at time;
  v_trading_date date;
begin
  select locations.merchant_id, locations.trading_day_starts_at
  into v_merchant_id, v_starts_at
  from public.merchant_locations locations
  where locations.id = p_location_id;

  if v_merchant_id is null then
    return null;
  end if;

  v_trading_date := public.venue_trading_date(v_merchant_id, p_issued_at);
  return ((v_trading_date + 1) + v_starts_at) at time zone 'Europe/London';
end;
$function$;

create or replace function private.venue_trading_boundary_after(
  p_location_id uuid,
  p_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_merchant_id uuid;
  v_starts_at time;
  v_trading_date date;
  v_current_boundary timestamptz;
begin
  select locations.merchant_id, locations.trading_day_starts_at
  into v_merchant_id, v_starts_at
  from public.merchant_locations locations
  where locations.id = p_location_id;

  if v_merchant_id is null then
    return null;
  end if;

  v_trading_date := public.venue_trading_date(v_merchant_id, p_at);
  v_current_boundary := (v_trading_date + v_starts_at) at time zone 'Europe/London';
  if v_current_boundary >= p_at then
    return v_current_boundary;
  end if;
  return ((v_trading_date + 1) + v_starts_at) at time zone 'Europe/London';
end;
$function$;

create or replace function private.venue_trading_boundary_at_or_before(
  p_location_id uuid,
  p_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_merchant_id uuid;
  v_starts_at time;
  v_trading_date date;
begin
  select locations.merchant_id, locations.trading_day_starts_at
  into v_merchant_id, v_starts_at
  from public.merchant_locations locations
  where locations.id = p_location_id;

  if v_merchant_id is null then
    return null;
  end if;

  v_trading_date := public.venue_trading_date(v_merchant_id, p_at);
  return (v_trading_date + v_starts_at) at time zone 'Europe/London';
end;
$function$;

create or replace function private.current_collection_window(
  p_location_id uuid,
  p_at timestamptz
)
returns table (
  window_id uuid,
  window_starts_at timestamptz,
  window_ends_at timestamptz,
  upgrade_pool_item_id uuid,
  upgrade_reward_name text,
  upgrade_reward_terms text,
  upgrade_requires_age_check boolean
)
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  with local_clock as (
    select
      (p_at at time zone 'Europe/London')::date as local_date,
      (p_at at time zone 'Europe/London')::time as local_time
  )
  select
    windows.id,
    (clock.local_date + windows.starts_at) at time zone 'Europe/London',
    (clock.local_date + windows.ends_at) at time zone 'Europe/London',
    windows.upgrade_pool_item_id,
    items.reward_name,
    items.reward_terms,
    items.requires_age_check
  from public.venue_collection_windows windows
  cross join local_clock clock
  left join public.reward_pool_items items
    on items.id = windows.upgrade_pool_item_id
   and items.merchant_id = windows.merchant_id
   and items.location_id = windows.location_id
   and items.is_active
  where windows.location_id = p_location_id
    and windows.is_active
    and windows.isodow = extract(isodow from clock.local_date)::smallint
    and windows.starts_at <= clock.local_time
    and clock.local_time < windows.ends_at
  order by windows.starts_at, windows.id
  limit 1;
$function$;

create or replace function private.next_collection_window(
  p_location_id uuid,
  p_after timestamptz
)
returns table (
  window_id uuid,
  window_starts_at timestamptz,
  window_ends_at timestamptz,
  upgrade_pool_item_id uuid,
  upgrade_reward_name text,
  upgrade_reward_terms text,
  upgrade_requires_age_check boolean
)
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  with candidate_days as (
    select generated.day::date as local_date
    from generate_series(
      (p_after at time zone 'Europe/London')::date::timestamp,
      ((p_after at time zone 'Europe/London')::date + 7)::timestamp,
      interval '1 day'
    ) generated(day)
  ), instances as (
    select
      windows.id,
      (days.local_date + windows.starts_at) at time zone 'Europe/London' as starts_at,
      (days.local_date + windows.ends_at) at time zone 'Europe/London' as ends_at,
      windows.upgrade_pool_item_id,
      items.reward_name,
      items.reward_terms,
      items.requires_age_check
    from candidate_days days
    join public.venue_collection_windows windows
      on windows.location_id = p_location_id
     and windows.is_active
     and windows.isodow = extract(isodow from days.local_date)::smallint
    left join public.reward_pool_items items
      on items.id = windows.upgrade_pool_item_id
     and items.merchant_id = windows.merchant_id
     and items.location_id = windows.location_id
     and items.is_active
  )
  select
    instances.id,
    instances.starts_at,
    instances.ends_at,
    instances.upgrade_pool_item_id,
    instances.reward_name,
    instances.reward_terms,
    instances.requires_age_check
  from instances
  where instances.starts_at > p_after
  order by instances.starts_at, instances.id
  limit 1;
$function$;

create or replace function private.next_reward_upgrade_window(
  p_reward_id uuid,
  p_after timestamptz
)
returns table (
  window_id uuid,
  window_starts_at timestamptz,
  window_ends_at timestamptz,
  upgrade_pool_item_id uuid,
  upgrade_reward_name text,
  upgrade_reward_terms text,
  upgrade_requires_age_check boolean
)
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  with reward as (
    select rewards.reward_pool_item_id, rewards.reward_policy_snapshot,
           rewards.merchant_id, cards.location_id
    from public.reward_events rewards
    join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
    where rewards.id = p_reward_id
  ), candidate_days as (
    select generated.day::date as local_date
    from generate_series(
      (p_after at time zone 'Europe/London')::date::timestamp,
      ((p_after at time zone 'Europe/London')::date + 7)::timestamp,
      interval '1 day'
    ) generated(day)
  ), candidates as (
    select
      windows.id,
      (days.local_date + windows.starts_at) at time zone 'Europe/London' as starts_at,
      (days.local_date + windows.ends_at) at time zone 'Europe/London' as ends_at,
      coalesce(nullif(snapshot.value->>'pool_item_id', '')::uuid,
               windows.upgrade_pool_item_id) as pool_item_id,
      snapshot.value as snapshot,
      reward.reward_pool_item_id as issued_pool_item_id,
      reward.merchant_id,
      reward.location_id
    from reward
    join public.venue_collection_windows windows
      on windows.location_id = reward.location_id and windows.is_active
    join candidate_days days
      on windows.isodow = extract(isodow from days.local_date)::smallint
    left join lateral (
      select entry.value
      from jsonb_array_elements(
        coalesce(reward.reward_policy_snapshot->'upgrade_items', '[]'::jsonb)
      ) entry(value)
      where entry.value->>'window_id' = windows.id::text
      limit 1
    ) snapshot on true
  )
  select
    candidates.id,
    candidates.starts_at,
    candidates.ends_at,
    items.id,
    coalesce(candidates.snapshot->>'reward_name', items.reward_name),
    coalesce(candidates.snapshot->>'reward_terms', items.reward_terms),
    coalesce((candidates.snapshot->>'requires_age_check')::boolean,
             items.requires_age_check, true)
  from candidates
  join public.reward_pool_items items
    on items.id = candidates.pool_item_id
   and items.merchant_id = candidates.merchant_id
   and items.location_id = candidates.location_id
   and items.is_active
  where candidates.starts_at > p_after
    and items.id is distinct from candidates.issued_pool_item_id
  order by candidates.starts_at, candidates.id
  limit 1;
$function$;

create or replace function private.latest_collection_window_end(
  p_location_id uuid,
  p_not_before timestamptz,
  p_not_after timestamptz
)
returns timestamptz
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  with candidate_days as (
    select generated.day::date as local_date
    from generate_series(
      (p_not_before at time zone 'Europe/London')::date::timestamp,
      (p_not_after at time zone 'Europe/London')::date::timestamp,
      interval '1 day'
    ) generated(day)
  )
  select max((days.local_date + windows.ends_at) at time zone 'Europe/London')
  from candidate_days days
  join public.venue_collection_windows windows
    on windows.location_id = p_location_id
   and windows.is_active
   and windows.isodow = extract(isodow from days.local_date)::smallint
  where (days.local_date + windows.ends_at) at time zone 'Europe/London' >= p_not_before
    and (days.local_date + windows.ends_at) at time zone 'Europe/London' <= p_not_after;
$function$;

create or replace function private.compute_v2_reward_base_expires_at(
  p_location_id uuid,
  p_issued_at timestamptz,
  p_available_from timestamptz,
  p_horizon_days integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_raw_horizon timestamptz;
  v_window_end timestamptz;
begin
  if p_location_id is null
     or p_issued_at is null
     or p_available_from is null
     or p_horizon_days is null
     or p_horizon_days < 1 then
    return null;
  end if;

  v_raw_horizon := p_issued_at + make_interval(days => p_horizon_days);

  if exists (
    select 1
    from public.venue_collection_windows windows
    where windows.location_id = p_location_id and windows.is_active
  ) then
    v_window_end := private.latest_collection_window_end(
      p_location_id, p_available_from, v_raw_horizon
    );
    return coalesce(v_window_end, p_available_from);
  end if;

  return private.venue_trading_boundary_after(p_location_id, v_raw_horizon);
end;
$function$;

-- 3. Closure-extension fixpoint -------------------------------------------------

create or replace function private.compute_v2_reward_expires_at(
  p_location_id uuid,
  p_issued_at timestamptz,
  p_available_from timestamptz,
  p_horizon_days integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_base_expires_at timestamptz;
  v_expires_at timestamptz;
  v_candidate timestamptz;
  v_snapped timestamptz;
  v_extension interval;
  v_has_windows boolean;
  v_iteration integer := 0;
begin
  v_base_expires_at := private.compute_v2_reward_base_expires_at(
    p_location_id, p_issued_at, p_available_from, p_horizon_days
  );
  if v_base_expires_at is null then return null; end if;

  v_expires_at := v_base_expires_at;
  select exists (
    select 1 from public.venue_collection_windows windows
    where windows.location_id = p_location_id and windows.is_active
  ) into v_has_windows;

  loop
    v_iteration := v_iteration + 1;
    select coalesce(
      sum(
        least(closures.ends_at, coalesce(closures.ended_early_at, closures.ends_at), v_expires_at)
        - greatest(closures.starts_at, p_available_from)
      ) filter (
        where closures.starts_at < v_expires_at
          and greatest(closures.starts_at, p_available_from)
              < least(closures.ends_at, coalesce(closures.ended_early_at, closures.ends_at), v_expires_at)
      ),
      interval '0 seconds'
    )
    into v_extension
    from public.venue_closures closures
    where closures.location_id = p_location_id;

    v_candidate := least(v_base_expires_at + v_extension, v_base_expires_at + interval '90 days');
    if v_has_windows then
      v_snapped := coalesce(
        private.latest_collection_window_end(
          p_location_id, v_base_expires_at, v_candidate
        ),
        v_base_expires_at
      );
    else
      v_snapped := private.venue_trading_boundary_after(p_location_id, v_candidate);
      if v_snapped > v_base_expires_at + interval '90 days' then
        v_snapped := private.venue_trading_boundary_at_or_before(
          p_location_id,
          v_base_expires_at + interval '90 days'
        );
      end if;
    end if;

    v_snapped := greatest(v_base_expires_at, v_snapped);
    exit when v_snapped = v_expires_at or v_iteration >= 100;
    v_expires_at := v_snapped;
  end loop;

  return v_expires_at;
end;
$function$;

create or replace function private.snap_v2_reward_expiry_extension(
  p_reward_id uuid,
  p_proposed_expires_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_reward record;
  v_snapped timestamptz;
begin
  select rewards.expires_at, cards.location_id
  into v_reward
  from public.reward_events rewards
  join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
  where rewards.id = p_reward_id
    and rewards.reward_policy_version = 'v2';

  if v_reward.location_id is null or p_proposed_expires_at is null then
    return v_reward.expires_at;
  end if;

  if exists (
    select 1 from public.venue_collection_windows windows
    where windows.location_id = v_reward.location_id and windows.is_active
  ) then
    v_snapped := private.latest_collection_window_end(
      v_reward.location_id, v_reward.expires_at, p_proposed_expires_at
    );
  else
    v_snapped := private.venue_trading_boundary_after(
      v_reward.location_id, p_proposed_expires_at
    );
  end if;

  return greatest(v_reward.expires_at, coalesce(v_snapped, v_reward.expires_at));
end;
$function$;

create or replace function private.v2_expiry_extensions_snapshot(
  p_location_id uuid,
  p_available_from timestamptz,
  p_expires_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'closure_id', closures.id,
        'starts_at', closures.starts_at,
        'ends_at', least(closures.ends_at, coalesce(closures.ended_early_at, closures.ends_at)),
        'overlap_seconds', extract(epoch from (
          least(closures.ends_at, coalesce(closures.ended_early_at, closures.ends_at), p_expires_at)
          - greatest(closures.starts_at, p_available_from)
        ))::bigint
      ) order by closures.starts_at, closures.id
    ) filter (
      where closures.starts_at < p_expires_at
        and greatest(closures.starts_at, p_available_from)
            < least(closures.ends_at, coalesce(closures.ended_early_at, closures.ends_at), p_expires_at)
    ),
    '[]'::jsonb
  )
  from public.venue_closures closures
  where closures.location_id = p_location_id;
$function$;

-- 4. Immutable issue-time timing and upgrade snapshots --------------------------

create or replace function public.set_reward_event_expiry_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_location_id uuid;
  v_horizon_days integer;
  v_base_expires_at timestamptz;
  v_upgrade_items jsonb;
begin
  if new.reward_policy_version <> 'v2' then
    if new.expires_at is null then
      new.expires_at := public.resolve_reward_event_expires_at(
        new.loyalty_card_id,
        new.reward_pool_item_id,
        coalesce(new.created_at, now())
      );
    end if;
    return new;
  end if;

  select
    cards.location_id,
    coalesce(items.reward_expires_after_days, cards.reward_expires_after_days, 56)
  into v_location_id, v_horizon_days
  from public.loyalty_cards cards
  left join public.reward_pool_items items on items.id = new.reward_pool_item_id
  where cards.id = new.loyalty_card_id
    and cards.merchant_id = new.merchant_id;

  if v_location_id is null then
    raise exception 'V2 reward location is unavailable';
  end if;

  new.available_from := coalesce(
    new.available_from,
    private.v2_available_from(v_location_id, coalesce(new.created_at, now()))
  );
  new.redeemable_from := (new.available_from at time zone 'Europe/London')::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'window_id', windows.id,
        'pool_item_id', items.id,
        'reward_name', items.reward_name,
        'reward_terms', items.reward_terms,
        'requires_age_check', items.requires_age_check
      ) order by windows.isodow, windows.starts_at, windows.id
    ) filter (
      where items.id is not null and items.id is distinct from new.reward_pool_item_id
    ),
    '[]'::jsonb
  )
  into v_upgrade_items
  from public.venue_collection_windows windows
  join public.reward_pool_items items
    on items.id = windows.upgrade_pool_item_id
   and items.merchant_id = windows.merchant_id
   and items.location_id = windows.location_id
   and items.is_active
  where windows.location_id = v_location_id
    and windows.merchant_id = new.merchant_id
    and windows.is_active;

  v_base_expires_at := private.compute_v2_reward_base_expires_at(
    v_location_id,
    coalesce(new.created_at, now()),
    new.available_from,
    v_horizon_days
  );
  new.expires_at := private.compute_v2_reward_expires_at(
    v_location_id,
    coalesce(new.created_at, now()),
    new.available_from,
    v_horizon_days
  );
  new.reward_policy_snapshot := coalesce(new.reward_policy_snapshot, '{}'::jsonb)
    || jsonb_build_object(
      'collection', 'next_trading_day',
      'expiry', 'window_horizon',
      'expiry_rule', 'window_horizon',
      'expiry_days', v_horizon_days,
      'base_expires_at', v_base_expires_at,
      'expiry_extensions', private.v2_expiry_extensions_snapshot(
        v_location_id, new.available_from, new.expires_at
      ),
      'upgrade_items', v_upgrade_items
    );

  return new;
end;
$function$;

drop trigger if exists reward_events_set_expiry_snapshot on public.reward_events;
drop trigger if exists z_reward_events_set_expiry_snapshot on public.reward_events;
create trigger z_reward_events_set_expiry_snapshot
  before insert on public.reward_events
  for each row execute function public.set_reward_event_expiry_snapshot();

-- 5. Current-upgrade and effective-age resolution ------------------------------

create or replace function private.reward_window_upgrade(
  p_reward_id uuid,
  p_at timestamptz
)
returns table (
  window_id uuid,
  window_ends_at timestamptz,
  pool_item_id uuid,
  reward_name text,
  reward_terms text,
  requires_age_check boolean
)
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_reward record;
  v_window record;
  v_snapshot jsonb;
begin
  select
    rewards.reward_pool_item_id,
    rewards.reward_policy_snapshot,
    cards.location_id,
    rewards.merchant_id
  into v_reward
  from public.reward_events rewards
  join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
  where rewards.id = p_reward_id;

  if v_reward.location_id is null then return; end if;

  select * into v_window
  from private.current_collection_window(v_reward.location_id, p_at);
  if v_window.window_id is null then return; end if;

  select entry.value
  into v_snapshot
  from jsonb_array_elements(
    coalesce(v_reward.reward_policy_snapshot->'upgrade_items', '[]'::jsonb)
  ) entry(value)
  where entry.value->>'window_id' = v_window.window_id::text
  limit 1;

  if v_snapshot is not null then
    pool_item_id := nullif(v_snapshot->>'pool_item_id', '')::uuid;
    reward_name := v_snapshot->>'reward_name';
    reward_terms := v_snapshot->>'reward_terms';
    requires_age_check := coalesce((v_snapshot->>'requires_age_check')::boolean, true);
  else
    pool_item_id := v_window.upgrade_pool_item_id;
    reward_name := v_window.upgrade_reward_name;
    reward_terms := v_window.upgrade_reward_terms;
    requires_age_check := coalesce(v_window.upgrade_requires_age_check, true);
  end if;

  if pool_item_id is null
     or pool_item_id = v_reward.reward_pool_item_id
     or not exists (
       select 1
       from public.reward_pool_items items
       where items.id = pool_item_id
         and items.merchant_id = v_reward.merchant_id
         and items.location_id = v_reward.location_id
         and items.is_active
     ) then
    return;
  end if;

  window_id := v_window.window_id;
  window_ends_at := v_window.window_ends_at;
  return next;
end;
$function$;

create or replace function private.reward_effective_requires_age_check(
  p_reward_id uuid,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_upgrade record;
begin
  select * into v_upgrade
  from private.reward_window_upgrade(p_reward_id, p_at);
  if v_upgrade.pool_item_id is not null then
    return coalesce(v_upgrade.requires_age_check, true);
  end if;
  return private.reward_requires_age_check(p_reward_id);
end;
$function$;

create or replace function private.reward_collection_state(
  p_reward_id uuid,
  p_at timestamptz default now()
)
returns table (
  state text,
  reason text,
  available_from timestamptz,
  expires_at timestamptz,
  in_window boolean,
  window_id uuid,
  window_ends_at timestamptz,
  upgrade_pool_item_id uuid,
  upgrade_reward_name text,
  upgrade_reward_terms text,
  next_window_starts_at timestamptz,
  next_window_ends_at timestamptz,
  next_window_upgrade_name text
)
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_reward record;
  v_current_window record;
  v_upgrade record;
  v_next_window record;
  v_requires_age_check boolean;
begin
  select
    rewards.status,
    rewards.source,
    rewards.reward_policy_version,
    rewards.reward_policy_snapshot,
    rewards.redeemable_from,
    rewards.available_from as stored_available_from,
    rewards.expires_at as stored_expires_at,
    cards.location_id,
    customers.id as customer_id,
    customers.full_name,
    customers.date_of_birth,
    customers.email,
    customers.email_verified_at,
    memberships.current_stamp_count,
    cards.stamps_required,
    cards.reward_policy_version as card_policy_version,
    public.loyalty_availability_reason(
      merchants.status, cards.is_active, billing.status, merchants.requires_billing
    ) as unavailable_reason
  into v_reward
  from public.reward_events rewards
  join public.customer_memberships memberships on memberships.id = rewards.membership_id
  join public.customers customers on customers.id = rewards.customer_id
  join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
  join public.merchants merchants on merchants.id = rewards.merchant_id
  left join public.billing_customers billing on billing.merchant_id = rewards.merchant_id
  where rewards.id = p_reward_id;

  in_window := false;
  expires_at := v_reward.stored_expires_at;
  available_from := case
    when v_reward.reward_policy_version = 'legacy_v1'
      then v_reward.redeemable_from::timestamp at time zone 'Europe/London'
    else v_reward.stored_available_from
  end;

  if not found then state := 'blocked'; reason := 'Reward not found'; return next; return; end if;

  if v_reward.reward_policy_version = 'v2' then
    select * into v_current_window
    from private.current_collection_window(v_reward.location_id, p_at);
    if v_current_window.window_id is not null then
      in_window := true;
      window_id := v_current_window.window_id;
      window_ends_at := v_current_window.window_ends_at;
    end if;

    select * into v_upgrade
    from private.reward_window_upgrade(p_reward_id, p_at);
    if v_upgrade.pool_item_id is not null then
      upgrade_pool_item_id := v_upgrade.pool_item_id;
      upgrade_reward_name := v_upgrade.reward_name;
      upgrade_reward_terms := v_upgrade.reward_terms;
    end if;

    select * into v_next_window
    from private.next_reward_upgrade_window(p_reward_id, p_at);
    next_window_starts_at := v_next_window.window_starts_at;
    next_window_ends_at := v_next_window.window_ends_at;
    next_window_upgrade_name := v_next_window.upgrade_reward_name;
  end if;

  if v_reward.status = 'redeemed' then state := 'redeemed'; reason := 'Reward already redeemed'; return next; return; end if;
  if v_reward.status = 'cancelled' then state := 'cancelled'; reason := 'Reward is not ready to collect'; return next; return; end if;
  if v_reward.status = 'expired' or (expires_at is not null and expires_at <= p_at) then
    state := 'expired'; reason := 'Reward expired'; return next; return;
  end if;
  if v_reward.status <> 'unlocked' then
    state := 'blocked'; reason := 'Reward is not ready to collect'; return next; return;
  end if;
  if v_reward.reward_policy_version = 'legacy_v1'
     and v_reward.redeemable_from > public.uk_business_date(p_at) then
    state := 'waiting'; reason := 'Reward is not redeemable until the next UK business day'; return next; return;
  elsif v_reward.reward_policy_version <> 'legacy_v1'
     and available_from is not null and p_at < available_from then
    state := 'waiting'; reason := 'Reward is not ready to collect yet'; return next; return;
  end if;
  if v_reward.unavailable_reason is not null then
    state := 'blocked'; reason := 'This loyalty programme is unavailable right now'; return next; return;
  end if;
  if v_reward.source = 'stamp_cycle'
     and v_reward.card_policy_version <> 'v2'
     and v_reward.current_stamp_count < v_reward.stamps_required then
    state := 'blocked'; reason := 'Reward is not ready to redeem'; return next; return;
  end if;
  if private.standard_reward_daily_cap_reached(p_reward_id, p_at) then
    state := 'blocked'; reason := 'One reward per visit day already collected'; return next; return;
  end if;
  if nullif(btrim(v_reward.email), '') is not null and v_reward.email_verified_at is null then
    state := 'blocked'; reason := 'Verified email required for reward collection'; return next; return;
  end if;
  if nullif(btrim(v_reward.full_name), '') is null
     or v_reward.date_of_birth is null
     or v_reward.date_of_birth < date '1900-01-01' then
    state := 'blocked'; reason := 'Complete your profile before redeeming'; return next; return;
  end if;

  v_requires_age_check := private.reward_effective_requires_age_check(p_reward_id, p_at);
  if v_requires_age_check
     and not public.customer_has_verified_adult_date_of_birth(v_reward.customer_id, p_at) then
    state := 'blocked'; reason := 'Customer must have verified photo ID and be 18 or over to redeem'; return next; return;
  end if;

  state := 'ready';
  reason := null;
  return next;
end;
$function$;

create or replace function public.get_customer_card_state(
  p_membership_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_membership record;
  v_card jsonb;
  v_rewards jsonb;
  v_billing_status text;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  if p_membership_id is null then return jsonb_build_object('status', 'not_found'); end if;

  select m.id, m.merchant_id, m.customer_id, m.current_stamp_count,
         m.total_rewards_redeemed, m.active_cycle_number, m.referral_code,
         m.referral_code_active, mer.business_name, mer.business_slug,
         mer.status as merchant_status, mer.requires_billing,
         mer.pub_google_review, mer.locals
  into v_membership
  from public.customer_memberships m
  join public.merchants mer on mer.id = m.merchant_id
  where m.id = p_membership_id;

  if v_membership.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if p_customer_id is null or v_membership.customer_id <> p_customer_id then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select jsonb_build_object(
    'card_name', cards.card_name, 'stamps_required', cards.stamps_required,
    'reward_name', cards.reward_name, 'reward_terms', cards.reward_terms,
    'is_active', cards.is_active,
    'minimum_spend_pence', cards.minimum_spend_pence,
    'one_transaction_per_stamp', cards.one_transaction_per_stamp
  ) into v_card
  from public.loyalty_cards cards
  where cards.merchant_id = v_membership.merchant_id
  order by cards.is_active desc, cards.created_at asc limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', rewards.id, 'status', rewards.status,
      'reward_name', rewards.reward_name, 'reward_terms', rewards.reward_terms,
      'redeemable_from', rewards.redeemable_from, 'expires_at', collection.expires_at,
      'source', rewards.source, 'created_at', rewards.created_at,
      'reward_policy_snapshot', rewards.reward_policy_snapshot,
      'collection_state', collection.state, 'collection_reason', collection.reason,
      'available_from', collection.available_from, 'in_window', collection.in_window,
      'window_id', collection.window_id, 'window_ends_at', collection.window_ends_at,
      'upgrade_pool_item_id', collection.upgrade_pool_item_id,
      'upgrade_reward_name', collection.upgrade_reward_name,
      'upgrade_reward_terms', collection.upgrade_reward_terms,
      'requires_age_check', private.reward_effective_requires_age_check(rewards.id, now()),
      'next_window_starts_at', collection.next_window_starts_at,
      'next_window_ends_at', collection.next_window_ends_at,
      'next_window_upgrade_name', collection.next_window_upgrade_name
    ) order by rewards.created_at desc
  ), '[]'::jsonb)
  into v_rewards
  from public.reward_events rewards
  cross join lateral private.reward_collection_state(rewards.id, now()) collection
  where rewards.membership_id = v_membership.id and rewards.status = 'unlocked';

  select billing.status into v_billing_status
  from public.billing_customers billing where billing.merchant_id = v_membership.merchant_id;

  return jsonb_build_object(
    'status', 'ready',
    'membership', jsonb_build_object(
      'id', v_membership.id, 'merchant_id', v_membership.merchant_id,
      'customer_id', v_membership.customer_id,
      'current_stamp_count', v_membership.current_stamp_count,
      'total_rewards_redeemed', v_membership.total_rewards_redeemed,
      'active_cycle_number', v_membership.active_cycle_number,
      'policy_cutover_notice_at', (
        select memberships.policy_cutover_notice_at
        from public.customer_memberships memberships
        where memberships.id = v_membership.id
      ),
      'referral_code', v_membership.referral_code,
      'referral_code_active', v_membership.referral_code_active
    ),
    'merchant', jsonb_build_object(
      'business_name', v_membership.business_name, 'business_slug', v_membership.business_slug,
      'status', v_membership.merchant_status, 'requires_billing', v_membership.requires_billing,
      'pub_google_review', v_membership.pub_google_review, 'locals', v_membership.locals
    ),
    'loyalty_card', v_card, 'unlocked_rewards', v_rewards,
    'billing_status', v_billing_status
  );
end;
$function$;

-- 6. Closure-driven, never-shortening recomputation -----------------------------

create or replace function private.extend_open_v2_rewards_for_closure(
  p_closure_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_closure record;
  v_reward record;
  v_new_expires_at timestamptz;
  v_extended integer := 0;
begin
  select closures.*
  into v_closure
  from public.venue_closures closures
  where closures.id = p_closure_id;
  if v_closure.id is null then return 0; end if;

  for v_reward in
    select
      rewards.id,
      rewards.merchant_id,
      rewards.customer_id,
      rewards.created_at,
      rewards.available_from,
      rewards.expires_at,
      rewards.reward_policy_snapshot,
      coalesce((rewards.reward_policy_snapshot->>'expiry_days')::integer, 56) as horizon_days
    from public.reward_events rewards
    join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
    where cards.location_id = v_closure.location_id
      and rewards.merchant_id = v_closure.merchant_id
      and rewards.reward_policy_version = 'v2'
      and rewards.status = 'unlocked'
      and rewards.available_from is not null
      and rewards.expires_at is not null
    order by rewards.id
    for update of rewards
  loop
    v_new_expires_at := private.compute_v2_reward_expires_at(
      v_closure.location_id,
      v_reward.created_at,
      v_reward.available_from,
      v_reward.horizon_days
    );

    if v_new_expires_at > v_reward.expires_at then
      update public.reward_events
      set expires_at = v_new_expires_at,
          reward_policy_snapshot = v_reward.reward_policy_snapshot
            || jsonb_build_object(
              'expiry_extensions', private.v2_expiry_extensions_snapshot(
                v_closure.location_id, v_reward.available_from, v_new_expires_at
              )
            )
      where id = v_reward.id;

      insert into public.audit_logs (
        actor_type, actor_id, merchant_id, customer_id,
        target_table, target_id, action, metadata
      ) values (
        'system', 'venue_closure_expiry', v_reward.merchant_id, v_reward.customer_id,
        'reward_events', v_reward.id, 'reward_expiry_extended_by_closure',
        jsonb_build_object(
          'closure_id', p_closure_id,
          'previous_expires_at', v_reward.expires_at,
          'expires_at', v_new_expires_at
        )
      );
      v_extended := v_extended + 1;
    end if;
  end loop;

  return v_extended;
end;
$function$;

create or replace function private.venue_closures_extend_open_rewards()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
begin
  perform private.extend_open_v2_rewards_for_closure(new.id);
  return new;
end;
$function$;

drop trigger if exists venue_closures_extend_open_rewards on public.venue_closures;
create trigger venue_closures_extend_open_rewards
  after insert or update of starts_at, ends_at, ended_early_at
  on public.venue_closures
  for each row execute function private.venue_closures_extend_open_rewards();

-- 7. Function containment -------------------------------------------------------

revoke all on function private.v2_available_from(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.venue_trading_boundary_after(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.venue_trading_boundary_at_or_before(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.current_collection_window(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.next_collection_window(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.next_reward_upgrade_window(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.latest_collection_window_end(uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.compute_v2_reward_base_expires_at(uuid, timestamptz, timestamptz, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.compute_v2_reward_expires_at(uuid, timestamptz, timestamptz, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.snap_v2_reward_expiry_extension(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.v2_expiry_extensions_snapshot(uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.reward_window_upgrade(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.reward_effective_requires_age_check(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.extend_open_v2_rewards_for_closure(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.venue_closures_extend_open_rewards()
  from public, anon, authenticated, service_role;
revoke all on function public.set_reward_event_expiry_snapshot()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
