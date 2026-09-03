-- The previously released factor-lifecycle migration redefined activation as
-- TOTP-only. Restore the WebAuthn-only activation contract after that migration
-- while retaining its guarded binding update and audit behaviour.

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
         and factor.factor_type = 'webauthn'
         and factor.status = 'verified'
         and coalesce(
           factor.web_authn_credential #>> '{flags,userVerified}',
           'false'
         ) = 'true'
     )
     or (
       select count(*)
       from auth.mfa_factors factor
       where factor.user_id = p_user_id
         and factor.status = 'verified'
     ) <> 1 then
    raise insufficient_privilege using
      message = 'Exactly one user-verified WebAuthn factor is required';
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

comment on function public.activate_internal_admin_mfa(uuid, uuid) is
  'Service-role-only audited activation of an independently verified sole user-verified WebAuthn factor for an active internal admin.';

revoke all on function public.activate_internal_admin_mfa(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_internal_admin_mfa(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
