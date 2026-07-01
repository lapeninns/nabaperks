create or replace function public.admin_set_qr_active(
  p_qr_code_id uuid,
  p_is_active boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  qr_record record;
  admin_user_id uuid;
  action_name text;
  v_active_reward_count integer := 0;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'QR change reason is required';
  end if;

  select
    qr_codes.id,
    qr_codes.merchant_id,
    qr_codes.location_id,
    qr_codes.loyalty_card_id,
    qr_codes.destination_type
  into qr_record
  from public.qr_codes
  where qr_codes.id = p_qr_code_id;

  if qr_record.id is null then
    raise exception 'QR code not found';
  end if;

  if p_is_active and qr_record.destination_type = 'join' then
    if qr_record.loyalty_card_id is null or qr_record.location_id is null then
      raise exception 'An active loyalty card is required before launching the QR.';
    end if;

    select count(*)::integer
    into v_active_reward_count
    from public.reward_pool_items
    where reward_pool_items.merchant_id = qr_record.merchant_id
      and reward_pool_items.location_id = qr_record.location_id
      and reward_pool_items.loyalty_card_id = qr_record.loyalty_card_id
      and reward_pool_items.is_active;

    if v_active_reward_count < 3 then
      raise exception 'Add at least 3 active mystery rewards before launching the QR.';
    end if;
  end if;

  update public.qr_codes
  set is_active = p_is_active
  where qr_codes.id = p_qr_code_id;

  action_name := case when p_is_active then 'qr_enabled' else 'qr_disabled' end;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    action_name,
    qr_record.merchant_id,
    p_qr_code_id,
    'admin',
    admin_user_id::text,
    jsonb_build_object('reason', trim(p_reason))
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
    'admin',
    admin_user_id::text,
    qr_record.merchant_id,
    'qr_codes',
    p_qr_code_id,
    action_name,
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

grant execute on function public.admin_set_qr_active(uuid, boolean, text) to authenticated, service_role;

notify pgrst, 'reload schema';
