create index if not exists product_events_merchant_event_created_at_idx
  on public.product_events (merchant_id, event_name, created_at desc);

create index if not exists product_events_customer_event_created_at_idx
  on public.product_events (customer_id, event_name, created_at desc);

create index if not exists reward_events_membership_status_created_at_idx
  on public.reward_events (membership_id, status, created_at desc);

create index if not exists stamp_events_merchant_earned_created_at_idx
  on public.stamp_events (merchant_id, created_at desc)
  where event_type = 'earned';

create index if not exists reward_events_merchant_redeemed_created_at_idx
  on public.reward_events (merchant_id, created_at desc)
  where status = 'redeemed';

create or replace function public.get_merchant_dashboard_metrics(
  target_merchant_id uuid
)
returns table (
  members bigint,
  new_members bigint,
  stamps_issued bigint,
  repeat_customers bigint,
  rewards_redeemed bigint,
  qr_downloads bigint,
  billing_status text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
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

  return query
  select
    (
      select count(*)
      from public.customer_memberships
      where merchant_id = target_merchant_id
    )::bigint as members,
    (
      select count(*)
      from public.customer_memberships
      where merchant_id = target_merchant_id
        and created_at >= now() - interval '7 days'
    )::bigint as new_members,
    (
      select count(*)
      from public.stamp_events
      where merchant_id = target_merchant_id
        and event_type = 'earned'
    )::bigint as stamps_issued,
    (
      select count(*)
      from public.customer_memberships
      where merchant_id = target_merchant_id
        and total_stamps_earned > 1
    )::bigint as repeat_customers,
    (
      select count(*)
      from public.reward_events
      where merchant_id = target_merchant_id
        and status = 'redeemed'
    )::bigint as rewards_redeemed,
    (
      select count(*)
      from public.product_events
      where merchant_id = target_merchant_id
        and event_name = 'qr_downloaded'
    )::bigint as qr_downloads,
    coalesce(
      (
        select billing_customers.status
        from public.billing_customers
        where merchant_id = target_merchant_id
        limit 1
      ),
      (
        select merchants.status
        from public.merchants
        where id = target_merchant_id
        limit 1
      )
    ) as billing_status;
end;
$$;

create or replace function public.get_product_event_counts(
  target_event_names text[] default null
)
returns table (
  event_name text,
  event_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not (
    public.is_service_role_request()
    or public.is_internal_admin()
  ) then
    raise insufficient_privilege using message = 'Admin access required';
  end if;

  return query
  select
    product_events.event_name,
    count(*)::bigint as event_count
  from public.product_events
  where target_event_names is null
    or product_events.event_name = any(target_event_names)
  group by product_events.event_name;
end;
$$;

grant execute on function public.get_merchant_dashboard_metrics(uuid) to service_role;
grant execute on function public.get_product_event_counts(text[]) to service_role;

revoke execute on function public.get_merchant_dashboard_metrics(uuid) from anon, authenticated;
revoke execute on function public.get_product_event_counts(text[]) from anon, authenticated;
