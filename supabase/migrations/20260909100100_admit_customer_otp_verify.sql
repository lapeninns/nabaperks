-- Customer OTP verify admission: one RPC owns both debits.
--
-- Replaces the two sequential enforce_rate_limit calls the app made before
-- every OTP check (per phone, then per request identity; 5 per 15 minutes
-- each, mirroring customerOtpVerifyRateLimit / customerOtpRateLimitWindowMs in
-- lib/customer/otp-rate-limit-core.ts). One transaction means a rejection by
-- either bucket rolls back the other's debit.
--
-- Forward-only and re-runnable. enforce_rate_limit (20260630126000) is not
-- redefined here.

create or replace function public.admit_customer_otp_verify(
  p_phone_bucket text,
  p_identity_bucket text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_phone_bucket is null
     or p_identity_bucket is null
     or p_phone_bucket !~ '^[0-9a-f]{64}$'
     or p_identity_bucket !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid customer OTP verify admission input';
  end if;

  perform public.enforce_rate_limit(p_phone_bucket, 5, 900000);
  perform public.enforce_rate_limit(p_identity_bucket, 5, 900000);
end;
$$;

revoke all on function public.admit_customer_otp_verify(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admit_customer_otp_verify(text, text)
  to service_role;

comment on function public.admit_customer_otp_verify(text, text) is
  'Admits one customer OTP guess: debits the per-phone and per-identity buckets (5 per 15 minutes each) in one transaction so a rejection rolls both back. Service role only.';

notify pgrst, 'reload schema';
