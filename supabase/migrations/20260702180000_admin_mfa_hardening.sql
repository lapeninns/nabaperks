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
  )
  and coalesce(
    nullif((select auth.jwt() ->> 'aal'), ''),
    nullif(current_setting('request.jwt.claim.aal', true), '')
  ) = 'aal2';
$$;

grant execute on function public.is_internal_admin() to authenticated, service_role;

notify pgrst, 'reload schema';
