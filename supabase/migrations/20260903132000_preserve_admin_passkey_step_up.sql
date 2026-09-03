-- Later legacy lifecycle migrations target auth.mfa_factors. Reassert the
-- application-owned credential lifecycle after the complete migration chain.

drop trigger if exists mfa_factors_invalidate_internal_admin_binding
  on auth.mfa_factors;

create or replace function public.activate_internal_admin_mfa(
  p_user_id uuid,
  p_factor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_factor_id uuid;
  v_previous_change text := current_setting('app.admin_mfa_binding_change', true);
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;
  select admin.mfa_factor_id into v_previous_factor_id
  from public.internal_admins admin
  where admin.user_id = p_user_id and admin.is_active
  for update;
  if not found then
    raise insufficient_privilege using message = 'Active admin required';
  end if;
  if not exists (
    select 1 from public.admin_webauthn_credentials credential
    where credential.id = p_factor_id
      and credential.user_id = p_user_id
      and credential.revoked_at is null
      and credential.user_verified
  ) or (
    select count(*) from public.admin_webauthn_credentials credential
    where credential.user_id = p_user_id and credential.revoked_at is null
  ) <> 1 then
    raise insufficient_privilege using
      message = 'Exactly one server-verified WebAuthn credential is required';
  end if;

  perform set_config('app.admin_mfa_binding_change', 'trusted_activation', true);
  update public.internal_admins
  set mfa_factor_id = p_factor_id,
      mfa_activated_at = clock_timestamp()
  where user_id = p_user_id;
  perform set_config(
    'app.admin_mfa_binding_change', coalesce(v_previous_change, ''), true
  );
  delete from public.admin_webauthn_grants where user_id = p_user_id;
  insert into public.audit_logs (
    actor_type, actor_id, target_table, target_id, action, metadata
  ) values (
    'system', 'trusted_admin_mfa_operator', 'internal_admins', p_user_id,
    'admin_mfa_factor_activated',
    jsonb_build_object('factor_id', p_factor_id, 'previous_factor_id', v_previous_factor_id)
  );
  return true;
end;
$$;

create or replace function public.invalidate_admin_webauthn_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_change text := current_setting('app.admin_mfa_binding_change', true);
begin
  if new.revoked_at is not null and old.revoked_at is null then
    perform set_config('app.admin_mfa_binding_change', 'factor_lifecycle', true);
    update public.internal_admins
    set mfa_factor_id = null, mfa_activated_at = null
    where user_id = new.user_id and mfa_factor_id = new.id;
    perform set_config(
      'app.admin_mfa_binding_change', coalesce(v_previous_change, ''), true
    );
    delete from public.admin_webauthn_grants
    where user_id = new.user_id and credential_id = new.id;
    insert into public.audit_logs (
      actor_type, actor_id, target_table, target_id, action, metadata
    ) values (
      'system', 'admin_mfa_factor_lifecycle', 'internal_admins', new.user_id,
      'admin_mfa_factor_unenrolled', jsonb_build_object('factor_id', new.id)
    );
  end if;
  return new;
end;
$$;

create or replace function public.invalidate_deactivated_admin_webauthn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_change text := current_setting('app.admin_mfa_binding_change', true);
begin
  if old.is_active and not new.is_active then
    perform set_config('app.admin_mfa_binding_change', 'factor_lifecycle', true);
    update public.internal_admins
    set mfa_factor_id = null, mfa_activated_at = null
    where user_id = new.user_id;
    perform set_config(
      'app.admin_mfa_binding_change', coalesce(v_previous_change, ''), true
    );
    delete from public.admin_webauthn_grants where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists internal_admins_invalidate_deactivated_webauthn
  on public.internal_admins;
create trigger internal_admins_invalidate_deactivated_webauthn
  after update of is_active on public.internal_admins
  for each row execute function public.invalidate_deactivated_admin_webauthn();

revoke all on function public.activate_internal_admin_mfa(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.activate_internal_admin_mfa(uuid, uuid)
  to service_role;
revoke all on function public.invalidate_admin_webauthn_binding()
  from public, anon, authenticated, service_role;
revoke all on function public.invalidate_deactivated_admin_webauthn()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
