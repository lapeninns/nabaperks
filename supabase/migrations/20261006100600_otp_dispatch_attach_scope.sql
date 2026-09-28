-- SMS code admission accepts an 'attach' scope.
--
-- A customer whose wallet was created by email will be able to add a phone
-- from their profile. That send must be admitted like every other customer
-- SMS code, but its global quota must stay separate from joining and wallet
-- sign-in so profile additions cannot starve either journey.
-- admit_customer_otp_dispatch (latest body 20261005100700, which raised the
-- per-phone ceiling to 10 codes in 15 minutes) refused any scope other than
-- 'wallet' and 'join'; it now also accepts 'attach'.
-- The scope only names its own global buckets
-- ('customer-otp:dispatch:attach:...'); every limit, the recognised-device
-- path, the per-phone, identity and IP buckets and the grants are unchanged
-- from 20261005100700.
--
-- Forward-only and re-runnable (create or replace); grants re-asserted.
create or replace function public.admit_customer_otp_dispatch(
  p_scope text,
  p_phone_bucket text,
  p_identity_bucket text,
  p_ip_bucket text,
  p_phone_hmac text,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_trusted boolean := false;
begin
  if p_scope not in ('wallet', 'join', 'attach')
     or p_phone_bucket !~ '^[0-9a-f]{64}$'
     or p_identity_bucket !~ '^[0-9a-f]{64}$'
     or p_ip_bucket !~ '^[0-9a-f]{64}$'
     or p_phone_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid customer OTP admission input';
  end if;

  if p_device_hash ~ '^[0-9a-f]{64}$' then
    select exists (
      select 1
      from public.customers customer
      join public.customer_otp_trusted_devices device
        on device.customer_id = customer.id
      where customer.phone_hmac = p_phone_hmac
        and device.device_hash = p_device_hash
        and device.revoked_at is null
        and customer.created_at <= now() - interval '7 days'
        and device.trusted_at <= now() - interval '7 days'
        and device.trusted_until > now()
        and exists (
          select 1
          from public.customer_memberships membership
          where membership.customer_id = customer.id
        )
    ) into v_trusted;
  end if;

  -- One outer RPC transaction owns every debit. If any narrower or global
  -- check rejects, PostgreSQL rolls back all earlier increments.
  if not v_trusted then
    perform public.enforce_rate_limit(
      'customer-otp:dispatch:' || p_scope || ':anonymous:burst:v2',
      24,
      60000
    );
    perform public.enforce_rate_limit(
      'customer-otp:dispatch:' || p_scope || ':anonymous:sustained:v2',
      120,
      3600000
    );
  else
    perform public.enforce_rate_limit(
      p_phone_bucket || ':recognised-hour:v2',
      3,
      3600000
    );
  end if;

  perform public.enforce_rate_limit(p_ip_bucket, 30, 86400000);
  perform public.enforce_rate_limit(p_identity_bucket, 10, 86400000);
  perform public.enforce_rate_limit(p_phone_bucket, 10, 900000);
  perform public.enforce_rate_limit(
    'customer-otp:dispatch:' || p_scope || ':total:burst:v2',
    30,
    60000
  );
  perform public.enforce_rate_limit(
    'customer-otp:dispatch:' || p_scope || ':total:sustained:v2',
    150,
    3600000
  );

  return v_trusted;
end;
$$;

revoke all on function public.admit_customer_otp_dispatch(
  text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.admit_customer_otp_dispatch(
  text, text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';
