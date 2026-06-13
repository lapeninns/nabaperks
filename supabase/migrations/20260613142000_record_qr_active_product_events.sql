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
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
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

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    case when p_is_active then 'qr_enabled' else 'qr_disabled' end,
    p_merchant_id,
    p_qr_code_id,
    'merchant',
    (select auth.uid())::text,
    jsonb_build_object('is_active', p_is_active, 'source', 'merchant_qr_action')
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
    p_qr_code_id,
    case when p_is_active then 'qr_enabled' else 'qr_disabled' end,
    jsonb_build_object('is_active', p_is_active)
  );
end;
$$;

grant execute on function public.set_qr_active(uuid, uuid, boolean) to authenticated, service_role;
