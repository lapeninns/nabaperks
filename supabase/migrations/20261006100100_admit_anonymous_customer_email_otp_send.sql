-- Anonymous email sign-in code admission.
--
-- A signed-out guest asking for an email sign-in code has no customer row yet,
-- so admit_customer_email_otp_send (20260909111000), which debits a customer
-- bucket, cannot be used. This admits one send against six hashed buckets the
-- server derives: recipient, recipient cooldown, device, client IP, and two
-- global windows. Modelled on admit_customer_email_otp_send and
-- admit_customer_otp_dispatch (20260902137000).
--
-- Limits
--   recipient  3 per 15 minutes      cooldown  1 per 60 seconds
--   device     6 per 15 minutes      IP        60 per hour
--   global    30 per minute          global   150 per hour
--
-- All six debits run in the caller's single RPC transaction, so a refusal by
-- any bucket rolls back every earlier increment (all-or-nothing). Buckets are
-- debited in a stable byte order, so concurrent requests sharing only some keys
-- cannot deadlock. Keys must be distinct 64-character lowercase hex digests;
-- raw emails, IPs or device identifiers are refused before anything is debited.
-- The caller treats a refusal as a silent success (no code sent, same response).
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
        <> cardinality(v_keys) then
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
      (p_global_hour_bucket, 150, 3600000)
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
  'Atomically admits a signed-out email sign-in code against hashed device (6/15min), IP (60/hour), recipient (3/15min), recipient cooldown (1/minute) and global (30/minute, 150/hour) buckets. All-or-nothing. Service role only.';

notify pgrst, 'reload schema';
