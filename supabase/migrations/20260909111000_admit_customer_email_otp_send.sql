-- One transaction owns the existing customer, recipient and cross-flow cooldown
-- buckets. A rejected request must debit none of them, even under concurrency.
create or replace function public.admit_customer_email_otp_send(
  p_customer_bucket text,
  p_recipient_bucket text,
  p_cooldown_bucket text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_bucket record;
begin
  if p_customer_bucket is null or p_recipient_bucket is null
     or p_cooldown_bucket is null
     or p_customer_bucket !~ '^[0-9a-f]{64}$'
     or p_recipient_bucket !~ '^[0-9a-f]{64}$'
     or p_cooldown_bucket !~ '^[0-9a-f]{64}$'
     or p_customer_bucket = p_recipient_bucket
     or p_customer_bucket = p_cooldown_bucket
     or p_recipient_bucket = p_cooldown_bucket then
    raise exception 'Invalid customer email OTP admission input';
  end if;

  -- Stable lock order also covers requests sharing only some of these keys.
  for v_bucket in
    select * from (values
      (p_customer_bucket, 6, 86400000),
      (p_recipient_bucket, 3, 900000),
      (p_cooldown_bucket, 1, 60000)
    ) as buckets(bucket_key, bucket_limit, window_ms)
    order by bucket_key collate "C"
  loop
    perform public.enforce_rate_limit(
      v_bucket.bucket_key, v_bucket.bucket_limit, v_bucket.window_ms
    );
  end loop;
end;
$$;

revoke all on function public.admit_customer_email_otp_send(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admit_customer_email_otp_send(text, text, text)
  to service_role;

comment on function public.admit_customer_email_otp_send(text, text, text) is
  'Atomically admits an email OTP using existing hashed customer (6/day), recipient (3/15min), and shared recipient cooldown (1/minute) buckets. Service role only.';

notify pgrst, 'reload schema';
