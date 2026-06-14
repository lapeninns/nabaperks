alter table public.customers
  alter column auth_user_id drop not null,
  add column if not exists phone_hmac text,
  add column if not exists phone_ciphertext text,
  add column if not exists phone_last4 text,
  add column if not exists phone_country text,
  add column if not exists phone_verified_at timestamptz;

update public.customers
set phone_last4 = right(regexp_replace(phone, '\D', '', 'g'), 4)
where phone_last4 is null
  and phone is not null;

alter table public.customers
  drop constraint if exists customers_contact_present;

alter table public.customers
  add constraint customers_contact_present
  check (email is not null or phone is not null or phone_hmac is not null);

create unique index if not exists customers_phone_hmac_unique_idx
  on public.customers (phone_hmac)
  where phone_hmac is not null;

drop function if exists public.join_customer_membership(text, text, boolean, text);
drop function if exists public.issue_self_service_stamp(uuid, numeric, numeric);
drop function if exists public.redeem_self_service_reward(uuid, numeric, numeric);

create or replace function public.join_customer_membership(
  p_customer_id uuid,
  p_merchant_slug text,
  p_qr_id text,
  p_marketing_opt_in boolean,
  p_policy_version text
)
returns table (membership_id uuid, created_membership boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_role text := nullif(current_setting('request.jwt.claim.role', true), '');
  customer_record record;
  v_merchant_id uuid;
  v_loyalty_card_id uuid;
  v_qr_code_uuid uuid;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    customers.id,
    customers.auth_user_id,
    customers.email,
    customers.phone,
    customers.phone_hmac
  into customer_record
  from public.customers
  where customers.id = p_customer_id;

  if customer_record.id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  if coalesce(request_role, 'authenticated') <> 'service_role' then
    if current_user_id is null
      or customer_record.auth_user_id is null
      or customer_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Customer ownership required';
    end if;
  end if;

  if p_qr_id is not null and p_qr_id <> '' then
    select
      qr_codes.id,
      qr_codes.merchant_id,
      qr_codes.loyalty_card_id
    into
      v_qr_code_uuid,
      v_merchant_id,
      v_loyalty_card_id
    from public.qr_codes
    join public.merchants on merchants.id = qr_codes.merchant_id
    join public.loyalty_cards on loyalty_cards.id = qr_codes.loyalty_card_id
    where qr_codes.qr_id = p_qr_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
      and loyalty_cards.is_active
      and merchants.business_slug = p_merchant_slug;
  else
    select merchants.id, loyalty_cards.id
    into v_merchant_id, v_loyalty_card_id
    from public.merchants
    join public.loyalty_cards on loyalty_cards.merchant_id = merchants.id
    where merchants.business_slug = p_merchant_slug
      and loyalty_cards.is_active
    order by loyalty_cards.created_at asc
    limit 1;
  end if;

  if v_merchant_id is null or v_loyalty_card_id is null then
    raise exception 'This loyalty card is unavailable';
  end if;

  insert into public.customer_memberships (
    merchant_id,
    customer_id
  )
  values (
    v_merchant_id,
    p_customer_id
  )
  on conflict (merchant_id, customer_id) do nothing
  returning id into membership_id;

  created_membership := membership_id is not null;

  if membership_id is null then
    select customer_memberships.id
    into membership_id
    from public.customer_memberships
    where customer_memberships.merchant_id = v_merchant_id
      and customer_memberships.customer_id = p_customer_id;
  end if;

  if p_marketing_opt_in then
    insert into public.consent_records (
      merchant_id,
      customer_id,
      channel,
      consent_status,
      source,
      policy_version,
      metadata
    )
    values (
      v_merchant_id,
      p_customer_id,
      case when customer_record.email is not null then 'email' else 'sms' end,
      'opted_in',
      'customer_join',
      p_policy_version,
      jsonb_build_object('qr_code_id', v_qr_code_uuid)
    );
  end if;

  if created_membership then
    insert into public.product_events (
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      qr_code_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'customer_joined',
      v_merchant_id,
      p_customer_id,
      membership_id,
      v_qr_code_uuid,
      'customer',
      coalesce(current_user_id::text, p_customer_id::text),
      jsonb_build_object('marketing_opt_in', p_marketing_opt_in)
    );
  end if;

  return next;
end;
$$;

create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null
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
  request_role text := nullif(current_setting('request.jwt.claim.role', true), '');
  membership_record record;
  card_record record;
  reward_pool_record record;
  billing_status text;
  recent_stamp_count integer;
  v_business_date date := public.uk_business_date(now());
  v_total_weight integer := 0;
  v_weight_threshold integer;
  v_distance_meters numeric;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.enforce_rate_limit('selfstamp:' || p_membership_id::text, 10, 900000);

  select
    memberships.id,
    memberships.merchant_id,
    memberships.customer_id,
    memberships.current_stamp_count,
    customers.auth_user_id,
    merchants.status as merchant_status
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

  if coalesce(request_role, 'authenticated') <> 'service_role' then
    if current_user_id is null
      or membership_record.auth_user_id is null
      or membership_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Membership ownership required';
    end if;
  end if;

  if membership_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = membership_record.merchant_id;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  select
    loyalty_cards.id,
    loyalty_cards.location_id,
    loyalty_cards.stamps_required,
    merchant_locations.latitude,
    merchant_locations.longitude,
    merchant_locations.geofence_radius_meters,
    merchant_locations.require_geofence
  into card_record
  from public.loyalty_cards
  left join public.merchant_locations on merchant_locations.id = loyalty_cards.location_id
  where loyalty_cards.merchant_id = membership_record.merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if card_record.id is null then
    raise exception 'This loyalty card is not active';
  end if;

  if membership_record.current_stamp_count >= card_record.stamps_required then
    raise exception 'A reward is already ready to redeem';
  end if;

  if exists (
    select 1
    from public.stamp_events
    where stamp_events.membership_id = p_membership_id
      and stamp_events.location_id = card_record.location_id
      and stamp_events.event_type = 'earned'
      and stamp_events.earned_business_date = v_business_date
  ) then
    raise exception 'Stamp already issued for this UK business day';
  end if;

  if membership_record.current_stamp_count + 1 >= card_record.stamps_required then
    select coalesce(sum(reward_pool_items.weight), 0)
    into v_total_weight
    from public.reward_pool_items
    where reward_pool_items.merchant_id = membership_record.merchant_id
      and reward_pool_items.location_id = card_record.location_id
      and reward_pool_items.loyalty_card_id = card_record.id
      and reward_pool_items.is_active;

    if v_total_weight <= 0 then
      raise exception 'At least one active reward pool item is required before unlocking a reward';
    end if;
  end if;

  geo_flagged := false;

  if coalesce(card_record.require_geofence, false) then
    if p_latitude is null
      or p_longitude is null
      or card_record.latitude is null
      or card_record.longitude is null then
      geo_flagged := true;
      perform public.record_self_service_geo_flag(
        membership_record.merchant_id,
        membership_record.customer_id,
        p_membership_id,
        card_record.location_id,
        'self_service_geofence_unknown',
        'stamp',
        p_latitude,
        p_longitude,
        null,
        card_record.geofence_radius_meters
      );
    else
      v_distance_meters := public.geo_distance_meters(
        p_latitude,
        p_longitude,
        card_record.latitude,
        card_record.longitude
      );

      if v_distance_meters > card_record.geofence_radius_meters then
        geo_flagged := true;
        perform public.record_self_service_geo_flag(
          membership_record.merchant_id,
          membership_record.customer_id,
          p_membership_id,
          card_record.location_id,
          'self_service_geofence_out_of_range',
          'stamp',
          p_latitude,
          p_longitude,
          v_distance_meters,
          card_record.geofence_radius_meters
        );
      end if;
    end if;
  end if;

  begin
    insert into public.stamp_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      location_id,
      event_type,
      stamps_delta,
      earned_business_date,
      metadata
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
      jsonb_build_object(
        'source', 'self_service_qr',
        'geo_flagged', geo_flagged,
        'latitude', p_latitude,
        'longitude', p_longitude
      )
    )
    returning id into stamp_event_id;
  exception
    when unique_violation then
      raise exception 'Stamp already issued for this UK business day';
  end;

  update public.customer_memberships
  set
    current_stamp_count = current_stamp_count + 1,
    total_stamps_earned = total_stamps_earned + 1,
    last_visit_at = now()
  where customer_memberships.id = p_membership_id
  returning current_stamp_count into new_stamp_count;

  reward_unlocked := new_stamp_count >= card_record.stamps_required;

  if reward_unlocked then
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

    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      reward_pool_item_id,
      reward_name,
      reward_terms,
      min_spend_pence,
      redeemable_from,
      status,
      metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      card_record.id,
      reward_pool_record.id,
      reward_pool_record.reward_name,
      reward_pool_record.reward_terms,
      reward_pool_record.min_spend_pence,
      public.next_uk_business_date(now()),
      'unlocked',
      jsonb_build_object('source', 'self_service_qr')
    );

    insert into public.product_events (
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'reward_unlocked',
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'system',
      null,
      jsonb_build_object(
        'loyalty_card_id', card_record.id,
        'reward_pool_item_id', reward_pool_record.id
      )
    );
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'stamp_issued',
    membership_record.merchant_id,
    membership_record.customer_id,
    p_membership_id,
    'customer',
    coalesce(current_user_id::text, p_customer_id::text),
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'geo_flagged', geo_flagged
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'customer',
    coalesce(current_user_id::text, p_customer_id::text),
    membership_record.merchant_id,
    membership_record.customer_id,
    'customer_memberships',
    p_membership_id,
    'stamp_issued',
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'business_date', v_business_date,
      'geo_flagged', geo_flagged
    )
  );

  select count(*)
  into recent_stamp_count
  from public.stamp_events
  where stamp_events.merchant_id = membership_record.merchant_id
    and stamp_events.event_type = 'earned'
    and stamp_events.created_at > now() - interval '15 minutes';

  if recent_stamp_count >= 20 and not exists (
    select 1
    from public.fraud_flags
    where fraud_flags.merchant_id = membership_record.merchant_id
      and fraud_flags.signal = 'high_stamp_velocity'
      and fraud_flags.status = 'open'
      and fraud_flags.created_at > now() - interval '15 minutes'
  ) then
    insert into public.fraud_flags (
      merchant_id,
      customer_id,
      membership_id,
      signal,
      severity,
      metadata
    )
    values (
      membership_record.merchant_id,
      membership_record.customer_id,
      p_membership_id,
      'high_stamp_velocity',
      'medium',
      jsonb_build_object(
        'threshold', 20,
        'window_minutes', 15,
        'observed_stamp_count', recent_stamp_count
      )
    );
  end if;

  return next;
end;
$$;

create or replace function public.redeem_self_service_reward(
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
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_role text := nullif(current_setting('request.jwt.claim.role', true), '');
  reward_record record;
  billing_status text;
  v_distance_meters numeric;
  v_geo_flagged boolean := false;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id as reward_membership_id,
    reward_events.reward_name as assigned_reward_name,
    reward_events.redeemable_from,
    customers.auth_user_id,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    loyalty_cards.location_id,
    customer_memberships.current_stamp_count,
    merchants.status as merchant_status,
    merchant_locations.latitude,
    merchant_locations.longitude,
    merchant_locations.geofence_radius_meters,
    merchant_locations.require_geofence
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers on customers.id = reward_events.customer_id
  join public.merchants on merchants.id = reward_events.merchant_id
  join public.loyalty_cards on loyalty_cards.id = reward_events.loyalty_card_id
  left join public.merchant_locations on merchant_locations.id = loyalty_cards.location_id
  where reward_events.id = p_reward_event_id
  for update of reward_events;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  if reward_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if coalesce(request_role, 'authenticated') <> 'service_role' then
    if current_user_id is null
      or reward_record.auth_user_id is null
      or reward_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Reward ownership required';
    end if;
  end if;

  reward_event_id := reward_record.id;
  reward_name := reward_record.assigned_reward_name;
  membership_id := reward_record.reward_membership_id;

  if reward_record.status = 'redeemed' then
    new_stamp_count := reward_record.current_stamp_count;
    return next;
    return;
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not redeemable';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
  end if;

  if not reward_record.card_is_active then
    raise exception 'This loyalty card is not active';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  if reward_record.merchant_status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into billing_status
  from public.billing_customers
  where billing_customers.merchant_id = reward_record.merchant_id;

  if billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  if coalesce(reward_record.require_geofence, false) then
    if p_latitude is null
      or p_longitude is null
      or reward_record.latitude is null
      or reward_record.longitude is null then
      v_geo_flagged := true;
      perform public.record_self_service_geo_flag(
        reward_record.merchant_id,
        reward_record.customer_id,
        reward_record.reward_membership_id,
        reward_record.location_id,
        'self_service_geofence_unknown',
        'reward_redeem',
        p_latitude,
        p_longitude,
        null,
        reward_record.geofence_radius_meters
      );
    else
      v_distance_meters := public.geo_distance_meters(
        p_latitude,
        p_longitude,
        reward_record.latitude,
        reward_record.longitude
      );

      if v_distance_meters > reward_record.geofence_radius_meters then
        v_geo_flagged := true;
        perform public.record_self_service_geo_flag(
          reward_record.merchant_id,
          reward_record.customer_id,
          reward_record.reward_membership_id,
          reward_record.location_id,
          'self_service_geofence_out_of_range',
          'reward_redeem',
          p_latitude,
          p_longitude,
          v_distance_meters,
          reward_record.geofence_radius_meters
        );
      end if;
    end if;
  end if;

  update public.reward_events
  set
    status = 'redeemed',
    redeemed_at = now(),
    metadata = reward_events.metadata || jsonb_build_object(
      'redeemed_by', 'self_service',
      'geo_flagged', v_geo_flagged
    )
  where reward_events.id = reward_record.id
    and reward_events.status = 'unlocked';

  if not found then
    raise exception 'Reward already redeemed';
  end if;

  update public.customer_memberships
  set
    current_stamp_count = greatest(current_stamp_count - reward_record.stamps_required, 0),
    total_rewards_redeemed = total_rewards_redeemed + 1
  where customer_memberships.id = reward_record.reward_membership_id
  returning current_stamp_count into new_stamp_count;

  insert into public.product_events (
    event_name,
    merchant_id,
    customer_id,
    membership_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'reward_redeemed',
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.reward_membership_id,
    'customer',
    coalesce(current_user_id::text, p_customer_id::text),
    jsonb_build_object(
      'reward_id', reward_record.id,
      'reward_name', reward_record.assigned_reward_name,
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    customer_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'customer',
    coalesce(current_user_id::text, p_customer_id::text),
    reward_record.merchant_id,
    reward_record.customer_id,
    'reward_events',
    reward_record.id,
    'reward_redeemed',
    jsonb_build_object(
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged
    )
  );

  return next;
end;
$$;

revoke all on function public.join_customer_membership(uuid, text, text, boolean, text) from public;
revoke all on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric) from public;
revoke all on function public.redeem_self_service_reward(uuid, uuid, numeric, numeric) from public;

grant execute on function public.join_customer_membership(uuid, text, text, boolean, text) to authenticated, service_role;
grant execute on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric) to authenticated, service_role;
grant execute on function public.redeem_self_service_reward(uuid, uuid, numeric, numeric) to authenticated, service_role;
