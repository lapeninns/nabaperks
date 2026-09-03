-- Contract phase for trusted admin-MFA activation. The preceding expand
-- migration already fails admin authority closed while each active admin
-- enrols and is independently activated. This phase advances only when every
-- active admin satisfies the exact approved-factor invariant.

do $migration$
declare
  unactivated_admin_count bigint;
begin
  select count(*)
  into unactivated_admin_count
  from public.internal_admins admin
  where admin.is_active
    and not public.has_activated_admin_mfa(admin.user_id);

  if unactivated_admin_count <> 0 then
    raise check_violation using
      message = 'Active internal admins require independently activated MFA before enforcement';
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
