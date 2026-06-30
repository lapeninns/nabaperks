create or replace function public.reconcile_loyalty_card_threshold_rewards(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_old_stamps_required integer,
  p_new_stamps_required integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_record record;
  reward_pool_record record;
  v_active_reward_count integer := 0;
  v_total_weight integer := 0;
  v_weight_threshold integer := 0;
  v_minted_count integer := 0;
begin
  if p_old_stamps_required is null
    or p_new_stamps_required is null
    or p_new_stamps_required >= p_old_stamps_required then
    return 0;
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.merchant_id = p_merchant_id
      and customer_memberships.current_stamp_count >= p_new_stamps_required
      and not exists (
        select 1
        from public.reward_events
        where reward_events.membership_id = customer_memberships.id
          and reward_events.cycle_number = customer_memberships.active_cycle_number
      )
  ) then
    return 0;
  end if;

  select count(*)::integer, coalesce(sum(reward_pool_items.weight), 0)::integer
  into v_active_reward_count, v_total_weight
  from public.reward_pool_items
  where reward_pool_items.merchant_id = p_merchant_id
    and reward_pool_items.loyalty_card_id = p_loyalty_card_id
    and reward_pool_items.is_active;

  if v_active_reward_count < 3 or v_total_weight <= 0 then
    raise exception 'At least 3 active reward pool items are required before lowering this card threshold.';
  end if;

  for membership_record in
    select
      customer_memberships.id,
      customer_memberships.customer_id,
      customer_memberships.active_cycle_number
    from public.customer_memberships
    where customer_memberships.merchant_id = p_merchant_id
      and customer_memberships.current_stamp_count >= p_new_stamps_required
      and not exists (
        select 1
        from public.reward_events
        where reward_events.membership_id = customer_memberships.id
          and reward_events.cycle_number = customer_memberships.active_cycle_number
      )
    order by customer_memberships.updated_at asc, customer_memberships.id asc
  loop
    if membership_record.active_cycle_number = 1 then
      select *
      into reward_pool_record
      from public.reward_pool_items
      where reward_pool_items.merchant_id = p_merchant_id
        and reward_pool_items.loyalty_card_id = p_loyalty_card_id
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
        where reward_pool_items.merchant_id = p_merchant_id
          and reward_pool_items.loyalty_card_id = p_loyalty_card_id
          and reward_pool_items.is_active
      ) weighted_items
      where weighted_items.running_weight >= v_weight_threshold
      order by weighted_items.running_weight asc
      limit 1;
    end if;

    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      reward_pool_item_id,
      reward_name,
      reward_terms,
      redeemable_from,
      status,
      cycle_number,
      metadata
    )
    values (
      p_merchant_id,
      membership_record.customer_id,
      membership_record.id,
      p_loyalty_card_id,
      reward_pool_record.id,
      reward_pool_record.reward_name,
      reward_pool_record.reward_terms,
      public.next_uk_business_date(now()),
      'unlocked',
      membership_record.active_cycle_number,
      jsonb_build_object(
        'source', 'loyalty_card_threshold_reconciliation',
        'previous_stamps_required', p_old_stamps_required,
        'new_stamps_required', p_new_stamps_required,
        'reward_pool_item_id', reward_pool_record.id
      )
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
      p_merchant_id,
      membership_record.customer_id,
      membership_record.id,
      'system',
      null,
      jsonb_build_object(
        'loyalty_card_id', p_loyalty_card_id,
        'reward_pool_item_id', reward_pool_record.id,
        'source', 'loyalty_card_threshold_reconciliation'
      )
    );

    v_minted_count := v_minted_count + 1;
  end loop;

  return v_minted_count;
end;
$$;

create or replace function public.save_loyalty_card(
  p_merchant_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_stamps_required integer,
  p_reward_name text,
  p_reward_terms text,
  p_is_active boolean
)
returns table (loyalty_card_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  existing_card_id uuid;
  existing_active_card_id uuid;
  v_reward_name text := coalesce(nullif(trim(p_reward_name), ''), 'Surprise reward');
  v_previous_stamps_required integer;
  v_reconciled_rewards integer := 0;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.merchants
    where merchants.id = p_merchant_id
      and merchants.owner_user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select merchant_locations.id
  into v_location_id
  from public.merchant_locations
  where merchant_locations.merchant_id = p_merchant_id
  order by merchant_locations.is_primary desc, merchant_locations.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Merchant location is required before creating a loyalty card';
  end if;

  if p_card_id is not null then
    select loyalty_cards.id, loyalty_cards.stamps_required
    into existing_card_id, v_previous_stamps_required
    from public.loyalty_cards
    where loyalty_cards.id = p_card_id
      and loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id;

    if existing_card_id is null then
      raise insufficient_privilege using message = 'Loyalty card not found for merchant';
    end if;
  else
    select loyalty_cards.id, loyalty_cards.stamps_required
    into existing_card_id, v_previous_stamps_required
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
    order by loyalty_cards.is_active desc, loyalty_cards.created_at asc
    limit 1;
  end if;

  if p_is_active then
    select loyalty_cards.id
    into existing_active_card_id
    from public.loyalty_cards
    where loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id
      and loyalty_cards.is_active
      and (existing_card_id is null or loyalty_cards.id <> existing_card_id)
    limit 1;

    if existing_active_card_id is not null then
      raise exception 'Only one active loyalty card is allowed for this location';
    end if;
  end if;

  if existing_card_id is null then
    insert into public.loyalty_cards (
      merchant_id,
      location_id,
      card_name,
      stamps_required,
      reward_name,
      reward_terms,
      is_active
    )
    values (
      p_merchant_id,
      v_location_id,
      p_card_name,
      p_stamps_required,
      v_reward_name,
      p_reward_terms,
      p_is_active
    )
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_created';
  else
    update public.loyalty_cards
    set
      card_name = p_card_name,
      stamps_required = p_stamps_required,
      reward_name = v_reward_name,
      reward_terms = p_reward_terms,
      is_active = p_is_active
    where loyalty_cards.id = existing_card_id
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_updated';
  end if;

  if existing_card_id is not null and p_is_active then
    v_reconciled_rewards := public.reconcile_loyalty_card_threshold_rewards(
      p_merchant_id,
      loyalty_card_id,
      v_previous_stamps_required,
      p_stamps_required
    );
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object(
      'loyalty_card_id', loyalty_card_id,
      'is_active', p_is_active,
      'threshold_reconciled_rewards', v_reconciled_rewards
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'loyalty_cards',
    loyalty_card_id,
    saved_action,
    jsonb_build_object(
      'stamps_required', p_stamps_required,
      'previous_stamps_required', v_previous_stamps_required,
      'reward_name', v_reward_name,
      'threshold_reconciled_rewards', v_reconciled_rewards
    )
  );

  return next;
end;
$$;

revoke all on function public.reconcile_loyalty_card_threshold_rewards(uuid, uuid, integer, integer) from public;
grant execute on function public.reconcile_loyalty_card_threshold_rewards(uuid, uuid, integer, integer) to service_role;
