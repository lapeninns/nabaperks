-- Atomic collection-window upgrades and merchant scan context.
--
-- WHAT CHANGES
--   * Scan context reads the shared collection predicate and previews an upgrade.
--   * Owner context preserves masked contact data and verified-ID workflow.
--   * Collection swaps the snapshotted item in the same guarded reward update,
--     with service notification, product event and audit metadata.
--
-- Forward-only and re-runnable.

-- 1. Scan-context return shapes -------------------------------------------------

drop function if exists public.get_owner_reward_scan_context(uuid);
drop function if exists public.get_reward_scan_context(uuid, uuid);

create function public.get_reward_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table(
  scan_status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  membership_id uuid,
  current_stamp_count integer,
  customer_email text,
  customer_phone_last4 text,
  blocked_reason text,
  in_window boolean,
  window_ends_at timestamptz,
  upgrade_reward_name text,
  upgrade_reward_terms text
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_scan record;
  v_collection record;
begin
  select
    tokens.id as token_id,
    tokens.merchant_id as token_merchant_id,
    tokens.expires_at as token_expires_at,
    tokens.consumed_at,
    tokens.superseded_at,
    rewards.id as event_id,
    rewards.reward_name as assigned_reward_name,
    rewards.reward_terms as assigned_reward_terms,
    memberships.id as card_membership_id,
    memberships.current_stamp_count as card_stamp_count,
    customers.email as safe_customer_email,
    customers.phone_last4 as safe_customer_phone_last4
  into v_scan
  from public.reward_scan_tokens tokens
  join public.reward_events rewards on rewards.id = tokens.reward_event_id
  join public.customer_memberships memberships on memberships.id = tokens.membership_id
  join public.customers customers on customers.id = tokens.customer_id
  where tokens.id = p_scan_token;

  if v_scan.token_id is null then
    scan_status := 'not_found'; return next; return;
  end if;
  if v_scan.token_merchant_id <> p_merchant_id then
    scan_status := 'unauthorized'; return next; return;
  end if;

  reward_event_id := v_scan.event_id;
  reward_name := v_scan.assigned_reward_name;
  reward_terms := v_scan.assigned_reward_terms;
  membership_id := v_scan.card_membership_id;
  current_stamp_count := v_scan.card_stamp_count;
  customer_email := v_scan.safe_customer_email;
  customer_phone_last4 := v_scan.safe_customer_phone_last4;

  if v_scan.superseded_at is not null or v_scan.token_expires_at <= now() then
    scan_status := 'expired'; return next; return;
  end if;
  if v_scan.consumed_at is not null then
    scan_status := 'redeemed'; return next; return;
  end if;

  select * into v_collection
  from private.reward_collection_state(v_scan.event_id, now());
  in_window := coalesce(v_collection.in_window, false);
  window_ends_at := v_collection.window_ends_at;
  upgrade_reward_name := v_collection.upgrade_reward_name;
  upgrade_reward_terms := v_collection.upgrade_reward_terms;

  if v_collection.state = 'ready' then
    scan_status := 'ready';
  elsif v_collection.state = 'redeemed' then
    scan_status := 'blocked';
    blocked_reason := 'Reward already collected';
  elsif v_collection.state = 'expired' then
    scan_status := 'expired';
  else
    scan_status := 'blocked';
    blocked_reason := v_collection.reason;
  end if;
  return next;
end;
$function$;

revoke all on function public.get_reward_scan_context(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_reward_scan_context(uuid, uuid)
  to service_role;

create function public.get_owner_reward_scan_context(p_scan_token uuid)
returns table (
  scan_status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  membership_id uuid,
  current_stamp_count integer,
  customer_email text,
  customer_phone_last4 text,
  blocked_reason text,
  customer_full_name text,
  customer_date_of_birth date,
  in_window boolean,
  window_ends_at timestamptz,
  upgrade_reward_name text,
  upgrade_reward_terms text
)
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_merchant_id uuid := private.reward_scan_owner_merchant(p_scan_token);
  v_context record;
  v_customer_id uuid;
  v_collection record;
begin
  select * into v_context
  from public.get_reward_scan_context(p_scan_token, v_merchant_id);
  scan_status := v_context.scan_status;
  reward_event_id := v_context.reward_event_id;
  reward_name := v_context.reward_name;
  reward_terms := v_context.reward_terms;
  membership_id := v_context.membership_id;
  current_stamp_count := v_context.current_stamp_count;
  customer_phone_last4 := v_context.customer_phone_last4;
  blocked_reason := v_context.blocked_reason;
  in_window := coalesce(v_context.in_window, false);
  window_ends_at := v_context.window_ends_at;
  upgrade_reward_name := v_context.upgrade_reward_name;
  upgrade_reward_terms := v_context.upgrade_reward_terms;

  select masked.email, rewards.customer_id
  into customer_email, v_customer_id
  from public.reward_events rewards
  join public.customers_masked masked on masked.id = rewards.customer_id
  where rewards.id = reward_event_id;

  if reward_event_id is not null
     and private.reward_effective_requires_age_check(reward_event_id, now())
     and not public.customer_has_verified_adult_date_of_birth(v_customer_id, now()) then
    select * into v_collection
    from private.reward_collection_state(reward_event_id, now());
    if scan_status = 'ready'
       or (
         scan_status = 'blocked'
         and v_collection.reason = 'Customer must have verified photo ID and be 18 or over to redeem'
       ) then
      scan_status := 'verification_required';
      blocked_reason := null;
      select customers.full_name, customers.date_of_birth
      into customer_full_name, customer_date_of_birth
      from public.customers customers where customers.id = v_customer_id;
    end if;
  end if;

  return next;
end;
$function$;

revoke all on function public.get_owner_reward_scan_context(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_owner_reward_scan_context(uuid)
  to authenticated;

create or replace function public.list_collection_window_reminders(
  p_now timestamptz default now(),
  p_horizon_hours integer default 24
)
returns table (
  reward_event_id uuid,
  customer_id uuid,
  merchant_id uuid,
  membership_id uuid,
  cycle_number integer,
  window_id uuid,
  window_starts_at timestamptz,
  window_ends_at timestamptz,
  upgrade_reward_name text,
  due_at timestamptz,
  dedupe_key text
)
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  with candidates as (
    select
      rewards.id as reward_event_id,
      rewards.customer_id,
      rewards.merchant_id,
      rewards.membership_id,
      rewards.cycle_number,
      next_window.window_id,
      next_window.window_starts_at,
      next_window.window_ends_at,
      next_window.upgrade_reward_name,
      greatest(
        next_window.window_starts_at - interval '3 hours',
        (
          (next_window.window_starts_at at time zone 'Europe/London')::date
          + time '09:00'
        ) at time zone 'Europe/London'
      ) as due_at,
      concat_ws(
        ':',
        'collection_window_opens',
        rewards.membership_id::text,
        coalesce(rewards.cycle_number::text, rewards.id::text),
        (next_window.window_starts_at at time zone 'Europe/London')::date::text
      ) as dedupe_key
    from public.reward_events rewards
    cross join lateral private.next_reward_upgrade_window(rewards.id, p_now) next_window
    where rewards.reward_policy_version = 'v2'
      and rewards.status = 'unlocked'
      and rewards.available_from <= next_window.window_ends_at
      and rewards.expires_at > next_window.window_starts_at
      and next_window.window_starts_at <= p_now
        + make_interval(hours => greatest(1, least(coalesce(p_horizon_hours, 24), 168)))
  )
  select candidates.*
  from candidates
  where not exists (
    select 1
    from public.notification_events events
    where events.dedupe_key = candidates.dedupe_key
  )
  order by candidates.due_at, candidates.reward_event_id;
$function$;

revoke all on function public.list_collection_window_reminders(timestamptz, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_collection_window_reminders(timestamptz, integer)
  to service_role;

-- 2. Atomic upgrade during collection ------------------------------------------

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
  v_now timestamptz := now();
  v_reward record;
  v_collection record;
  v_upgrade record;
  v_distance numeric;
  v_geo_flagged boolean := false;
  v_owner_collection boolean := false;
  v_upgraded boolean := false;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select rewards.id, rewards.status, rewards.source, rewards.merchant_id,
         rewards.customer_id, rewards.membership_id as reward_membership_id,
         rewards.reward_pool_item_id, rewards.reward_name as assigned_reward_name,
         rewards.reward_terms as assigned_reward_terms, customers.auth_user_id,
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

  if v_reward.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;
  if v_reward.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  v_owner_collection := coalesce(private.has_current_owner_id_check(
    p_reward_event_id, p_customer_id, v_user_id
  ), false);
  if not public.is_service_role_request() and not v_owner_collection and (
    v_user_id is null or v_reward.auth_user_id is null or v_reward.auth_user_id <> v_user_id
  ) then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  reward_event_id := v_reward.id;
  reward_name := v_reward.assigned_reward_name;
  membership_id := v_reward.reward_membership_id;
  if v_reward.status = 'redeemed' then
    new_stamp_count := v_reward.current_stamp_count;
    return next;
    return;
  end if;

  select * into v_collection
  from private.reward_collection_state(p_reward_event_id, v_now);
  if v_collection.state <> 'ready' then
    if v_collection.reason = 'One reward per visit day already collected' then
      raise exception '%', v_collection.reason using errcode = 'NBR01';
    end if;
    raise exception '%', coalesce(v_collection.reason, 'Reward is not redeemable');
  end if;

  select * into v_upgrade
  from private.reward_window_upgrade(p_reward_event_id, v_now);
  if v_upgrade.pool_item_id is not null then
    perform 1
    from public.venue_collection_windows windows
    join public.reward_pool_items items
      on items.id = v_upgrade.pool_item_id
     and items.merchant_id = windows.merchant_id
     and items.location_id = windows.location_id
     and items.is_active
    where windows.id = v_upgrade.window_id
      and windows.is_active
      and windows.location_id = v_reward.location_id
    for share of windows, items;
    if found then
      v_upgraded := true;
    end if;
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
  set status = 'redeemed',
      redeemed_at = v_now,
      reward_pool_item_id = case
        when v_upgraded then v_upgrade.pool_item_id else rewards.reward_pool_item_id end,
      reward_name = case
        when v_upgraded then v_upgrade.reward_name else rewards.reward_name end,
      reward_terms = case
        when v_upgraded then v_upgrade.reward_terms else rewards.reward_terms end,
      reward_policy_snapshot = case
        when v_upgraded then rewards.reward_policy_snapshot || jsonb_build_object(
          'age_check', v_upgrade.requires_age_check
        )
        else rewards.reward_policy_snapshot
      end,
      metadata = rewards.metadata || jsonb_strip_nulls(jsonb_build_object(
        'redeemed_by', case when v_owner_collection then 'merchant_scan' else 'self_service' end,
        'geo_flagged', v_geo_flagged,
        'upgraded_from', case when v_upgraded then v_reward.reward_pool_item_id end,
        'upgraded_in_window_id', case when v_upgraded then v_upgrade.window_id end,
        'upgraded_at', case when v_upgraded then v_now end
      ))
  where rewards.id = v_reward.id and rewards.status = 'unlocked'
  returning rewards.reward_name into reward_name;
  if not found then raise exception 'Reward already redeemed'; end if;

  update public.customer_memberships memberships
  set total_rewards_redeemed = memberships.total_rewards_redeemed + 1
  where memberships.id = v_reward.reward_membership_id
  returning memberships.current_stamp_count into new_stamp_count;

  if v_upgraded then
    perform public.enqueue_notification_event(
      'reward_upgraded',
      v_reward.customer_id,
      v_reward.merchant_id,
      v_reward.reward_membership_id,
      v_reward.id,
      null,
      public.venue_trading_date(v_reward.merchant_id, v_now),
      v_now,
      'reward_upgraded:' || v_reward.id::text,
      jsonb_build_object(
        'title', 'Reward upgraded',
        'body', reward_name,
        'url', '/home/rewards',
        'rewardEventId', v_reward.id,
        'rewardName', reward_name
      ),
      jsonb_build_object(
        'source', 'collection_window',
        'window_id', v_upgrade.window_id,
        'upgraded_from', v_reward.reward_pool_item_id,
        'upgraded_to', v_upgrade.pool_item_id
      )
    );
  end if;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  ) values (
    'reward_redeemed', v_reward.merchant_id, v_reward.customer_id,
    v_reward.reward_membership_id,
    case when v_owner_collection then 'merchant' else 'customer' end,
    coalesce(v_user_id::text, p_customer_id::text),
    jsonb_strip_nulls(jsonb_build_object(
      'reward_id', v_reward.id,
      'reward_name', reward_name,
      'source', v_reward.source,
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged,
      'upgraded', v_upgraded,
      'upgraded_from', case when v_upgraded then v_reward.reward_pool_item_id end,
      'upgraded_to', case when v_upgraded then v_upgrade.pool_item_id end,
      'window_id', case when v_upgraded then v_upgrade.window_id end
    ))
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id,
    target_table, target_id, action, metadata
  ) values (
    case when v_owner_collection then 'merchant' else 'customer' end,
    coalesce(v_user_id::text, p_customer_id::text), v_reward.merchant_id,
    v_reward.customer_id, 'reward_events', v_reward.id, 'reward_redeemed',
    jsonb_strip_nulls(jsonb_build_object(
      'source', v_reward.source,
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged,
      'upgraded', v_upgraded,
      'upgraded_from', case when v_upgraded then v_reward.reward_pool_item_id end,
      'upgraded_to', case when v_upgraded then v_upgrade.pool_item_id end,
      'window_id', case when v_upgraded then v_upgrade.window_id end
    ))
  );

  return next;
end;
$function$;

revoke all on function private.redeem_self_service_reward_transition(uuid, uuid, numeric, numeric)
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
