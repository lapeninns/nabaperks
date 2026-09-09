create trigger qr_codes_guard_status before update on public.qr_codes
for each row execute function public.guard_qr_status_update();

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
  v_active_reward_count integer := 0;
  v_candidate text;
  v_suffix integer := 0;
  v_base_slug text;
  v_created boolean := false;
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

  select count(*)::integer
  into v_active_reward_count
  from public.reward_pool_items
  where reward_pool_items.merchant_id = p_merchant_id
    and reward_pool_items.location_id = v_location_id
    and reward_pool_items.loyalty_card_id = p_loyalty_card_id
    and reward_pool_items.is_active;

  if v_active_reward_count < 3 then
    raise exception 'Add at least 3 active mystery rewards before launching the QR.';
  end if;

  select qr_codes.id, qr_codes.qr_id
  into qr_code_uuid, qr_public_id
  from public.qr_codes
  where qr_codes.merchant_id = p_merchant_id
    and qr_codes.location_id = v_location_id
    and qr_codes.destination_type = 'join'
  order by qr_codes.created_at asc
  limit 1;

  if qr_code_uuid is not null then
    update public.qr_codes
    set loyalty_card_id = p_loyalty_card_id
    where qr_codes.id = qr_code_uuid
      and (
        qr_codes.loyalty_card_id is distinct from p_loyalty_card_id
      );

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

      v_created := true;
      exit;
    exception
      when unique_violation then
        select qr_codes.id, qr_codes.qr_id
        into qr_code_uuid, qr_public_id
        from public.qr_codes
        where qr_codes.merchant_id = p_merchant_id
          and qr_codes.location_id = v_location_id
          and qr_codes.destination_type = 'join'
        limit 1;

        if qr_code_uuid is not null then
          update public.qr_codes
          set loyalty_card_id = p_loyalty_card_id
          where qr_codes.id = qr_code_uuid
            and (
              qr_codes.loyalty_card_id is distinct from p_loyalty_card_id
            );

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

  if v_created then
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
  end if;

  return next;
end;
$$;

create or replace function public.set_qr_active(
  p_merchant_id uuid,
  p_qr_code_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_location_id uuid;
  v_loyalty_card_id uuid;
  v_destination_type text;
  v_active_reward_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_is_active is distinct from true then
    raise insufficient_privilege using message = 'Email verification is required to pause customer scans';
  end if;

  -- Lock before checking state: repeated resumes are no-ops.
  perform 1 from public.qr_codes where id = p_qr_code_id and merchant_id = p_merchant_id for update;
  if not public.is_merchant_owner(p_merchant_id) then
    raise insufficient_privilege using message = 'Merchant owner required';
  end if;
  if exists(select 1 from public.qr_codes where id = p_qr_code_id and merchant_id = p_merchant_id and is_active) then return; end if;
  if exists(select 1 from public.merchants m where m.id = p_merchant_id and m.requires_billing
    and not exists(select 1 from public.billing_customers b where b.merchant_id = m.id and b.status in ('active', 'trialing', 'trial'))) then
    raise exception 'Activate billing to enable your venue QR.';
  end if;

  if p_is_active then
    select qr_codes.location_id, qr_codes.loyalty_card_id, qr_codes.destination_type
    into v_location_id, v_loyalty_card_id, v_destination_type
    from public.qr_codes
    where qr_codes.id = p_qr_code_id
      and qr_codes.merchant_id = p_merchant_id
      and exists (
        select 1
        from public.merchants
        where merchants.id = p_merchant_id
          and merchants.owner_user_id = (select auth.uid())
      );

    if v_location_id is null then
      raise insufficient_privilege using message = 'QR code not found for merchant';
    end if;

    if v_destination_type = 'join' then
      if v_loyalty_card_id is null then
        raise exception 'An active loyalty card is required before launching the QR.';
      end if;

      select count(*)::integer
      into v_active_reward_count
      from public.reward_pool_items
      where reward_pool_items.merchant_id = p_merchant_id
        and reward_pool_items.location_id = v_location_id
        and reward_pool_items.loyalty_card_id = v_loyalty_card_id
        and reward_pool_items.is_active;

      if v_active_reward_count < 3 then
        raise exception 'Add at least 3 active mystery rewards before launching the QR.';
      end if;
    end if;
  end if;

  update public.qr_codes
  set is_active = p_is_active
  where qr_codes.id = p_qr_code_id
    and qr_codes.merchant_id = p_merchant_id
    and exists (
      select 1
      from public.merchants
      where merchants.id = p_merchant_id
        and merchants.owner_user_id = (select auth.uid())
    );

  if not found then
    raise insufficient_privilege using message = 'QR code not found for merchant';
  end if;

  perform public.record_merchant_qr_transition(p_qr_code_id, auth.uid());
end;
$$;

notify pgrst, 'reload schema';

-- The legacy void RPC remains compatible. The merchant UI needs a precise
-- transition outcome so a no-op cannot claim that another email was queued.
create function public.resume_merchant_qr(p_merchant_id uuid, p_qr_code_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_active boolean;
begin
  select q.is_active into v_active from public.qr_codes q join public.merchants m on m.id = q.merchant_id
    where q.id = p_qr_code_id and q.merchant_id = p_merchant_id and q.destination_type = 'join'
      and m.owner_user_id = auth.uid() for update of q;
  if not found then raise insufficient_privilege using message = 'QR code not found for merchant'; end if;
  if v_active then return jsonb_build_object('status', 'unchanged'); end if;
  perform public.set_qr_active(p_merchant_id, p_qr_code_id, true);
  return jsonb_build_object('status', 'resumed');
end;
$$;
revoke all on function public.resume_merchant_qr(uuid, uuid) from public, anon, service_role;
grant execute on function public.resume_merchant_qr(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
