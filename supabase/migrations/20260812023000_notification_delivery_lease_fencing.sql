-- Fence every notification state/ledger write to the live claim that owns it.
-- This prevents stale workers from settling a row after a lease reclaim. The
-- successful-delivery index is a database anchor, not an external exactly-once
-- guarantee: Web Push does not expose an idempotency key for provider sends.

alter table public.notification_events
  add column if not exists lease_token uuid;

-- Rows claimed by the pre-token worker cannot prove ownership. Return them to
-- the queue once; only token-bearing claims can settle after this migration.
update public.notification_events
set status = 'queued', claimed_at = null, lease_expires_at = null,
    lease_token = null
where status = 'delivering' and lease_token is null;

create unique index if not exists notification_deliveries_one_sent_per_subscription_idx
  on public.notification_deliveries (
    notification_event_id,
    push_subscription_id
  )
  where status = 'sent' and push_subscription_id is not null;

drop function if exists public.claim_due_notification_events(timestamptz, integer);

create function public.claim_due_notification_events(
  p_now timestamptz default now(),
  p_limit integer default 50
)
returns table (
  id uuid,
  event_type text,
  category text,
  customer_id uuid,
  merchant_id uuid,
  membership_id uuid,
  reward_event_id uuid,
  payload jsonb,
  metadata jsonb,
  due_at timestamptz,
  lease_token uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_now timestamptz := coalesce(p_now, now());
  v_lease interval := interval '5 minutes';
begin
  return query
  with picked as (
    select events.id
    from public.notification_events events
    where (
        (events.status = 'queued' and events.due_at <= v_now)
        or (events.status = 'delivering'
          and events.lease_expires_at is not null
          and events.lease_expires_at <= v_now)
      )
    order by events.due_at asc, events.created_at asc
    limit v_limit
    for update skip locked
  ),
  claimed as (
    update public.notification_events events
    set status = 'delivering',
        claimed_at = v_now,
        lease_expires_at = v_now + v_lease,
        lease_token = extensions.gen_random_uuid()
    from picked
    where events.id = picked.id
    returning
      events.id,
      events.event_type,
      events.category,
      events.customer_id,
      events.merchant_id,
      events.membership_id,
      events.reward_event_id,
      events.payload,
      events.metadata,
      events.due_at,
      events.lease_token
  )
  select
    claimed.id,
    claimed.event_type,
    claimed.category,
    claimed.customer_id,
    claimed.merchant_id,
    claimed.membership_id,
    claimed.reward_event_id,
    claimed.payload,
    claimed.metadata,
    claimed.due_at,
    claimed.lease_token
  from claimed
  order by claimed.due_at asc;
end;
$$;

revoke execute on function public.claim_due_notification_events(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_notification_events(timestamptz, integer)
  to service_role;

create or replace function public.settle_notification_event(
  p_notification_event_id uuid,
  p_lease_token uuid,
  p_status text,
  p_due_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('queued', 'sent', 'failed', 'cancelled') then
    raise exception 'Unsupported notification settlement status';
  end if;

  update public.notification_events events
  set status = p_status,
      due_at = case
        when p_status = 'queued' then coalesce(p_due_at, events.due_at)
        else events.due_at
      end,
      sent_at = case when p_status = 'sent' then transaction_timestamp() else events.sent_at end,
      cancelled_at = case when p_status = 'cancelled' then transaction_timestamp() else events.cancelled_at end,
      claimed_at = null,
      lease_expires_at = null,
      lease_token = null
  where events.id = p_notification_event_id
    and events.status = 'delivering'
    and events.lease_token = p_lease_token
    and events.lease_expires_at > transaction_timestamp();

  return found;
end;
$$;

revoke execute on function public.settle_notification_event(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.settle_notification_event(uuid, uuid, text, timestamptz)
  to service_role;

drop function if exists public.record_notification_delivery(
  uuid, uuid, uuid, text, integer, integer, text, jsonb
);

create function public.record_notification_delivery(
  p_notification_event_id uuid,
  p_push_subscription_id uuid,
  p_customer_id uuid,
  p_lease_token uuid,
  p_status text,
  p_attempt_number integer default 1,
  p_response_status integer default null,
  p_failure_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_event public.notification_events%rowtype;
  v_delivery_id uuid;
begin
  select events.* into v_event
  from public.notification_events events
  where events.id = p_notification_event_id
  for update;

  if not found
    or v_event.customer_id <> p_customer_id
    or v_event.status <> 'delivering'
    or v_event.lease_token is distinct from p_lease_token
    or v_event.lease_expires_at is null
    or v_event.lease_expires_at <= transaction_timestamp() then
    return null;
  end if;

  insert into public.notification_deliveries (
    notification_event_id,
    push_subscription_id,
    customer_id,
    status,
    attempt_number,
    response_status,
    failure_reason,
    sent_at,
    metadata
  )
  values (
    p_notification_event_id,
    p_push_subscription_id,
    p_customer_id,
    p_status,
    greatest(coalesce(p_attempt_number, 1), 1),
    p_response_status,
    p_failure_reason,
    case when p_status = 'sent' then transaction_timestamp() else null end,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (notification_event_id, push_subscription_id)
    where status = 'sent' and push_subscription_id is not null
    do nothing
  returning id into v_delivery_id;

  if v_delivery_id is null and p_status = 'sent' then
    select deliveries.id into v_delivery_id
    from public.notification_deliveries deliveries
    where deliveries.notification_event_id = p_notification_event_id
      and deliveries.push_subscription_id = p_push_subscription_id
      and deliveries.status = 'sent';
  end if;

  return v_delivery_id;
end;
$$;

revoke execute on function public.record_notification_delivery(
  uuid, uuid, uuid, uuid, text, integer, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_notification_delivery(
  uuid, uuid, uuid, uuid, text, integer, integer, text, jsonb
) to service_role;
