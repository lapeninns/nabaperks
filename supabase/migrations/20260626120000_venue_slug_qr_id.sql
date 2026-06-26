-- Join QR public ids use a slug derived from the venue name instead of random tokens.

create or replace function public.slugify_text(p_input text)
returns text
language sql
immutable
as $$
  select left(
    trim(
      both '-' from regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(p_input, '')), '&', ' and ', 'g'),
          '[^a-z0-9]+',
          '-',
          'g'
        ),
        '-+',
        '-',
        'g'
      )
    ),
    48
  );
$$;

create or replace function public.derive_join_qr_public_id(
  p_merchant_id uuid,
  p_location_id uuid,
  p_exclude_qr_code_id uuid default null
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_base_slug text;
  v_candidate text;
  v_suffix integer := 0;
begin
  select public.slugify_text(
    coalesce(
      nullif(trim(merchant_locations.name), ''),
      nullif(trim(merchants.business_name), ''),
      'venue'
    )
  )
  into v_base_slug
  from public.merchant_locations
  join public.merchants on merchants.id = merchant_locations.merchant_id
  where merchant_locations.id = p_location_id
    and merchant_locations.merchant_id = p_merchant_id;

  if coalesce(v_base_slug, '') = '' then
    v_base_slug := 'venue';
  end if;

  v_candidate := v_base_slug;

  loop
    if not exists (
      select 1
      from public.qr_codes
      where qr_codes.qr_id = v_candidate
        and (p_exclude_qr_code_id is null or qr_codes.id <> p_exclude_qr_code_id)
    ) then
      return v_candidate;
    end if;

    if exists (
      select 1
      from public.qr_codes
      where qr_codes.qr_id = v_candidate
        and qr_codes.merchant_id = p_merchant_id
        and qr_codes.location_id = p_location_id
        and (p_exclude_qr_code_id is null or qr_codes.id = p_exclude_qr_code_id)
    ) then
      return v_candidate;
    end if;

    v_suffix := v_suffix + 1;

    if v_suffix > 50 then
      return v_base_slug || '-' || left(p_merchant_id::text, 8);
    end if;

    v_candidate := v_base_slug || '-' || (v_suffix + 1)::text;
  end loop;
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
  v_candidate text;
  v_suffix integer := 0;
  v_base_slug text;
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

  if not exists (
    select 1
    from public.reward_pool_items
    where reward_pool_items.merchant_id = p_merchant_id
      and reward_pool_items.location_id = v_location_id
      and reward_pool_items.loyalty_card_id = p_loyalty_card_id
      and reward_pool_items.is_active
  ) then
    raise exception 'Add at least one active mystery reward before launching the QR.';
  end if;

  select qr_codes.id, qr_codes.qr_id
  into qr_code_uuid, qr_public_id
  from public.qr_codes
  where qr_codes.merchant_id = p_merchant_id
    and qr_codes.location_id = v_location_id
    and qr_codes.destination_type = 'join'
    and qr_codes.is_active
  order by qr_codes.created_at asc
  limit 1;

  if qr_code_uuid is not null then
    update public.qr_codes
    set loyalty_card_id = p_loyalty_card_id
    where qr_codes.id = qr_code_uuid
      and qr_codes.loyalty_card_id <> p_loyalty_card_id;

    return next;
    return;
  end if;

  v_base_slug := public.derive_join_qr_public_id(p_merchant_id, v_location_id);
  v_candidate := v_base_slug;

  loop
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
        v_candidate,
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
        select qr_codes.id, qr_codes.qr_id
        into qr_code_uuid, qr_public_id
        from public.qr_codes
        where qr_codes.merchant_id = p_merchant_id
          and qr_codes.location_id = v_location_id
          and qr_codes.destination_type = 'join'
          and qr_codes.is_active
        limit 1;

        if qr_code_uuid is not null then
          exit;
        end if;

        v_suffix := v_suffix + 1;

        if v_suffix > 50 then
          v_candidate := v_base_slug || '-' || left(p_merchant_id::text, 8);
        else
          v_candidate := v_base_slug || '-' || (v_suffix + 1)::text;
        end if;
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

do $$
declare
  rec record;
  new_qr_id text;
begin
  for rec in
    select qr_codes.id, qr_codes.merchant_id, qr_codes.location_id, qr_codes.qr_id
    from public.qr_codes
    where qr_codes.destination_type = 'join'
    order by qr_codes.created_at asc
  loop
    new_qr_id := public.derive_join_qr_public_id(
      rec.merchant_id,
      rec.location_id,
      rec.id
    );

    if new_qr_id <> rec.qr_id then
      update public.qr_codes
      set qr_id = new_qr_id
      where qr_codes.id = rec.id;
    end if;
  end loop;
end $$;

grant execute on function public.slugify_text(text) to authenticated, service_role;
grant execute on function public.derive_join_qr_public_id(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.create_or_get_join_qr(uuid, uuid) to authenticated, service_role;
