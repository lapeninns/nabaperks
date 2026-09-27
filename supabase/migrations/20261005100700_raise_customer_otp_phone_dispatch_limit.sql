-- A customer can request 10 phone codes in 15 minutes.
--
-- The per-phone dispatch ceiling was 5. Signing in, correcting a number, and
-- resending used that up, and further sends were refused until the window
-- reset. Guess attempts stay at 5 per 15 minutes in admit_customer_otp_verify.
-- Every other dispatch ceiling is unchanged.

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
  if p_scope not in ('wallet', 'join')
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
