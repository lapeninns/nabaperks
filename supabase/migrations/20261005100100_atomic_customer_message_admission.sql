-- Make customer-message delivery admission and budget consumption one atomic operation.
--
-- WHAT CHANGES
--   1. Adds a service-only admission RPC that locks and deduplicates the event
--      before consuming its canonical merchant/category dispatch budget.
--   2. Returns no delivery identifier when the budget refuses the attempt, so
--      the worker can retry without a pending delivery fence.
--   3. Rolls back budget mutations when the delivery insert conflicts.
--
-- Forward-only and re-runnable. Existing delivery and budget RPCs remain for
-- compatibility with the deployed application during rollout.

create or replace function public.admit_notification_message_delivery(
  p_notification_event_id uuid, p_customer_id uuid, p_channel text,
  p_attempt_number integer default 1, p_recipient_last4 text default null
) returns uuid language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare
  v_event public.notification_events%rowtype;
  v_id uuid;
begin
  if p_channel is null or p_channel not in ('whatsapp', 'sms') then
    raise exception 'Invalid phone channel';
  end if;

  perform 1
  from public.customers
  where id = p_customer_id and phone_hmac is not null
  for update;
  if not found then
    raise exception 'Customer phone identity required';
  end if;

  select * into v_event
  from public.notification_events
  where id = p_notification_event_id and customer_id = p_customer_id
  for update;
  if not found then
    raise exception 'Notification customer mismatch';
  end if;

  if exists (
    select 1
    from public.notification_deliveries
    where notification_event_id = p_notification_event_id
      and channel = p_channel
      and status in ('pending', 'sent')
  ) then
    raise exception using
      errcode = 'NBM01',
      message = 'Phone delivery already admitted';
  end if;

  if v_event.merchant_id is null then
    return null;
  end if;
  if not public.admit_customer_message_dispatch(
    v_event.merchant_id,
    public.notification_event_category(v_event.event_type)
  ) then
    return null;
  end if;

  insert into public.notification_deliveries (
    notification_event_id,
    customer_id,
    channel,
    status,
    attempt_number,
    recipient_last4,
    provider_attempted_at
  ) values (
    p_notification_event_id,
    p_customer_id,
    p_channel,
    'pending',
    greatest(coalesce(p_attempt_number, 1), 1),
    p_recipient_last4,
    now()
  )
  returning id into v_id;

  return v_id;
exception when unique_violation then
  raise exception using
    errcode = 'NBM01',
    message = 'Phone delivery already admitted';
end;
$$;

revoke all on function public.admit_notification_message_delivery(uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.admit_notification_message_delivery(uuid, uuid, text, integer, text)
  to service_role;

notify pgrst, 'reload schema';
