-- Public QR scan admission: one RPC owns both debits.
--
-- The scan limiter used to be two sequential enforce_rate_limit calls from the
-- app (identity-wide 120/min, then per-code 60/min). Inside one transaction a
-- rejection by the per-code bucket rolls the identity debit back with it, so a
-- refused scan no longer eats the wider budget. Bucket keys and limits are
-- unchanged: existing rate_limit_buckets rows keep their meaning, and the e2e
-- bucket seeder (tests/e2e/helpers/public-qr-router-rate-limit.ts) still
-- targets the same sha256 keys.
--
-- Forward-only and re-runnable. enforce_rate_limit (20260630126000) is not
-- redefined here.

create or replace function public.admit_qr_scan(
  p_identity_bucket text,
  p_code_bucket text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_identity_bucket is null
     or p_code_bucket is null
     or p_identity_bucket !~ '^[0-9a-f]{64}$'
     or p_code_bucket !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid QR scan admission input';
  end if;

  -- Same limits as the former app-side pair: identity 120/min, code 60/min.
  perform public.enforce_rate_limit(p_identity_bucket, 120, 60000);
  perform public.enforce_rate_limit(p_code_bucket, 60, 60000);
end;
$$;

revoke all on function public.admit_qr_scan(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admit_qr_scan(text, text) to service_role;

comment on function public.admit_qr_scan(text, text) is
  'Admits one public QR scan: debits the identity-wide (120/min) and per-code (60/min) buckets in one transaction so a rejection rolls both back. Buckets are sha256 keys from lib/customer/qr-rate-limit-core.ts. Service role only.';

notify pgrst, 'reload schema';
