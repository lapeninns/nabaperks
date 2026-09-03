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
  used_password boolean := false;
begin
  select exists (
    select 1
    from jsonb_array_elements(coalesce(claims -> 'amr', '[]'::jsonb)) method
    where method ->> 'method' = 'password'
  ) into used_password;

  if authentication_method = 'password' or used_password then
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
    when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then not exists (
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

notify pgrst, 'reload schema';
