-- Admin fraud reviews are terminal and retry-safe.
--
-- The original RPC rewrote an already-resolved flag and appended another
-- audit row on every retry. A duplicated form submission could therefore
-- create false review history, while a later request could also flip a
-- dismissed flag back to reviewed (or vice versa).
--
-- Preserve the existing signature and ACL. Repeating the same resolution is a
-- no-op; attempting a different terminal resolution is rejected.

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

  if flag_record.status <> 'open' then
    if flag_record.status = p_status then
      return;
    end if;

    raise exception 'Fraud flag is already resolved';
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

revoke all on function public.admin_resolve_fraud_flag(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_resolve_fraud_flag(uuid, text, text)
  to authenticated;

notify pgrst, 'reload schema';
