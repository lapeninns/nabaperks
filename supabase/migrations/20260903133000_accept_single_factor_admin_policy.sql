-- Product decision: administrator MFA is not mandatory. An authenticated user
-- with an active internal_admins row can use the console without TOTP, a
-- passkey or another second factor.
--
-- This deliberately accepts the increased account-takeover risk. It does not
-- broaden authority beyond active internal-admin membership, and the
-- application still authenticates the user through Supabase before this
-- function can succeed. Keeping this as a new forward migration also converges
-- databases that recorded the earlier mandatory-MFA contract migration.
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
