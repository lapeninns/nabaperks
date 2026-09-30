-- Customer OTP verify admission: an approved code gives its admission back.
--
-- admit_customer_otp_verify (20260909100100) debits the per-phone and
-- per-identity buckets (5 per 15 minutes each) before the provider check, for
-- every well-formed code. A correct code therefore used up an attempt, and the
-- sixth correct sign-in to one number within 15 minutes was refused with "Too
-- many code attempts" (QA BUG-030, 38c42a1..2c45031).
--
-- The limit now counts rejected codes only. The app keeps calling
-- admit_customer_otp_verify first, unchanged: it refuses once either bucket is
-- exhausted and reserves one attempt atomically, so concurrent wrong guesses
-- can never overshoot the limit. When the provider approves the code, the app
-- calls release_customer_otp_verify, which returns that reservation to both
-- buckets. A rejected code keeps its debit, as before. A provider outage
-- ('unavailable') also keeps it: only an approved code is proof enough to
-- hand an attempt back.
--
-- Compatible with the deployed app: admit_customer_otp_verify is not touched,
-- and an app that never calls the release keeps today's behaviour.
--
-- Forward-only and re-runnable.

create or replace function public.release_customer_otp_verify(
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

  -- Only a live window is credited: a window that has already reset owes
  -- nothing back, and a count never goes below zero.
  update public.rate_limit_buckets
  set count = count - 1
  where bucket_key in (p_phone_bucket, p_identity_bucket)
    and reset_at > clock_timestamp()
    and count > 0;
end;
$$;

revoke all on function public.release_customer_otp_verify(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.release_customer_otp_verify(text, text)
  to service_role;

comment on function public.release_customer_otp_verify(text, text) is
  'Returns the attempt admit_customer_otp_verify reserved for a customer OTP code that the provider approved, to the per-phone and per-identity buckets, so only rejected codes count towards the limit. Service role only.';

notify pgrst, 'reload schema';
