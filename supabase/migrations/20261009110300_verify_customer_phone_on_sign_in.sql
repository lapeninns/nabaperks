-- Phone sign-in and join verify the wallet phone they have just proven
-- (QA BUG-031, 38c42a1..2c45031).
--
-- Phone sign-in (/home/login) and join open the live wallet whose phone_hmac
-- matches the number the person has just proven with a code, whether or not
-- that wallet's phone_verified_at is set. A wallet can hold a phone without
-- the timestamp from legacy data, or from an attach that stopped half way
-- before attaches became one transaction (20261009110000). Such a wallet was
-- opened but stayed unverified: it was asked to verify its phone again at
-- collection and its profile offered "Add a phone number".
--
-- The rule is unchanged: whoever proves the number gets the wallet that holds
-- it, and another wallet proving it is told it belongs to another wallet
-- (attach_verified_customer_phone returns contact_conflict). What changes is
-- that the proven sign-in now also marks that wallet's phone verified.
--
-- verify_customer_phone_on_sign_in does it in one transaction under the
-- customer row lock (the lock attach_verified_customer_phone and
-- admin_erase_customer_pii take): it re-checks that the wallet is live (not
-- the erased+...@privacy.invalid placeholder every erasure path writes) and
-- still holds this phone HMAC, sets phone_verified_at, and inserts one
-- customer_phone_verified audit row. It returns
-- verified | already_verified | phone_changed | wallet_unavailable.
-- Neither the verified timestamp nor the audit row is written without the
-- other.
--
-- Compatibility: the deployed app (2c45031c) does not call this function and
-- nothing it reads or writes changes (no table, column, index or trigger is
-- altered). The new app treats a missing function as "not verified this
-- time" and still opens the wallet, so it also runs before this migration.
--
-- Forward-only and re-runnable (create or replace; grants re-asserted).

create or replace function public.verify_customer_phone_on_sign_in(
  p_customer_id uuid,
  p_phone_hmac text,
  p_surface text
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_customer record;
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'verify_customer_phone_on_sign_in requires the service role';
  end if;

  if p_customer_id is null
     or coalesce(p_phone_hmac, '') !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'invalid_parameter_value',
      message = 'A customer id and a phone HMAC are required';
  end if;

  -- Only the surfaces that open a wallet by a proven phone.
  if p_surface is null or p_surface not in ('home_login', 'join') then
    raise exception using
      errcode = 'invalid_parameter_value',
      message = 'Unsupported contact surface';
  end if;

  select customers.email, customers.phone_hmac, customers.phone_verified_at
  into v_customer
  from public.customers
  where customers.id = p_customer_id
  for update;

  if not found
     or coalesce(v_customer.email, '') like 'erased+%@privacy.invalid' then
    return 'wallet_unavailable';
  end if;

  if v_customer.phone_hmac is distinct from p_phone_hmac then
    return 'phone_changed';
  end if;

  if v_customer.phone_verified_at is not null then
    return 'already_verified';
  end if;

  update public.customers
  set phone_verified_at = now(),
      updated_at = now()
  where customers.id = p_customer_id;

  insert into public.audit_logs (
    actor_type, actor_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'customer', p_customer_id::text, p_customer_id, 'customers', p_customer_id,
    'customer_phone_verified',
    jsonb_build_object('surface', p_surface, 'reason', 'phone_sign_in')
  );

  return 'verified';
end;
$function$;

revoke all on function public.verify_customer_phone_on_sign_in(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.verify_customer_phone_on_sign_in(uuid, text, text)
  to service_role;

comment on function public.verify_customer_phone_on_sign_in(uuid, text, text) is
  'Marks the phone of the live wallet that holds it verified, with a customer_phone_verified audit row, after a phone sign-in or join has proven it. Service role only.';

notify pgrst, 'reload schema';
