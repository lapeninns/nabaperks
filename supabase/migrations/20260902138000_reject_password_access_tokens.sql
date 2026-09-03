-- Password attempts can bypass application rate limits by calling GoTrue
-- directly. This custom access-token hook makes password-origin authority
-- impossible at the provider boundary while preserving email OTP and TOTP.

create or replace function public.reject_password_access_tokens(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, auth, extensions
as $$
declare
  authentication_method text := event ->> 'authentication_method';
  claims jsonb := event -> 'claims';
  has_passwordless_method boolean := false;
  used_password boolean := false;
begin
  if jsonb_typeof(claims -> 'amr') = 'array' then
    select
      exists (
        select 1
        from jsonb_array_elements(claims -> 'amr') method
        where method ->> 'method' in ('otp', 'totp')
      ),
      exists (
        select 1
        from jsonb_array_elements(claims -> 'amr') method
        where method ->> 'method' = 'password'
      )
    into has_passwordless_method, used_password;
  end if;

  if
    authentication_method = 'password'
    or used_password
    or not has_passwordless_method
  then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Password authentication is disabled; use an email code.'
      )
    );
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
revoke all on function public.reject_password_access_tokens(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.reject_password_access_tokens(jsonb)
  to supabase_auth_admin;

-- The hook prevents every future password-origin issuance. This request-time
-- guard closes the short rollout window for JWTs minted just before hook
-- activation without decoding bearer credentials in application code.
create or replace function public.current_auth_session_is_passwordless()
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then
      exists (
        select 1
        from jsonb_array_elements(auth.jwt() -> 'amr') method
        where method ->> 'method' in ('otp', 'totp')
      )
      and not exists (
        select 1
        from jsonb_array_elements(auth.jwt() -> 'amr') method
        where method ->> 'method' = 'password'
      )
    else false
  end;
$$;

revoke all on function public.current_auth_session_is_passwordless()
  from public, anon, authenticated, service_role;
grant execute on function public.current_auth_session_is_passwordless()
  to authenticated, service_role;

-- App route guards cannot protect a JWT used directly against PostgREST. Run
-- the same positive-evidence check before every Data API request so a password
-- JWT minted just before hook activation cannot read RLS-protected tables or
-- call authenticated RPCs during the rollout window.
create or replace function public.enforce_passwordless_data_api_session()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if
    auth.role() = 'authenticated'
    and not public.current_auth_session_is_passwordless()
  then
    raise insufficient_privilege using
      message = 'A passwordless authentication session is required';
  end if;
end;
$$;

revoke all on function public.enforce_passwordless_data_api_session()
  from public, anon, authenticated, service_role;
grant execute on function public.enforce_passwordless_data_api_session()
  to anon, authenticated, service_role;

alter role authenticator
  set pgrst.db_pre_request = 'public.enforce_passwordless_data_api_session';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
