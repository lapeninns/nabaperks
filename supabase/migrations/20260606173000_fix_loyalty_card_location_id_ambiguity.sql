-- PL/pgSQL variables named location_id shadow loyalty_cards.location_id in INSERT/WHERE clauses.

create or replace function public.save_loyalty_card(
  p_merchant_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_stamps_required integer,
  p_reward_name text,
  p_reward_terms text,
  p_min_spend_pence integer,
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
    select loyalty_cards.id
    into existing_card_id
    from public.loyalty_cards
    where loyalty_cards.id = p_card_id
      and loyalty_cards.merchant_id = p_merchant_id
      and loyalty_cards.location_id = v_location_id;

    if existing_card_id is null then
      raise insufficient_privilege using message = 'Loyalty card not found for merchant';
    end if;
  else
    select loyalty_cards.id
    into existing_card_id
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
      min_spend_pence,
      is_active
    )
    values (
      p_merchant_id,
      v_location_id,
      p_card_name,
      p_stamps_required,
      p_reward_name,
      p_reward_terms,
      p_min_spend_pence,
      p_is_active
    )
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_created';
  else
    update public.loyalty_cards
    set
      card_name = p_card_name,
      stamps_required = p_stamps_required,
      reward_name = p_reward_name,
      reward_terms = p_reward_terms,
      min_spend_pence = p_min_spend_pence,
      is_active = p_is_active
    where loyalty_cards.id = existing_card_id
    returning id into loyalty_card_id;

    saved_action := 'loyalty_card_updated';
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
    jsonb_build_object('loyalty_card_id', loyalty_card_id, 'is_active', p_is_active)
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
    jsonb_build_object('stamps_required', p_stamps_required)
  );

  return next;
end;
$$;

create or replace function public.create_or_get_join_qr(
  p_merchant_id uuid,
  p_loyalty_card_id uuid
)
returns table (qr_code_uuid uuid, qr_public_id text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_location_id uuid;
  generated_qr_id text;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select loyalty_cards.location_id
  into v_location_id
  from public.loyalty_cards
  join public.merchants on merchants.id = loyalty_cards.merchant_id
  where loyalty_cards.id = p_loyalty_card_id
    and loyalty_cards.merchant_id = p_merchant_id
    and loyalty_cards.is_active
    and merchants.owner_user_id = (select auth.uid());

  if v_location_id is null then
    raise insufficient_privilege using message = 'An active loyalty card owned by this merchant is required';
  end if;

  select qr_codes.id, qr_codes.qr_id
  into qr_code_uuid, qr_public_id
  from public.qr_codes
  where qr_codes.merchant_id = p_merchant_id
    and qr_codes.location_id = v_location_id
    and qr_codes.loyalty_card_id = p_loyalty_card_id
    and qr_codes.destination_type = 'join'
  order by qr_codes.is_active desc, qr_codes.created_at asc
  limit 1;

  if qr_code_uuid is not null then
    return next;
    return;
  end if;

  loop
    generated_qr_id := lower(
      replace(
        replace(
          rtrim(encode(extensions.gen_random_bytes(9), 'base64'), '='),
          '+',
          '-'
        ),
        '/',
        '_'
      )
    );

    begin
      insert into public.qr_codes (
        qr_id,
        merchant_id,
        location_id,
        loyalty_card_id,
        destination_type,
        is_active
      )
      values (
        generated_qr_id,
        p_merchant_id,
        v_location_id,
        p_loyalty_card_id,
        'join',
        true
      )
      returning id, qr_id into qr_code_uuid, qr_public_id;

      exit;
    exception
      when unique_violation then
        qr_code_uuid := null;
        qr_public_id := null;
    end;
  end loop;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'qr_created',
    p_merchant_id,
    qr_code_uuid,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('destination_type', 'join')
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
    'qr_codes',
    qr_code_uuid,
    'qr_created',
    jsonb_build_object('qr_id', qr_public_id)
  );

  return next;
end;
$$;
