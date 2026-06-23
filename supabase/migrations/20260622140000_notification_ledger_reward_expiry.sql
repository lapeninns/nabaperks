alter table public.loyalty_cards
  add column if not exists reward_expires_after_days integer
    check (reward_expires_after_days is null or reward_expires_after_days between 1 and 3660);

alter table public.reward_pool_items
  add column if not exists reward_expires_after_days integer
    check (reward_expires_after_days is null or reward_expires_after_days between 1 and 3660);

alter table public.reward_events
  add column if not exists expires_at timestamptz,
  add column if not exists expired_at timestamptz;

create index if not exists reward_events_expiry_status_idx
  on public.reward_events (expires_at, status)
  where expires_at is not null and status = 'unlocked';

create or replace function public.notification_event_category(p_event_type text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  case p_event_type
    when
      'push_permission_prompt_viewed',
      'push_permission_granted',
      'push_subscription_created',
      'push_subscription_disabled',
      'push_subscription_failed'
    then
      return 'operational';
    when
      'one_stamp_away',
      'reward_unlocked_waiting',
      'reward_ready',
      'profile_required_to_collect',
      'reward_collected_cycle_started'
    then
      return 'transactional';
    when
      'next_stamp_available',
      'reward_expiring_soon',
      'reward_expired'
    then
      return 'reminder';
    when
      'dormant_progress',
      'venue_announcement'
    then
      return 'marketing';
    else
      raise exception 'Unsupported notification event type: %', p_event_type;
  end case;
end;
$$;

create table if not exists public.notification_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null
    check (event_type in (
      'push_permission_prompt_viewed',
      'push_permission_granted',
      'push_subscription_created',
      'push_subscription_disabled',
      'push_subscription_failed',
      'one_stamp_away',
      'next_stamp_available',
      'reward_unlocked_waiting',
      'reward_ready',
      'profile_required_to_collect',
      'reward_expiring_soon',
      'reward_expired',
      'reward_collected_cycle_started',
      'dormant_progress',
      'venue_announcement'
    )),
  category text not null
    check (category in ('transactional', 'reminder', 'marketing', 'operational')),
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid references public.merchants(id) on delete cascade,
  membership_id uuid references public.customer_memberships(id) on delete cascade,
  reward_event_id uuid references public.reward_events(id) on delete cascade,
  cycle_number integer,
  business_date date,
  due_at timestamptz not null default now(),
  dedupe_key text not null,
  status text not null default 'queued'
    check (status in ('queued', 'delivering', 'sent', 'failed', 'cancelled', 'expired')),
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_events_dedupe_key_idx
  on public.notification_events (dedupe_key);
create index if not exists notification_events_due_status_idx
  on public.notification_events (status, due_at);
create index if not exists notification_events_customer_created_idx
  on public.notification_events (customer_id, created_at desc);
create index if not exists notification_events_reward_type_idx
  on public.notification_events (reward_event_id, event_type)
  where reward_event_id is not null;

create table if not exists public.notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_event_id uuid not null references public.notification_events(id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null
    check (status in ('sent', 'retryable_failure', 'permanent_failure', 'skipped')),
  attempt_number integer not null default 1 check (attempt_number > 0),
  response_status integer,
  failure_reason text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_event_created_idx
  on public.notification_deliveries (notification_event_id, created_at desc);
create index if not exists notification_deliveries_subscription_created_idx
  on public.notification_deliveries (push_subscription_id, created_at desc)
  where push_subscription_id is not null;
create index if not exists notification_deliveries_customer_created_idx
  on public.notification_deliveries (customer_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'notification_events_set_updated_at'
  ) then
    create trigger notification_events_set_updated_at
      before update on public.notification_events
      for each row execute function public.set_updated_at();
  end if;
end $$;

create or replace function public.prevent_notification_delivery_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Notification delivery attempts are append-only';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'notification_deliveries_append_only'
  ) then
    create trigger notification_deliveries_append_only
      before update or delete on public.notification_deliveries
      for each row execute function public.prevent_notification_delivery_mutation();
  end if;
end $$;

alter table public.notification_events enable row level security;
alter table public.notification_events force row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force row level security;

drop policy if exists notification_events_select_customer_or_admin on public.notification_events;
create policy notification_events_select_customer_or_admin
  on public.notification_events for select to authenticated
  using (
    public.is_customer_owner(customer_id)
    or public.is_internal_admin()
    or (
      merchant_id is not null
      and public.merchant_can_access_customer(merchant_id, customer_id)
    )
  );

drop policy if exists notification_events_service_role_all on public.notification_events;
create policy notification_events_service_role_all
  on public.notification_events for all to service_role
  using (true)
  with check (true);

drop policy if exists notification_deliveries_select_customer_or_admin on public.notification_deliveries;
create policy notification_deliveries_select_customer_or_admin
  on public.notification_deliveries for select to authenticated
  using (
    public.is_customer_owner(customer_id)
    or public.is_internal_admin()
  );

drop policy if exists notification_deliveries_service_role_all on public.notification_deliveries;
create policy notification_deliveries_service_role_all
  on public.notification_deliveries for all to service_role
  using (true)
  with check (true);

revoke all on table public.notification_events from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
grant select on table public.notification_events to authenticated;
grant select on table public.notification_deliveries to authenticated;
grant select, insert, update, delete on table public.notification_events to service_role;
grant select, insert, update, delete on table public.notification_deliveries to service_role;

create or replace function public.build_notification_dedupe_key(
  p_event_type text,
  p_customer_id uuid,
  p_membership_id uuid default null,
  p_reward_event_id uuid default null,
  p_cycle_number integer default null,
  p_business_date date default null,
  p_due_at timestamptz default now()
)
returns text
language sql
stable
set search_path = public
as $$
  select concat_ws(
    ':',
    p_event_type,
    p_customer_id::text,
    coalesce(p_membership_id::text, 'no-membership'),
    coalesce(p_reward_event_id::text, 'no-reward'),
    coalesce(p_cycle_number::text, 'no-cycle'),
    coalesce(p_business_date::text, 'no-business-date'),
    date_trunc('hour', coalesce(p_due_at, now()))::text
  );
$$;

create or replace function public.enqueue_notification_event(
  p_event_type text,
  p_customer_id uuid,
  p_merchant_id uuid default null,
  p_membership_id uuid default null,
  p_reward_event_id uuid default null,
  p_cycle_number integer default null,
  p_business_date date default null,
  p_due_at timestamptz default now(),
  p_dedupe_key text default null,
  p_payload jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_event_id uuid;
  v_category text := public.notification_event_category(p_event_type);
  v_dedupe_key text := coalesce(
    nullif(trim(p_dedupe_key), ''),
    public.build_notification_dedupe_key(
      p_event_type,
      p_customer_id,
      p_membership_id,
      p_reward_event_id,
      p_cycle_number,
      p_business_date,
      p_due_at
    )
  );
begin
  if p_customer_id is null then
    raise exception 'Customer is required for notification events';
  end if;

  insert into public.notification_events (
    event_type,
    category,
    customer_id,
    merchant_id,
    membership_id,
    reward_event_id,
    cycle_number,
    business_date,
    due_at,
    dedupe_key,
    payload,
    metadata
  )
  values (
    p_event_type,
    v_category,
    p_customer_id,
    p_merchant_id,
    p_membership_id,
    p_reward_event_id,
    p_cycle_number,
    p_business_date,
    coalesce(p_due_at, now()),
    v_dedupe_key,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (dedupe_key) do update
    set updated_at = public.notification_events.updated_at
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.record_notification_delivery(
  p_notification_event_id uuid,
  p_push_subscription_id uuid,
  p_customer_id uuid,
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
  v_delivery_id uuid;
begin
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
    case when p_status = 'sent' then now() else null end,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_delivery_id;

  return v_delivery_id;
end;
$$;

create or replace function public.resolve_reward_event_expires_at(
  p_loyalty_card_id uuid,
  p_reward_pool_item_id uuid default null,
  p_assigned_at timestamptz default now()
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_expires_after_days integer;
begin
  select coalesce(reward_pool_items.reward_expires_after_days, loyalty_cards.reward_expires_after_days)
  into v_expires_after_days
  from public.loyalty_cards
  left join public.reward_pool_items
    on reward_pool_items.id = p_reward_pool_item_id
  where loyalty_cards.id = p_loyalty_card_id;

  if v_expires_after_days is null then
    return null;
  end if;

  return coalesce(p_assigned_at, now()) + make_interval(days => v_expires_after_days);
end;
$$;

create or replace function public.set_reward_event_expiry_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.expires_at is null then
    new.expires_at := public.resolve_reward_event_expires_at(
      new.loyalty_card_id,
      new.reward_pool_item_id,
      coalesce(new.created_at, now())
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'reward_events_set_expiry_snapshot'
  ) then
    create trigger reward_events_set_expiry_snapshot
      before insert on public.reward_events
      for each row execute function public.set_reward_event_expiry_snapshot();
  end if;
end $$;

create or replace function public.prevent_expired_reward_redemption()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'redeemed'
    and old.status <> 'redeemed'
    and coalesce(new.expires_at, old.expires_at) is not null
    and coalesce(new.expires_at, old.expires_at) <= now() then
    raise exception 'Reward has expired';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'reward_events_prevent_expired_redemption'
  ) then
    create trigger reward_events_prevent_expired_redemption
      before update on public.reward_events
      for each row execute function public.prevent_expired_reward_redemption();
  end if;
end $$;

create or replace function public.prevent_expired_reward_scan_token()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_expires_at timestamptz;
begin
  select reward_events.expires_at
  into v_expires_at
  from public.reward_events
  where reward_events.id = new.reward_event_id;

  if v_expires_at is not null and v_expires_at <= now() then
    raise exception 'Reward has expired';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'reward_scan_tokens_prevent_expired_reward'
  ) then
    create trigger reward_scan_tokens_prevent_expired_reward
      before insert on public.reward_scan_tokens
      for each row execute function public.prevent_expired_reward_scan_token();
  end if;
end $$;

create or replace function public.expire_due_reward_events(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  expired_reward record;
  v_count integer := 0;
begin
  for expired_reward in
    update public.reward_events
    set
      status = 'expired',
      expired_at = coalesce(expired_at, p_now),
      metadata = reward_events.metadata || jsonb_build_object(
        'expired_by', 'scheduled_notification_worker'
      )
    where reward_events.status = 'unlocked'
      and reward_events.expires_at is not null
      and reward_events.expires_at <= p_now
    returning
      id,
      merchant_id,
      customer_id,
      membership_id,
      cycle_number,
      expires_at,
      reward_name
  loop
    v_count := v_count + 1;

    perform public.enqueue_notification_event(
      'reward_expired',
      expired_reward.customer_id,
      expired_reward.merchant_id,
      expired_reward.membership_id,
      expired_reward.id,
      expired_reward.cycle_number,
      public.uk_business_date(expired_reward.expires_at),
      p_now,
      'reward_expired:' || expired_reward.id::text,
      jsonb_build_object(
        'title', 'Reward expired',
        'body', expired_reward.reward_name,
        'url', '/home/rewards',
        'rewardEventId', expired_reward.id
      ),
      jsonb_build_object('source', 'reward_expiry')
    );
  end loop;

  return v_count;
end;
$$;

create or replace function public.collect_reward_scan_token(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  token_record record;
  redeem_record record;
  merchant_record record;
begin
  select *
  into token_record
  from public.reward_scan_tokens
  where id = p_scan_token
  for update;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;

  if token_record.merchant_id <> p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;

  if token_record.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;

  select
    redeemed.reward_event_id,
    redeemed.reward_name,
    redeemed.membership_id,
    redeemed.new_stamp_count
  into redeem_record
  from public.redeem_self_service_reward(
    token_record.reward_event_id,
    token_record.customer_id,
    null,
    null
  ) redeemed;

  update public.reward_scan_tokens
  set
    consumed_at = now(),
    consumed_by_merchant_id = p_merchant_id
  where id = p_scan_token
    and consumed_at is null;

  select merchants.business_name
  into merchant_record
  from public.merchants
  where merchants.id = p_merchant_id;

  perform public.enqueue_notification_event(
    'reward_collected_cycle_started',
    token_record.customer_id,
    p_merchant_id,
    redeem_record.membership_id,
    redeem_record.reward_event_id,
    null,
    public.uk_business_date(now()),
    now(),
    'reward_collected_cycle_started:' || redeem_record.reward_event_id::text,
    jsonb_build_object(
      'title', 'Reward collected',
      'body', 'A new ' || coalesce(merchant_record.business_name, 'venue') || ' stamp cycle has started.',
      'url', '/card/' || redeem_record.membership_id::text,
      'rewardEventId', redeem_record.reward_event_id,
      'membershipId', redeem_record.membership_id
    ),
    jsonb_build_object(
      'source', 'collect_reward_scan_token',
      'scan_token_expiry_separate', true
    )
  );

  reward_event_id := redeem_record.reward_event_id;
  reward_name := redeem_record.reward_name;
  membership_id := redeem_record.membership_id;
  new_stamp_count := redeem_record.new_stamp_count;
  return next;
end;
$$;

grant execute on function public.notification_event_category(text) to authenticated, service_role;
grant execute on function public.build_notification_dedupe_key(text, uuid, uuid, uuid, integer, date, timestamptz) to authenticated, service_role;
grant execute on function public.enqueue_notification_event(text, uuid, uuid, uuid, uuid, integer, date, timestamptz, text, jsonb, jsonb) to service_role;
grant execute on function public.record_notification_delivery(uuid, uuid, uuid, text, integer, integer, text, jsonb) to service_role;
grant execute on function public.resolve_reward_event_expires_at(uuid, uuid, timestamptz) to service_role;
grant execute on function public.expire_due_reward_events(timestamptz) to service_role;
grant execute on function public.collect_reward_scan_token(uuid, uuid) to service_role;

revoke execute on function public.enqueue_notification_event(text, uuid, uuid, uuid, uuid, integer, date, timestamptz, text, jsonb, jsonb) from anon, authenticated;
revoke execute on function public.record_notification_delivery(uuid, uuid, uuid, text, integer, integer, text, jsonb) from anon, authenticated;
revoke execute on function public.expire_due_reward_events(timestamptz) from anon, authenticated;
revoke execute on function public.collect_reward_scan_token(uuid, uuid) from anon, authenticated;
