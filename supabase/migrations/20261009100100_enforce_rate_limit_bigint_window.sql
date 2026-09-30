-- QA BUG-007 (38c42a1..2c45031): the reward-invite email fatigue cap uses a
-- 30-day window (2,592,000,000 ms), which does not fit the int4 p_window_ms.
-- PostgREST coerced the JSON number to integer and Postgres raised 22003, so
-- the first reward invite to a new email returned a 500 after the invite row
-- was already written.
--
-- Widen p_window_ms to bigint. PostgREST resolves RPCs by argument name, so
-- the old (text, integer, integer) overload is dropped rather than kept beside
-- the new one: two overloads with the same names would be ambiguous. SQL
-- callers that pass integer literals resolve through the implicit int -> bigint
-- cast, and the deployed app passes JSON numbers. Body, owner, SECURITY
-- DEFINER, search_path and the service-role-only grant are unchanged.

drop function if exists public.enforce_rate_limit(text, integer, integer);

create or replace function public.enforce_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_ms bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket_record record;
  v_now timestamptz := clock_timestamp();
  v_next_reset timestamptz := clock_timestamp() + ((p_window_ms::text || ' milliseconds')::interval);
begin
  if length(trim(coalesce(p_bucket_key, ''))) < 16 then
    raise exception 'Rate limit bucket key is required';
  end if;

  if p_limit < 1 or p_window_ms < 1000 then
    raise exception 'Invalid rate limit configuration';
  end if;

  insert into public.rate_limit_buckets (bucket_key, count, reset_at)
  values (p_bucket_key, 1, v_next_reset)
  on conflict (bucket_key) do nothing
  returning rate_limit_buckets.count, rate_limit_buckets.reset_at
    into bucket_record;

  if found then
    return;
  end if;

  select rate_limit_buckets.count, rate_limit_buckets.reset_at
  into bucket_record
  from public.rate_limit_buckets
  where rate_limit_buckets.bucket_key = p_bucket_key
  for update;

  if bucket_record.reset_at <= v_now then
    update public.rate_limit_buckets
    set count = 1,
        reset_at = v_next_reset
    where bucket_key = p_bucket_key;
    return;
  end if;

  if bucket_record.count >= p_limit then
    raise exception 'Rate limit exceeded';
  end if;

  update public.rate_limit_buckets
  set count = count + 1
  where bucket_key = p_bucket_key;
end;
$$;

alter function public.enforce_rate_limit(text, integer, bigint) owner to postgres;

revoke all on function public.enforce_rate_limit(text, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.enforce_rate_limit(text, integer, bigint)
  to service_role;

notify pgrst, 'reload schema';
