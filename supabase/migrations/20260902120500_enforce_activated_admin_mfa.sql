-- Product decision: administrator MFA is not mandatory. The preceding expand
-- migration installed an independently activatable WebAuthn boundary and
-- immediately failed admin authority closed. Restore the accepted single-
-- factor policy at the shared database boundary so an authenticated user with
-- an active internal_admins row can use the console without TOTP, a passkey or
-- another second factor.
--
-- This deliberately accepts the increased account-takeover risk. It does not
-- broaden authority beyond active internal-admin membership, and the
-- application still authenticates the user through Supabase before this
-- function can succeed.
create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_admins admin
    where admin.user_id = auth.uid()
      and admin.is_active
  );
$$;

revoke all on function public.is_internal_admin() from public, anon;
grant execute on function public.is_internal_admin()
  to authenticated, service_role;

notify pgrst, 'reload schema';
