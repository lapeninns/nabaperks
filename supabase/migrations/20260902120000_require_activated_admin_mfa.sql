-- Internal-admin authority requires a factor that a trusted operator activated
-- after independent identity verification. Browser-reachable MFA enrolment is
-- not sufficient to activate a password-only administrator.

alter table public.internal_admins
  add column if not exists mfa_factor_id uuid;

comment on column public.internal_admins.mfa_factor_id is
  'Exact verified MFA factor independently approved by a trusted operator. Null keeps the admin in enrolment-only state.';

create or replace function public.has_activated_admin_mfa(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.internal_admins admin
    join auth.mfa_factors factor
     on factor.id = admin.mfa_factor_id
     and factor.user_id = admin.user_id
     and factor.factor_type = 'totp'
     and factor.status = 'verified'
    where admin.user_id = p_user_id
      and admin.is_active
      and admin.mfa_factor_id is not null
      and (
        select count(*)
        from auth.mfa_factors verified_factor
        where verified_factor.user_id = admin.user_id
          and verified_factor.status = 'verified'
      ) = 1
  );
$$;

comment on function public.has_activated_admin_mfa(uuid) is
  'True only when an active admin has exactly one verified MFA factor and it is the exact factor approved by a trusted operator.';

create or replace function public.viewer_has_activated_admin_mfa()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_activated_admin_mfa((select auth.uid()));
$$;

comment on function public.viewer_has_activated_admin_mfa() is
  'Reports only whether the calling admin has an independently activated MFA factor.';

create or replace function public.activate_internal_admin_mfa(
  p_user_id uuid,
  p_factor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  previous_factor_id uuid;
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

  update public.internal_admins
  set mfa_factor_id = p_factor_id
  where user_id = p_user_id;

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
$$;

comment on function public.activate_internal_admin_mfa(uuid, uuid) is
  'Service-role-only audited activation of an independently verified sole TOTP factor for an active internal admin.';

create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_activated_admin_mfa((select auth.uid()))
    and (select public.request_assurance_level()) = 'aal2';
$$;

revoke all on function public.has_activated_admin_mfa(uuid)
  from public, anon, authenticated;
grant execute on function public.has_activated_admin_mfa(uuid) to service_role;

revoke all on function public.viewer_has_activated_admin_mfa()
  from public, anon;
grant execute on function public.viewer_has_activated_admin_mfa()
  to authenticated, service_role;

revoke all on function public.activate_internal_admin_mfa(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_internal_admin_mfa(uuid, uuid)
  to service_role;

grant execute on function public.is_internal_admin()
  to authenticated, service_role;

notify pgrst, 'reload schema';
