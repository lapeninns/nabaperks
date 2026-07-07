-- MS-db-merchant-analytics-rpcs: SQL-side aggregation for merchant analytics.
--
-- The 14-day dashboard series and the 7-day activity summary fetched raw
-- rows and tallied them in JS, so PostgREST's 1,000-row response cap
-- silently under-counted busy venues (2026-07-07 stress test: rows=1000
-- truncation at 100k members). These RPCs aggregate in SQL — output is one
-- row per London day / per event name, exact at any volume. Service-role
-- only at the ACL, with the same in-body defense-in-depth guard as
-- get_merchant_dashboard_metrics.

drop function if exists public.get_merchant_dashboard_series(uuid, integer);
create function public.get_merchant_dashboard_series(
  target_merchant_id uuid,
  p_days integer default 14
)
returns table(day date, joins bigint, stamps bigint, rewards bigint)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 90);
  v_since timestamptz;
begin
  if target_merchant_id is null then
    raise exception 'merchant_id is required';
  end if;

  if not (
    public.is_service_role_request()
    or public.is_internal_admin()
    or public.is_merchant_owner(target_merchant_id)
  ) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  -- Window start = London midnight of the first bucket day, matching the
  -- dashboard's buildDayBuckets window.
  v_since := (((now() at time zone 'Europe/London')::date - (v_days - 1))::timestamp)
    at time zone 'Europe/London';

  return query
  with cte_joins as (
    select (cm.created_at at time zone 'Europe/London')::date as d, count(*) as n
    from public.customer_memberships cm
    where cm.merchant_id = target_merchant_id
      and cm.created_at >= v_since
    group by 1
  ),
  cte_stamps as (
    select (se.created_at at time zone 'Europe/London')::date as d, count(*) as n
    from public.stamp_events se
    where se.merchant_id = target_merchant_id
      and se.event_type = 'earned'
      and se.created_at >= v_since
    group by 1
  ),
  cte_rewards as (
    select (re.created_at at time zone 'Europe/London')::date as d, count(*) as n
    from public.reward_events re
    where re.merchant_id = target_merchant_id
      and re.status = 'redeemed'
      and re.created_at >= v_since
    group by 1
  )
  select
    coalesce(j.d, s.d, r.d) as day,
    coalesce(j.n, 0)::bigint as joins,
    coalesce(s.n, 0)::bigint as stamps,
    coalesce(r.n, 0)::bigint as rewards
  from cte_joins j
  full outer join cte_stamps s on s.d = j.d
  full outer join cte_rewards r on r.d = coalesce(j.d, s.d)
  order by 1;
end;
$$;

drop function if exists public.get_merchant_activity_event_counts(uuid, timestamptz, text[]);
create function public.get_merchant_activity_event_counts(
  target_merchant_id uuid,
  p_since timestamptz,
  p_event_names text[]
)
returns table(event_name text, event_count bigint)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if target_merchant_id is null then
    raise exception 'merchant_id is required';
  end if;
  if p_since is null then
    raise exception 'since is required';
  end if;

  if not (
    public.is_service_role_request()
    or public.is_internal_admin()
    or public.is_merchant_owner(target_merchant_id)
  ) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  -- An empty allowlist is zero rows by construction — never a full sweep.
  return query
  select pe.event_name, count(*)::bigint as event_count
  from public.product_events pe
  where pe.merchant_id = target_merchant_id
    and pe.created_at >= p_since
    and pe.event_name = any(coalesce(p_event_names, array[]::text[]))
  group by pe.event_name;
end;
$$;

revoke all on function public.get_merchant_dashboard_series(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_merchant_activity_event_counts(uuid, timestamptz, text[]) from public, anon, authenticated;
grant execute on function public.get_merchant_dashboard_series(uuid, integer) to service_role;
grant execute on function public.get_merchant_activity_event_counts(uuid, timestamptz, text[]) to service_role;
