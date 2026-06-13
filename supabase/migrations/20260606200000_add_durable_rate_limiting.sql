create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limit_buckets_reset_at_idx
  on public.rate_limit_buckets (reset_at);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'rate_limit_buckets_set_updated_at'
  ) then
    create trigger rate_limit_buckets_set_updated_at
      before update on public.rate_limit_buckets
      for each row execute function public.set_updated_at();
  end if;
end $$;

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
  current_time timestamptz := clock_timestamp();
  next_reset timestamptz := clock_timestamp() + ((p_window_ms::text || ' milliseconds')::interval);
begin
  if length(trim(coalesce(p_bucket_key, ''))) < 16 then
    raise exception 'Rate limit bucket key is required';
  end if;

  if p_limit < 1 or p_window_ms < 1000 then
    raise exception 'Invalid rate limit configuration';
  end if;

  select rate_limit_buckets.count, rate_limit_buckets.reset_at
  into bucket_record
  from public.rate_limit_buckets
  where rate_limit_buckets.bucket_key = p_bucket_key
  for update;

  if not found then
    insert into public.rate_limit_buckets (bucket_key, count, reset_at)
    values (p_bucket_key, 1, next_reset);
    return;
  end if;

  if bucket_record.reset_at <= current_time then
    update public.rate_limit_buckets
    set count = 1,
        reset_at = next_reset
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

alter table public.rate_limit_buckets enable row level security;
alter table public.rate_limit_buckets force row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_limit_buckets'
      and policyname = 'rate_limit_buckets_select_admin_only'
  ) then
    create policy rate_limit_buckets_select_admin_only
      on public.rate_limit_buckets for select to authenticated
      using ((select public.is_internal_admin()));
  end if;
end $$;

grant execute on function public.enforce_rate_limit(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
