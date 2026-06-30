create or replace function public.enforce_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_ms integer
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

grant execute on function public.enforce_rate_limit(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
