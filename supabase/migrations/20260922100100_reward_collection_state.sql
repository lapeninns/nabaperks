-- One database-owned collection decision for every reward surface.
--
-- WHAT CHANGES
--   * A private predicate returns lifecycle, timing and future window fields.
--   * The public service-role wrapper exposes the same row without duplicating rules.
--   * Scan eligibility, merchant context and the customer card read use the predicate.
--
-- Forward-only and re-runnable.

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
begin
  select
    rewards.status,
    rewards.source,
    rewards.reward_policy_version,
    rewards.reward_policy_snapshot,
    rewards.redeemable_from,
    rewards.available_from as stored_available_from,
    rewards.expires_at as stored_expires_at,
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
  if v_reward.status = 'redeemed' then state := 'redeemed'; reason := 'Reward already redeemed'; return next; return; end if;
  if v_reward.status = 'cancelled' then state := 'cancelled'; reason := 'Reward is not ready to collect'; return next; return; end if;
  if v_reward.status = 'expired' or (expires_at is not null and expires_at <= p_at) then
    state := 'expired'; reason := 'Reward expired'; return next; return;
  end if;
  if v_reward.status <> 'unlocked' then
    state := 'blocked'; reason := 'Reward is not ready to collect'; return next; return;
  end if;

  -- Programme availability is decided before timing: a paused or unbillable
  -- venue must not advertise a later collection time it cannot honour.
  if v_reward.unavailable_reason is not null then
    state := 'blocked'; reason := 'This loyalty programme is unavailable right now'; return next; return;
  end if;
  if v_reward.reward_policy_version = 'legacy_v1'
     and v_reward.redeemable_from > public.uk_business_date(p_at) then
    state := 'waiting'; reason := 'Reward is not redeemable until the next UK business day'; return next; return;
  elsif v_reward.reward_policy_version <> 'legacy_v1'
     and available_from is not null and p_at < available_from then
    state := 'waiting'; reason := 'Reward is not ready to collect yet'; return next; return;
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
  if coalesce((v_reward.reward_policy_snapshot ->> 'age_check')::boolean, true)
     and v_reward.date_of_birth > (public.uk_business_date(p_at) - interval '18 years')::date then
    state := 'blocked'; reason := 'Customer must be 18 or over to redeem'; return next; return;
  end if;

  state := 'ready';
  reason := null;
  return next;
end;
$function$;

revoke all on function private.reward_collection_state(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.get_reward_collection_state(p_reward_id uuid)
returns table (
  state text, reason text, available_from timestamptz, expires_at timestamptz,
  in_window boolean, window_id uuid, window_ends_at timestamptz,
  upgrade_pool_item_id uuid, upgrade_reward_name text, upgrade_reward_terms text,
  next_window_starts_at timestamptz, next_window_ends_at timestamptz,
  next_window_upgrade_name text
)
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select * from private.reward_collection_state(p_reward_id, now());
$function$;

revoke all on function public.get_reward_collection_state(uuid)
  from public, anon, authenticated;
grant execute on function public.get_reward_collection_state(uuid) to service_role;

create or replace function public.get_reward_collection_states(p_reward_ids uuid[])
returns table (
  reward_id uuid,
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
  next_window_upgrade_name text,
  requires_age_check boolean
)
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select
    requested.reward_id,
    collection.state,
    collection.reason,
    collection.available_from,
    collection.expires_at,
    collection.in_window,
    collection.window_id,
    collection.window_ends_at,
    collection.upgrade_pool_item_id,
    collection.upgrade_reward_name,
    collection.upgrade_reward_terms,
    collection.next_window_starts_at,
    collection.next_window_ends_at,
    collection.next_window_upgrade_name,
    coalesce(
      (
        select (upgrade_item.value ->> 'requires_age_check')::boolean
        from public.reward_events rewards
        cross join lateral jsonb_array_elements(
          coalesce(rewards.reward_policy_snapshot -> 'upgrade_items', '[]'::jsonb)
        ) upgrade_item(value)
        where rewards.id = requested.reward_id
          and collection.upgrade_pool_item_id is not null
          and upgrade_item.value ->> 'pool_item_id'
            = collection.upgrade_pool_item_id::text
        limit 1
      ),
      (
        select coalesce(
          (rewards.reward_policy_snapshot ->> 'age_check')::boolean,
          true
        )
        from public.reward_events rewards
        where rewards.id = requested.reward_id
      ),
      true
    ) as requires_age_check
  from (
    select distinct reward_ids.reward_id
    from unnest(coalesce(p_reward_ids, '{}'::uuid[])) reward_ids(reward_id)
  ) requested
  cross join lateral private.reward_collection_state(
    requested.reward_id,
    now()
  ) collection;
$function$;

revoke all on function public.get_reward_collection_states(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_reward_collection_states(uuid[]) to service_role;

create or replace function public.list_pending_reward_notification_candidates(
  p_event_type text,
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (
  reward_event_id uuid,
  customer_id uuid,
  merchant_id uuid,
  membership_id uuid,
  cycle_number integer,
  reward_name text,
  expires_at timestamptz,
  created_at timestamptz,
  business_name text
)
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
begin
  if p_event_type is null
     or p_event_type not in ('reward_ready', 'reward_expiring_soon') then
    raise exception 'Unsupported reward notification event type';
  end if;
  if p_now is null then
    raise exception 'Notification candidate time is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Notification candidate limit must be between 1 and 500';
  end if;

  return query
  select
    rewards.id,
    rewards.customer_id,
    rewards.merchant_id,
    rewards.membership_id,
    rewards.cycle_number,
    rewards.reward_name,
    collection.expires_at,
    rewards.created_at,
    merchants.business_name
  from public.reward_events rewards
  join public.merchants merchants on merchants.id = rewards.merchant_id
  cross join lateral private.reward_collection_state(rewards.id, p_now) collection
  where rewards.status = 'unlocked'
    and not exists (
      select 1
      from public.notification_events notifications
      where notifications.reward_event_id = rewards.id
        and notifications.event_type = p_event_type
    )
    and (
      (
        p_event_type = 'reward_ready'
        and rewards.source = 'stamp_cycle'
        and collection.state = 'ready'
      )
      or
      (
        p_event_type = 'reward_expiring_soon'
        and collection.expires_at > p_now
        and collection.expires_at <= p_now + interval '72 hours'
        and collection.state in ('waiting', 'ready')
      )
    )
  order by
    case when p_event_type = 'reward_expiring_soon'
      then collection.expires_at
    end,
    case when p_event_type = 'reward_ready'
      then rewards.created_at
    end,
    rewards.id
  limit p_limit;
end;
$function$;

revoke all on function public.list_pending_reward_notification_candidates(
  text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.list_pending_reward_notification_candidates(
  text, timestamptz, integer
) to service_role;

create or replace function private.reward_scan_eligibility_reason(p_reward_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select case when collection.state = 'ready' then null else collection.reason end
  from private.reward_collection_state(p_reward_id, now()) collection;
$function$;

revoke all on function private.reward_scan_eligibility_reason(uuid)
  from public, anon, authenticated, service_role;

do $do$
begin
  if to_regprocedure('private.redeem_self_service_reward_transition_legacy_v1(uuid,uuid,numeric,numeric)') is null then
    alter function private.redeem_self_service_reward_transition(uuid,uuid,numeric,numeric)
      rename to redeem_self_service_reward_transition_legacy_v1;
  end if;
end
$do$;

revoke all on function private.redeem_self_service_reward_transition_legacy_v1(uuid,uuid,numeric,numeric)
  from public, anon, authenticated, service_role;

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
         cards.location_id, cards.stamps_required,
         locations.latitude, locations.longitude,
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

  if v_reward.source = 'stamp_cycle' then
    update public.customer_memberships memberships
    set current_stamp_count = greatest(
          memberships.current_stamp_count - v_reward.stamps_required,
          0
        ),
        total_rewards_redeemed = memberships.total_rewards_redeemed + 1,
        active_cycle_number = memberships.active_cycle_number + 1
    where memberships.id = v_reward.reward_membership_id
    returning memberships.current_stamp_count into new_stamp_count;
  else
    update public.customer_memberships memberships
    set total_rewards_redeemed = memberships.total_rewards_redeemed + 1
    where memberships.id = v_reward.reward_membership_id
    returning memberships.current_stamp_count into new_stamp_count;
  end if;

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

create or replace function public.get_reward_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table(
  scan_status text, reward_event_id uuid, reward_name text, reward_terms text,
  membership_id uuid, current_stamp_count integer, customer_email text,
  customer_phone_last4 text, blocked_reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_token record;
  v_collection record;
begin
  select tokens.id, tokens.merchant_id, tokens.expires_at, tokens.consumed_at,
         tokens.superseded_at, rewards.id as event_id, rewards.reward_name,
         rewards.reward_terms, memberships.id as card_membership_id,
         memberships.current_stamp_count, customers.email,
         customers.phone_last4
  into v_token
  from public.reward_scan_tokens tokens
  join public.reward_events rewards on rewards.id = tokens.reward_event_id
  join public.customer_memberships memberships on memberships.id = tokens.membership_id
  join public.customers customers on customers.id = tokens.customer_id
  where tokens.id = p_scan_token;

  if v_token.id is null then scan_status := 'not_found'; return next; return; end if;
  if v_token.merchant_id <> p_merchant_id then scan_status := 'unauthorized'; return next; return; end if;
  reward_event_id := v_token.event_id;
  reward_name := v_token.reward_name;
  reward_terms := v_token.reward_terms;
  membership_id := v_token.card_membership_id;
  current_stamp_count := v_token.current_stamp_count;
  customer_email := v_token.email;
  customer_phone_last4 := v_token.phone_last4;
  if v_token.superseded_at is not null then scan_status := 'expired'; return next; return; end if;
  -- A consumed token stays redeemed after its own expiry, as before.
  if v_token.consumed_at is not null then scan_status := 'redeemed'; return next; return; end if;
  if v_token.expires_at <= now() then scan_status := 'expired'; return next; return; end if;

  select * into v_collection
  from private.reward_collection_state(v_token.event_id, now());
  if v_collection.state = 'ready' then
    scan_status := 'ready';
  elsif v_collection.state = 'expired' then
    scan_status := 'expired';
  elsif v_collection.state = 'redeemed' then
    scan_status := 'blocked';
    blocked_reason := 'Reward already collected';
  else
    scan_status := 'blocked';
    blocked_reason := v_collection.reason;
  end if;
  return next;
end;
$function$;

revoke all on function public.get_reward_scan_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_reward_scan_context(uuid, uuid) to service_role;

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

revoke all on function public.get_customer_card_state(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_customer_card_state(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
