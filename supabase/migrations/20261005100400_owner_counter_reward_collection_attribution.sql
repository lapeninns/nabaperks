-- Merchant-counter collections are attributed to the signed-in owner.
--
-- Before this migration the plain "Collect" path called
-- collect_current_reward_scan_token through the service role. The redemption
-- transition only recognised an owner through a same-transaction ID-check
-- receipt, so every plain counter collection was written to audit_logs and
-- product_events as customer self-service (actor_type 'customer',
-- redeemed_by 'self_service'). Only reward_scan_tokens.consumed_by_merchant_id
-- kept the venue.
--
-- collect_owner_reward_scan_token derives the merchant from auth.uid() (the
-- same authority model as verify_and_collect_reward_scan_token) and writes a
-- private receipt bound to pg_current_xact_id(). The transition treats that
-- receipt, like the ID-check receipt, as proof of an owner collection inside
-- this exact operation. Clients cannot write either receipt table.
--
-- Compatibility: collect_current_reward_scan_token stays granted to
-- service_role so the deployed app keeps working until the owner-derived
-- caller is live. Revoke it in a later release.

-- 1. Same-transaction counter-collection receipt -----------------------------
create table private.merchant_counter_collection_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  reward_event_id uuid not null unique references public.reward_events(id) on delete cascade,
  scan_token_id uuid not null references public.reward_scan_tokens(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  owner_user_id uuid not null,
  collected_at timestamptz not null default clock_timestamp(),
  transaction_id xid8 not null default pg_current_xact_id()
);
create index merchant_counter_collection_receipts_merchant_idx
  on private.merchant_counter_collection_receipts(merchant_id);
create index merchant_counter_collection_receipts_customer_idx
  on private.merchant_counter_collection_receipts(customer_id);
create index merchant_counter_collection_receipts_token_idx
  on private.merchant_counter_collection_receipts(scan_token_id);
alter table private.merchant_counter_collection_receipts enable row level security;
alter table private.merchant_counter_collection_receipts force row level security;
revoke all on table private.merchant_counter_collection_receipts
  from public, anon, authenticated, service_role;

-- The receipt is not a reusable capability: it only counts inside the
-- transaction that wrote it, for the owner who is signed in now.
create or replace function private.has_current_owner_counter_collection(
  p_reward_id uuid, p_customer_id uuid, p_owner_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
  select auth.role() = 'authenticated' and exists (
    select 1 from private.merchant_counter_collection_receipts receipts
    join public.merchants merchants on merchants.id = receipts.merchant_id
    where receipts.reward_event_id = p_reward_id
      and receipts.customer_id = p_customer_id
      and receipts.owner_user_id = p_owner_user_id
      and merchants.owner_user_id = p_owner_user_id
      and receipts.transaction_id = pg_current_xact_id()
  );
$function$;
revoke all on function private.has_current_owner_counter_collection(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- 2. Owner-derived plain collection -----------------------------------------
create or replace function public.collect_owner_reward_scan_token(p_scan_token uuid)
returns table (
  reward_event_id uuid, reward_name text, membership_id uuid, new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  -- No caller-supplied merchant ID: authority comes from the signed-in owner.
  v_merchant_id uuid := private.reward_scan_owner_merchant(p_scan_token);
  v_owner_id uuid := auth.uid();
  v_token public.reward_scan_tokens%rowtype;
begin
  select * into v_token from public.reward_scan_tokens where id = p_scan_token;
  if v_token.id is null then raise exception 'Reward scan token not found'; end if;
  if v_token.merchant_id is distinct from v_merchant_id then
    raise insufficient_privilege using message = 'Reward not available to this merchant';
  end if;
  -- Same lock order as minting, ID verification and the collector:
  -- billing state -> customer -> reward -> token.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || v_token.merchant_id::text, 0)
  );
  perform 1 from public.customers where id = v_token.customer_id for update;
  perform 1 from public.reward_events where id = v_token.reward_event_id for update;
  select * into v_token from public.reward_scan_tokens where id = p_scan_token for update;
  if not found then raise exception 'Reward scan token not found'; end if;
  if v_token.merchant_id is distinct from v_merchant_id then
    raise insufficient_privilege using message = 'Reward not available to this merchant';
  end if;
  if v_token.superseded_at is not null then raise exception 'Reward scan token superseded'; end if;
  if v_token.expires_at <= now() then raise exception 'Reward scan token expired'; end if;
  if v_token.consumed_at is not null then raise exception 'Reward already collected'; end if;
  -- Recheck ownership after waiting for locks, before any durable change.
  perform private.reward_scan_owner_merchant(p_scan_token);

  insert into private.merchant_counter_collection_receipts (
    reward_event_id, scan_token_id, customer_id, merchant_id, owner_user_id
  ) values (
    v_token.reward_event_id, v_token.id, v_token.customer_id, v_merchant_id, v_owner_id
  );

  -- Any failure below rolls back the receipt with the collection.
  return query select * from public.collect_current_reward_scan_token(p_scan_token, v_merchant_id);
end;
$function$;
revoke all on function public.collect_owner_reward_scan_token(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.collect_owner_reward_scan_token(uuid)
  to authenticated;

-- 3. The transition recognises either owner receipt -------------------------
-- Redefined from 20261005100000_merchant_suspension_grace.sql. Only the owner
-- detection and the audit collection_method changed.
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
  v_merchant_id uuid;
  v_collection record;
  v_upgrade record;
  v_distance numeric;
  v_geo_flagged boolean := false;
  v_owner_collection boolean := false;
  v_owner_id_check boolean := false;
  v_owner_counter boolean := false;
  v_upgraded boolean := false;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select rewards.merchant_id
  into v_merchant_id
  from public.reward_events rewards
  where rewards.id = p_reward_event_id;
  if v_merchant_id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || v_merchant_id::text, 0)
  );

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

  v_owner_id_check := coalesce(private.has_current_owner_id_check(
    p_reward_event_id, p_customer_id, v_user_id
  ), false);
  v_owner_counter := not v_owner_id_check and coalesce(
    private.has_current_owner_counter_collection(
      p_reward_event_id, p_customer_id, v_user_id
    ), false);
  v_owner_collection := v_owner_id_check or v_owner_counter;
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
      'collection_method', case
        when v_owner_id_check then 'owner_id_check'
        when v_owner_counter then 'owner_counter'
      end,
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
