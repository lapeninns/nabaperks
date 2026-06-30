create or replace function public.claim_due_notification_events(
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
  due_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
begin
  return query
  with picked as (
    select notification_events.id
    from public.notification_events
    where notification_events.status = 'queued'
      and notification_events.due_at <= coalesce(p_now, now())
    order by notification_events.due_at asc, notification_events.created_at asc
    limit v_limit
    for update skip locked
  ),
  claimed as (
    update public.notification_events
    set status = 'delivering'
    from picked
    where notification_events.id = picked.id
    returning
      notification_events.id,
      notification_events.event_type,
      notification_events.category,
      notification_events.customer_id,
      notification_events.merchant_id,
      notification_events.membership_id,
      notification_events.reward_event_id,
      notification_events.payload,
      notification_events.metadata,
      notification_events.due_at
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
    claimed.due_at
  from claimed
  order by claimed.due_at asc;
end;
$$;

grant execute on function public.claim_due_notification_events(timestamptz, integer) to service_role;
