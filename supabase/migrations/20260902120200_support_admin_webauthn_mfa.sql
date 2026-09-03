-- Move the trusted admin-MFA boundary from TOTP to WebAuthn without changing
-- its exact-factor, sole-factor, activation-epoch or AAL2 guarantees. This is
-- a forward migration because 20260902120000 is already applied in production.

comment on column public.internal_admins.mfa_activated_at is
  'Trusted activation epoch. A session must complete an exact-factor WebAuthn challenge after this instant before it can hold admin authority.';

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
     and factor.factor_type = 'webauthn'
     and factor.status = 'verified'
     and coalesce(
       factor.web_authn_credential #>> '{flags,userVerified}',
       'false'
     ) = 'true'
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

create or replace function public.request_has_post_activation_admin_mfa(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.internal_admins admin
    join auth.sessions auth_session
      on auth_session.id = public.request_auth_session_id()
     and auth_session.user_id = admin.user_id
     and auth_session.factor_id = admin.mfa_factor_id
     and auth_session.aal = 'aal2'
    join auth.mfa_amr_claims amr
      on amr.session_id = auth_session.id
     and amr.authentication_method = 'mfa/webauthn'
     and amr.updated_at > admin.mfa_activated_at
    where admin.user_id = p_user_id
      and admin.mfa_activated_at is not null
      and jsonb_typeof(auth.jwt() -> 'amr') = 'array'
      and exists (
        select 1
        from jsonb_array_elements(auth.jwt() -> 'amr') method
        where method ->> 'method' = 'mfa/webauthn'
          and case
            when method ->> 'timestamp' ~ '^[0-9]+$'
              then (method ->> 'timestamp')::numeric
            else null
          end = floor(extract(epoch from amr.updated_at))
      )
  );
$$;

comment on function public.request_has_post_activation_admin_mfa(uuid) is
  'True only when the signed request token and authoritative Auth session prove a WebAuthn challenge with the activated exact factor after trusted activation.';

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

  update public.internal_admins
  set mfa_factor_id = p_factor_id,
      mfa_activated_at = date_trunc('second', clock_timestamp())
        + interval '1 second'
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
  'Service-role-only audited activation of an independently verified sole user-verified WebAuthn factor for an active internal admin.';

notify pgrst, 'reload schema';
