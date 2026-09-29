-- Anonymous email sign-in admission: per-source windows plus a platform cap
-- (QA BUG-003, 38c42a1..2c45031).
--
-- Risk being fixed. 20261006100100 debited two "global" buckets (30 a minute,
-- 150 an hour) whose keys the app derived from constant strings, so every
-- signed-out email send on the platform shared the same two counters. Anyone
-- could make ~150 requests an hour from three IPs (the per-IP bucket allows 60)
-- and every customer's email code was then refused for the rest of the fixed
-- hour window, while the guest still saw the usual "code sent" answer (D8).
-- Email-only wallets have no phone channel to fall back to.
--
-- Change. The app (lib/customer/email-sign-in.ts admitSend) now keys the two
-- windows it passes as p_global_minute_bucket / p_global_hour_bucket by the
-- client's coarse network source (IPv4 /24, IPv6 /48), hashed like every other
-- key. One source still gets 30 a minute and 150 an hour, but can no longer
-- spend anyone else's allowance. A true platform-wide ceiling moves into this
-- function, keyed server-side so no caller can name or pre-fill it, and set
-- high enough that one source cannot reach it:
--
--   platform 120 per minute   (about the email provider's default send rate)
--   platform 1000 per hour    (far above real volume; reaching it needs at
--                              least 7 source prefixes at 150 an hour, each
--                              with 3 or more IPs at 60 an hour)
--
-- It remains a cost and abuse backstop: a distributed actor with many
-- networks can still reach it, and when it does email codes are refused
-- platform-wide until the window resets, exactly as before but at a much
-- higher price. That residual risk is recorded under SEC-RISK-001.
--
-- Limits (all-or-nothing, one transaction, stable byte lock order)
--   recipient  3 per 15 minutes      cooldown  1 per 60 seconds
--   device     6 per 15 minutes      IP        60 per hour
--   source    30 per minute          source   150 per hour     (caller keys)
--   platform 120 per minute          platform 1000 per hour    (fixed keys)
--
-- Compatibility. Same name, parameter names, types, return type, grants and
-- security definer / search_path as 20261006100100, so PostgREST keeps one
-- overload and the deployed 2c45031c app, which still passes the constant
-- global keys, keeps working unchanged (its shared windows keep their old
-- limits until the new app replaces it). A new app against the old function
-- also works: it simply runs without the platform cap.
--
-- Forward-only and re-runnable (create or replace). Service role only.

create or replace function public.admit_anonymous_customer_email_otp_send(
  p_device_bucket text,
  p_ip_bucket text,
  p_recipient_bucket text,
  p_cooldown_bucket text,
  p_global_minute_bucket text,
  p_global_hour_bucket text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_bucket record;
  v_platform_minute_bucket constant text := encode(
    sha256(convert_to('customer-email-sign-in:send:platform:minute', 'UTF8')),
    'hex'
  );
  v_platform_hour_bucket constant text := encode(
    sha256(convert_to('customer-email-sign-in:send:platform:hour', 'UTF8')),
    'hex'
  );
  v_keys text[] := array[
    p_device_bucket, p_ip_bucket, p_recipient_bucket,
    p_cooldown_bucket, p_global_minute_bucket, p_global_hour_bucket
  ];
begin
  if array_position(v_keys, null) is not null
     or exists (
       select 1 from unnest(v_keys) as supplied(bucket_key)
       where supplied.bucket_key !~ '^[0-9a-f]{64}$'
     )
     or (select count(distinct supplied.bucket_key) from unnest(v_keys) as supplied(bucket_key))
        <> cardinality(v_keys)
     or v_platform_minute_bucket = any(v_keys)
     or v_platform_hour_bucket = any(v_keys) then
    raise exception 'Invalid anonymous customer email OTP admission input';
  end if;

  -- Stable lock order also covers requests sharing only some of these keys.
  for v_bucket in
    select * from (values
      (p_device_bucket, 6, 900000),
      (p_ip_bucket, 60, 3600000),
      (p_recipient_bucket, 3, 900000),
      (p_cooldown_bucket, 1, 60000),
      (p_global_minute_bucket, 30, 60000),
      (p_global_hour_bucket, 150, 3600000),
      (v_platform_minute_bucket, 120, 60000),
      (v_platform_hour_bucket, 1000, 3600000)
    ) as buckets(bucket_key, bucket_limit, window_ms)
    order by bucket_key collate "C"
  loop
    perform public.enforce_rate_limit(
      v_bucket.bucket_key, v_bucket.bucket_limit, v_bucket.window_ms
    );
  end loop;
end;
$$;

revoke all on function public.admit_anonymous_customer_email_otp_send(
  text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.admit_anonymous_customer_email_otp_send(
  text, text, text, text, text, text
) to service_role;

comment on function public.admit_anonymous_customer_email_otp_send(
  text, text, text, text, text, text
) is
  'Atomically admits a signed-out email sign-in code against hashed device (6/15min), IP (60/hour), recipient (3/15min), recipient cooldown (1/minute) and caller-keyed network-source (30/minute, 150/hour; the p_global_* parameters) buckets, plus a fixed platform-wide cap (120/minute, 1000/hour). All-or-nothing. Service role only.';

notify pgrst, 'reload schema';
