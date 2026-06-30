create or replace function public.admin_resolve_fraud_flag(
  p_fraud_flag_id uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  flag_record record;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_status not in ('reviewed', 'dismissed') then
    raise exception 'Unsupported fraud flag status';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 4 then
    raise exception 'Fraud review reason is required';
  end if;

  select id, merchant_id, customer_id, status
  into flag_record
  from public.fraud_flags
  where id = p_fraud_flag_id
  for update;

  if flag_record.id is null then
    raise exception 'Fraud flag not found';
  end if;

  update public.fraud_flags
  set status = p_status
  where id = flag_record.id;

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
    'admin',
    admin_user_id::text,
    flag_record.merchant_id,
    flag_record.customer_id,
    'fraud_flags',
    flag_record.id,
    'fraud_flag_resolved',
    jsonb_build_object(
      'previous_status', flag_record.status,
      'status', p_status,
      'reason', trim(p_reason)
    )
  );
end;
$$;

grant execute on function public.admin_resolve_fraud_flag(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
