-- Admin access: active internal_admins row only.
-- Drop the AAL2 (authenticator MFA) requirement added in
-- 20260702180000_admin_mfa_hardening.sql. Operators sign in with email +
-- password; email OTP remains for signup verify and password reset.
create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.internal_admins
    where user_id = (select auth.uid())
      and is_active
  );
$$;

grant execute on function public.is_internal_admin() to authenticated, service_role;

notify pgrst, 'reload schema';
