-- Admin authority is valid only for an active allowlisted user whose current
-- Supabase Auth session has completed MFA. The application keeps the
-- identity-only enrolment path open, while every database-backed admin read or
-- mutation fails closed at AAL1.

create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    (select auth.uid()) is not null
    and coalesce(
      nullif((select auth.jwt() ->> 'aal'), ''),
      nullif(current_setting('request.jwt.claim.aal', true), '')
    ) = 'aal2'
    and exists (
      select 1
      from public.internal_admins
      where user_id = (select auth.uid())
        and is_active
    );
$$;

revoke all on function public.is_internal_admin() from public, anon;
grant execute on function public.is_internal_admin() to authenticated, service_role;

notify pgrst, 'reload schema';
