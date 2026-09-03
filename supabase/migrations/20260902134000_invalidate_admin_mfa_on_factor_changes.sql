-- AAL2 alone does not identify which factor satisfied a session. Make trusted
-- factor activation monotonic across Auth factor lifecycle changes, bind it to
-- an activation epoch, and make every binding change pass through an audited
-- database-owned path.

create or replace function public.guard_internal_admin_mfa_binding()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    if new.mfa_factor_id is not null or new.mfa_activated_at is not null then
      raise insufficient_privilege using
        message = 'Use the audited admin MFA lifecycle boundary';
    end if;
    return new;
  end if;

  if new.mfa_factor_id is not distinct from old.mfa_factor_id
     and new.mfa_activated_at is not distinct from old.mfa_activated_at then
    return new;
  end if;

  if coalesce(current_setting('app.admin_mfa_binding_change', true), '')
     not in ('trusted_activation', 'factor_lifecycle') then
    raise insufficient_privilege using
      message = 'Use the audited admin MFA lifecycle boundary';
  end if;

  return new;
end;
$function$;

drop trigger if exists internal_admins_guard_mfa_binding
  on public.internal_admins;
create trigger internal_admins_guard_mfa_binding
  before update of mfa_factor_id, mfa_activated_at on public.internal_admins
  for each row execute function public.guard_internal_admin_mfa_binding();

drop trigger if exists internal_admins_guard_initial_mfa_binding
  on public.internal_admins;
create trigger internal_admins_guard_initial_mfa_binding
  before insert on public.internal_admins
  for each row execute function public.guard_internal_admin_mfa_binding();

revoke all on function public.guard_internal_admin_mfa_binding()
  from public, anon, authenticated;
grant execute on function public.guard_internal_admin_mfa_binding()
  to service_role;

create or replace function public.invalidate_internal_admin_mfa_binding()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_factor_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  v_previous_factor_id uuid;
  v_is_admin boolean := false;
  v_previous_change text := current_setting('app.admin_mfa_binding_change', true);
begin
  if tg_op = 'UPDATE'
     and old.user_id is not distinct from new.user_id
     and old.status is not distinct from new.status
     and old.factor_type is not distinct from new.factor_type then
    return new;
  end if;

  select admins.mfa_factor_id, true
  into v_previous_factor_id, v_is_admin
  from public.internal_admins admins
  where admins.user_id = v_user_id
  for update;

  if v_previous_factor_id is not null then
    perform set_config('app.admin_mfa_binding_change', 'factor_lifecycle', true);
    update public.internal_admins
    set mfa_factor_id = null,
        mfa_activated_at = null
    where user_id = v_user_id
      and mfa_factor_id = v_previous_factor_id;
    perform set_config(
      'app.admin_mfa_binding_change',
      coalesce(v_previous_change, ''),
      true
    );

  end if;

  if v_is_admin and (tg_op = 'DELETE' or v_previous_factor_id is not null) then
    insert into public.audit_logs (
      actor_type,
      actor_id,
      target_table,
      target_id,
      action,
      metadata
    ) values (
      'system',
      'admin_mfa_factor_lifecycle',
      'internal_admins',
      v_user_id,
      case when tg_op = 'DELETE'
        then 'admin_mfa_factor_unenrolled'
        else 'admin_mfa_binding_invalidated'
      end,
      jsonb_build_object(
        'factor_id', v_factor_id,
        'previous_factor_id', v_previous_factor_id,
        'factor_operation', lower(tg_op)
      )
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists mfa_factors_invalidate_internal_admin_binding
  on auth.mfa_factors;
create trigger mfa_factors_invalidate_internal_admin_binding
  after insert or delete or update of user_id, status, factor_type
  on auth.mfa_factors
  for each row execute function public.invalidate_internal_admin_mfa_binding();

revoke all on function public.invalidate_internal_admin_mfa_binding()
  from public, anon, authenticated;
grant execute on function public.invalidate_internal_admin_mfa_binding()
  to service_role;

create or replace function public.activate_internal_admin_mfa(
  p_user_id uuid,
  p_factor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  previous_factor_id uuid;
  v_previous_change text := current_setting('app.admin_mfa_binding_change', true);
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  if p_user_id is null or p_factor_id is null then
    raise invalid_parameter_value using
      message = 'Admin user and factor are required';
  end if;

  select admin.mfa_factor_id
  into previous_factor_id
  from public.internal_admins admin
  where admin.user_id = p_user_id
    and admin.is_active
  for update;

  if not found then
    raise insufficient_privilege using message = 'Active admin required';
  end if;

  perform 1
  from auth.mfa_factors factor
  where factor.user_id = p_user_id
  for update;

  if not exists (
       select 1
       from auth.mfa_factors factor
       where factor.id = p_factor_id
         and factor.user_id = p_user_id
         and factor.factor_type = 'totp'
         and factor.status = 'verified'
     )
     or (
       select count(*)
       from auth.mfa_factors factor
       where factor.user_id = p_user_id
         and factor.status = 'verified'
     ) <> 1 then
    raise insufficient_privilege using
      message = 'Exactly one verified TOTP factor is required';
  end if;

  perform set_config('app.admin_mfa_binding_change', 'trusted_activation', true);
  update public.internal_admins
  set mfa_factor_id = p_factor_id,
      mfa_activated_at = date_trunc('second', clock_timestamp())
        + interval '1 second'
  where user_id = p_user_id;
  perform set_config(
    'app.admin_mfa_binding_change',
    coalesce(v_previous_change, ''),
    true
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    target_table,
    target_id,
    action,
    metadata
  ) values (
    'system',
    'trusted_admin_mfa_operator',
    'internal_admins',
    p_user_id,
    'admin_mfa_factor_activated',
    jsonb_build_object(
      'factor_id', p_factor_id,
      'previous_factor_id', previous_factor_id
    )
  );

  return true;
end;
$function$;

revoke all on function public.activate_internal_admin_mfa(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_internal_admin_mfa(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
