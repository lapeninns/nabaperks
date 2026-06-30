create or replace function public.assert_reward_pool_launch_ready(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  active_reward_count integer;
  has_active_join_qr boolean;
begin
  select count(*)
  into active_reward_count
  from public.reward_pool_items
  where reward_pool_items.merchant_id = p_merchant_id
    and reward_pool_items.location_id = p_location_id
    and reward_pool_items.loyalty_card_id = p_loyalty_card_id
    and reward_pool_items.is_active;

  select exists (
    select 1
    from public.qr_codes
    where qr_codes.merchant_id = p_merchant_id
      and qr_codes.location_id = p_location_id
      and qr_codes.loyalty_card_id = p_loyalty_card_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
  )
  into has_active_join_qr;

  if has_active_join_qr and active_reward_count < 3 then
    raise exception 'Keep at least 3 active rewards before launch QR stays live.';
  end if;
end;
$$;

create or replace function public.upsert_reward_pool_item(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_reward_pool_item_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_weight integer,
  p_is_active boolean,
  p_display_order integer
)
returns table (reward_pool_item_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select loyalty_cards.location_id
  into v_location_id
  from public.loyalty_cards
  where loyalty_cards.id = p_loyalty_card_id
    and loyalty_cards.merchant_id = p_merchant_id;

  if v_location_id is null then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  if p_reward_pool_item_id is not null and not exists (
    select 1
    from public.reward_pool_items
    where reward_pool_items.id = p_reward_pool_item_id
      and reward_pool_items.merchant_id = p_merchant_id
      and reward_pool_items.loyalty_card_id = p_loyalty_card_id
  ) then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  if p_reward_pool_item_id is null then
    insert into public.reward_pool_items (
      merchant_id,
      location_id,
      loyalty_card_id,
      reward_name,
      reward_terms,
      weight,
      is_active,
      display_order
    )
    values (
      p_merchant_id,
      v_location_id,
      p_loyalty_card_id,
      trim(p_reward_name),
      trim(p_reward_terms),
      p_weight,
      p_is_active,
      p_display_order
    )
    returning id into reward_pool_item_id;

    saved_action := 'reward_pool_item_created';
  else
    update public.reward_pool_items
    set
      reward_name = trim(p_reward_name),
      reward_terms = trim(p_reward_terms),
      weight = p_weight,
      is_active = p_is_active,
      display_order = p_display_order
    where reward_pool_items.id = p_reward_pool_item_id
    returning id into reward_pool_item_id;

    saved_action := 'reward_pool_item_updated';
  end if;

  perform public.assert_reward_pool_launch_ready(
    p_merchant_id,
    p_loyalty_card_id,
    v_location_id
  );

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
      'loyalty_card_id', p_loyalty_card_id,
      'reward_pool_item_id', reward_pool_item_id,
      'is_active', p_is_active,
      'weight', p_weight
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
    'reward_pool_items',
    reward_pool_item_id,
    saved_action,
    jsonb_build_object('loyalty_card_id', p_loyalty_card_id)
  );

  return next;
end;
$$;

create or replace function public.delete_reward_pool_item(
  p_merchant_id uuid,
  p_reward_pool_item_id uuid
)
returns table (reward_pool_item_id uuid, deleted boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_loyalty_card_id uuid;
  v_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select loyalty_card_id, location_id
  into v_loyalty_card_id, v_location_id
  from public.reward_pool_items
  where reward_pool_items.id = p_reward_pool_item_id
    and reward_pool_items.merchant_id = p_merchant_id;

  if v_loyalty_card_id is null then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  reward_pool_item_id := p_reward_pool_item_id;

  if exists (
    select 1
    from public.reward_events
    where reward_events.reward_pool_item_id = p_reward_pool_item_id
  ) then
    update public.reward_pool_items
    set is_active = false
    where reward_pool_items.id = p_reward_pool_item_id;

    deleted := false;
  else
    delete from public.reward_pool_items
    where reward_pool_items.id = p_reward_pool_item_id;

    deleted := true;
  end if;

  perform public.assert_reward_pool_launch_ready(
    p_merchant_id,
    v_loyalty_card_id,
    v_location_id
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
    'reward_pool_items',
    p_reward_pool_item_id,
    case when deleted then 'reward_pool_item_deleted' else 'reward_pool_item_archived' end,
    jsonb_build_object('deleted', deleted)
  );

  return next;
end;
$$;

grant execute on function public.assert_reward_pool_launch_ready(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.upsert_reward_pool_item(uuid, uuid, uuid, text, text, integer, boolean, integer) to authenticated, service_role;
grant execute on function public.delete_reward_pool_item(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
