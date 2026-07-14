-- analytics merchant activation ledger
--
-- Durable, privacy-bounded merchant activation milestones and one-row cohort
-- reporting. This migration is replay-safe so it can be proved against a
-- disposable local database without rebuilding the database.

alter table public.product_events
  add column if not exists occurred_at timestamptz,
  add column if not exists idempotency_key text;

update public.product_events
set occurred_at = created_at
where occurred_at is null;

alter table public.product_events
  alter column occurred_at set default now(),
  alter column occurred_at set not null;

-- Billing activation is a product fact, not an analytics-delivery fact. Keep
-- the first authoritative transition into trialing/active on the durable
-- billing row so an after-response crash cannot erase the cohort milestone.
alter table public.billing_customers
  add column if not exists activated_at timestamptz;

create or replace function public.preserve_billing_activation_timestamp()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_candidate timestamptz;
begin
  if tg_op = 'UPDATE' and old.activated_at is not null then
    new.activated_at := old.activated_at;
    return new;
  end if;

  new.activated_at := null;
  if new.status not in ('trialing', 'active') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A webhook insert owns an exact provider-event boundary. Exact
    -- Checkout/Portal reconciliation has no event cursor, so the durable
    -- transaction is the earliest trustworthy activation boundary. The
    -- subscription may have been created earlier in an incomplete state.
    v_candidate := coalesce(
      new.stripe_state_event_created_at,
      transaction_timestamp()
    );
  elsif old.status in ('trialing', 'active') then
    -- Backfill a legacy already-active row from its durable provider identity.
    v_candidate := coalesce(
      old.stripe_subscription_created_at,
      new.stripe_subscription_created_at,
      old.created_at,
      transaction_timestamp()
    );
  elsif new.stripe_state_event_created_at is distinct from old.stripe_state_event_created_at then
    -- Webhook apply owns an exact provider-event timestamp.
    v_candidate := coalesce(
      new.stripe_state_event_created_at,
      transaction_timestamp()
    );
  else
    -- Exact Checkout/Portal reconciliation has no provider-event cursor; the
    -- durable apply transaction itself is the earliest trustworthy boundary.
    v_candidate := transaction_timestamp();
  end if;

  new.activated_at := least(v_candidate, transaction_timestamp());
  return new;
end;
$function$;

revoke all on function public.preserve_billing_activation_timestamp()
  from public, anon, authenticated, service_role;

drop trigger if exists billing_customers_preserve_activation_timestamp
  on public.billing_customers;
create trigger billing_customers_preserve_activation_timestamp
  before insert or update of
    status,
    stripe_subscription_status,
    stripe_subscription_created_at,
    stripe_state_event_created_at,
    activated_at
  on public.billing_customers
  for each row
  execute function public.preserve_billing_activation_timestamp();

update public.billing_customers
set activated_at = coalesce(
      stripe_subscription_created_at,
      created_at,
      transaction_timestamp()
    )
where activated_at is null
  and status in ('trialing', 'active');

do $activation_billing_schema$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.billing_customers'::regclass
      and conname = 'billing_customers_activation_coherent'
  ) then
    alter table public.billing_customers
      add constraint billing_customers_activation_coherent
      check (activated_at is null or stripe_subscription_id is not null);
  end if;
end
$activation_billing_schema$;

do $activation_schema$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.product_events'::regclass
      and conname = 'product_events_idempotency_key_valid'
  ) then
    alter table public.product_events
      add constraint product_events_idempotency_key_valid
      check (
        idempotency_key is null
        or idempotency_key ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'
      );
  end if;
end
$activation_schema$;

create unique index if not exists product_events_activation_idempotency_idx
  on public.product_events (merchant_id, event_name, idempotency_key)
  where merchant_id is not null
    and idempotency_key is not null;

create index if not exists product_events_activation_cohort_idx
  on public.product_events (event_name, occurred_at, actor_id)
  where event_name in (
    'merchant_account_created',
    'merchant_email_verified'
  );

create index if not exists product_events_activation_merchant_idx
  on public.product_events (merchant_id, event_name, occurred_at)
  where merchant_id is not null;

create table if not exists public.merchant_funnel_links (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  funnel_key text not null unique
    check (funnel_key ~ '^[0-9a-f]{64}$'),
  linked_at timestamptz not null default now()
);

alter table public.merchant_funnel_links enable row level security;
alter table public.merchant_funnel_links force row level security;

revoke all on table public.merchant_funnel_links
  from public, anon, authenticated;
grant select, insert, update, delete on table public.merchant_funnel_links
  to service_role;

create or replace function public.capture_merchant_funnel_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_owner_user_id uuid;
  v_funnel_key text;
begin
  if new.event_name not in (
    'merchant_account_created',
    'merchant_email_verified'
  ) then
    return new;
  end if;

  if new.actor_id is null
    or new.actor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;

  v_funnel_key := new.metadata ->> 'funnel_key';
  if v_funnel_key is null
    or v_funnel_key !~ '^[0-9a-f]{64}$' then
    return new;
  end if;

  begin
    v_owner_user_id := new.actor_id::uuid;
  exception
    when invalid_text_representation then
      return new;
  end;

  insert into public.merchant_funnel_links (
    owner_user_id,
    funnel_key,
    linked_at
  )
  select
    v_owner_user_id,
    v_funnel_key,
    coalesce(new.occurred_at, new.created_at, now())
  where exists (
    select 1
    from auth.users
    where users.id = v_owner_user_id
  )
  on conflict do nothing;

  return new;
end;
$function$;

revoke all on function public.capture_merchant_funnel_link()
  from public, anon, authenticated, service_role;

drop trigger if exists product_events_capture_merchant_funnel_link
  on public.product_events;
create trigger product_events_capture_merchant_funnel_link
  after insert on public.product_events
  for each row
  execute function public.capture_merchant_funnel_link();

-- Backfill in receipt order. ON CONFLICT DO NOTHING gives both sides of the
-- one-to-one link a first-valid-value-wins contract.
insert into public.merchant_funnel_links (
  owner_user_id,
  funnel_key,
  linked_at
)
select
  events.actor_id::uuid,
  events.metadata ->> 'funnel_key',
  events.occurred_at
from public.product_events as events
where events.event_name in (
    'merchant_account_created',
    'merchant_email_verified'
  )
  and events.actor_id is not null
  and events.actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and events.metadata ->> 'funnel_key' ~ '^[0-9a-f]{64}$'
  and exists (
    select 1
    from auth.users
    where users.id = events.actor_id::uuid
  )
order by events.occurred_at, events.created_at, events.id
on conflict do nothing;

create or replace function public.record_merchant_activation_event(
  p_merchant_id uuid,
  p_event_name text,
  p_idempotency_key text,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_owner_user_id uuid;
  v_event_id uuid;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using
      message = 'Service role required for merchant activation events';
  end if;

  if p_merchant_id is null then
    raise invalid_parameter_value using message = 'Merchant is required';
  end if;

  select merchants.owner_user_id
  into v_owner_user_id
  from public.merchants
  where merchants.id = p_merchant_id;

  if v_owner_user_id is null then
    raise invalid_parameter_value using message = 'Invalid merchant';
  end if;

  if p_event_name is null or p_event_name not in (
    'merchant_launch_entered',
    'qr_poster_emailed',
    'merchant_billing_reached',
    'merchant_billing_checkout_started',
    'merchant_billing_checkout_returned',
    'merchant_billing_activated'
  ) then
    raise invalid_parameter_value using
      message = 'Activation event is not allowed';
  end if;

  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{0,127}$' then
    raise invalid_parameter_value using
      message = 'Invalid activation idempotency key';
  end if;

  if p_occurred_at is null
    or p_occurred_at < now() - interval '366 days'
    or p_occurred_at > now() + interval '5 minutes' then
    raise invalid_parameter_value using
      message = 'Invalid or future activation occurrence timestamp';
  end if;

  if p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.octet_length(p_metadata::text) > 2048
    or exists (
      select 1 from jsonb_object_keys(p_metadata) as keys(key)
      where keys.key <> 'source'
    )
    or (
      p_metadata ? 'source'
      and (
        jsonb_typeof(p_metadata -> 'source') <> 'string'
        or p_metadata ->> 'source' not in (
          'merchant_launch',
          'merchant_qr_action',
          'merchant_billing',
          'stripe_checkout',
          'stripe_webhook'
        )
      )
    ) then
    raise invalid_parameter_value using
      message = 'Invalid activation metadata';
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata,
    occurred_at,
    idempotency_key
  )
  values (
    p_event_name,
    p_merchant_id,
    'merchant',
    v_owner_user_id::text,
    p_metadata,
    p_occurred_at,
    p_idempotency_key
  )
  on conflict (merchant_id, event_name, idempotency_key)
    where merchant_id is not null
      and idempotency_key is not null
    do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select events.id
    into v_event_id
    from public.product_events as events
    where events.merchant_id = p_merchant_id
      and events.event_name = p_event_name
      and events.idempotency_key = p_idempotency_key;
  end if;

  if v_event_id is null then
    raise exception 'Activation event could not be recorded';
  end if;

  return v_event_id;
end;
$function$;

create or replace function public.get_merchant_activation_cohort_facts(
  p_cohort_start timestamptz,
  p_cohort_end timestamptz,
  p_as_of timestamptz
)
returns table (
  account_created bigint,
  email_verified bigint,
  onboarding_complete bigint,
  launch_entered bigint,
  venue_ready bigint,
  card_ready bigint,
  rewards_ready bigint,
  qr_ready bigint,
  poster_ready bigint,
  billing_reached bigint,
  billing_activated bigint,
  first_customer_stamped bigint,
  first_stamp_7d_yes bigint,
  first_stamp_7d_no bigint,
  first_stamp_7d_pending bigint,
  median_signup_to_poster_seconds numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using
      message = 'Service role required for merchant activation cohort facts';
  end if;

  if p_cohort_start is null
    or p_cohort_end is null
    or p_as_of is null
    or p_cohort_start >= p_cohort_end
    or p_cohort_end - p_cohort_start > interval '366 days' then
    raise invalid_parameter_value using
      message = 'Invalid or unbounded activation cohort window';
  end if;

  return query
  with raw_account_events as (
    select
      events.actor_id::uuid as owner_user_id,
      events.occurred_at
    from public.product_events as events
    where events.event_name = 'merchant_account_created'
      and events.actor_id is not null
      and events.actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and events.occurred_at >= p_cohort_start
      and events.occurred_at < p_cohort_end
      and events.occurred_at <= p_as_of
  ),
  anchors as (
    select
      raw_account_events.owner_user_id,
      min(raw_account_events.occurred_at) as account_created_at
    from raw_account_events
    group by raw_account_events.owner_user_id
  ),
  merchant_accounts as (
    select
      anchors.owner_user_id,
      anchors.account_created_at,
      merchants.id as merchant_id,
      merchants.created_at as onboarding_completed_at
    from anchors
    left join public.merchants
      on merchants.owner_user_id = anchors.owner_user_id
     and merchants.created_at <= p_as_of
  ),
  journey as (
    select
      accounts.owner_user_id,
      accounts.account_created_at,
      accounts.merchant_id,
      accounts.onboarding_completed_at,
      email.email_verified_at,
      launch.launch_entered_at,
      venue.venue_ready_at,
      card.card_id,
      card.card_ready_at,
      rewards.rewards_ready_at,
      qr.qr_ready_at,
      poster.poster_ready_at,
      billing_reached.billing_reached_at,
      billing_activated.billing_activated_at,
      first_stamp.first_stamp_at
    from merchant_accounts as accounts
    left join lateral (
      select min(events.occurred_at) as email_verified_at
      from public.product_events as events
      where events.event_name = 'merchant_email_verified'
        and events.actor_id = accounts.owner_user_id::text
        and events.occurred_at <= p_as_of
    ) as email on true
    left join lateral (
      select min(events.occurred_at) as launch_entered_at
      from public.product_events as events
      where events.event_name = 'merchant_launch_entered'
        and events.merchant_id = accounts.merchant_id
        and events.occurred_at <= p_as_of
    ) as launch on true
    left join lateral (
      select min(locations.created_at) as venue_ready_at
      from public.merchant_locations as locations
      where locations.merchant_id = accounts.merchant_id
        and locations.created_at <= p_as_of
        and nullif(btrim(locations.address), '') is not null
        and (
          not locations.require_geofence
          or (
            locations.latitude is not null
            and locations.longitude is not null
          )
        )
    ) as venue on true
    left join lateral (
      select
        cards.id as card_id,
        cards.created_at as card_ready_at
      from public.loyalty_cards as cards
      where cards.merchant_id = accounts.merchant_id
        and cards.is_active
        and cards.created_at <= p_as_of
      order by cards.created_at, cards.id
      limit 1
    ) as card on true
    left join lateral (
      select max(first_three.created_at) as rewards_ready_at
      from (
        select items.created_at
        from public.reward_pool_items as items
        where items.merchant_id = accounts.merchant_id
          and items.loyalty_card_id = card.card_id
          and items.is_active
          and items.created_at <= p_as_of
        order by items.created_at, items.id
        limit 3
      ) as first_three
      having count(*) = 3
    ) as rewards on true
    left join lateral (
      select min(codes.created_at) as qr_ready_at
      from public.qr_codes as codes
      where codes.merchant_id = accounts.merchant_id
        and codes.loyalty_card_id = card.card_id
        and codes.destination_type = 'join'
        and codes.is_active
        and codes.created_at <= p_as_of
    ) as qr on true
    left join lateral (
      select
        greatest(
          qr.qr_ready_at,
          min(events.occurred_at)
        ) as poster_ready_at
      from public.product_events as events
      where qr.qr_ready_at is not null
        and events.merchant_id = accounts.merchant_id
        and events.event_name in ('qr_downloaded', 'qr_poster_emailed')
        and events.occurred_at <= p_as_of
    ) as poster on true
    left join lateral (
      select min(events.occurred_at) as billing_reached_at
      from public.product_events as events
      where events.merchant_id = accounts.merchant_id
        and events.event_name = 'merchant_billing_reached'
        and events.occurred_at <= p_as_of
    ) as billing_reached on true
    left join lateral (
      select billing.activated_at as billing_activated_at
      from public.billing_customers as billing
      where billing.merchant_id = accounts.merchant_id
        and billing.activated_at is not null
        and billing.activated_at <= p_as_of
      limit 1
    ) as billing_activated on true
    left join lateral (
      select min(stamps.created_at) as first_stamp_at
      from public.stamp_events as stamps
      where stamps.merchant_id = accounts.merchant_id
        and stamps.event_type = 'earned'
        and stamps.stamps_delta > 0
        and stamps.earned_business_date is not null
        and stamps.metadata ->> 'source' = 'self_service_qr'
        and stamps.created_at <= p_as_of
    ) as first_stamp on true
  )
  select
    count(*)::bigint as account_created,
    count(*) filter (
      where journey.email_verified_at is not null
    )::bigint as email_verified,
    count(*) filter (
      where journey.onboarding_completed_at is not null
    )::bigint as onboarding_complete,
    count(*) filter (
      where journey.launch_entered_at is not null
    )::bigint as launch_entered,
    count(*) filter (
      where journey.venue_ready_at is not null
    )::bigint as venue_ready,
    count(*) filter (
      where journey.card_ready_at is not null
    )::bigint as card_ready,
    count(*) filter (
      where journey.rewards_ready_at is not null
    )::bigint as rewards_ready,
    count(*) filter (
      where journey.qr_ready_at is not null
    )::bigint as qr_ready,
    count(*) filter (
      where journey.poster_ready_at is not null
    )::bigint as poster_ready,
    count(*) filter (
      where journey.billing_reached_at is not null
    )::bigint as billing_reached,
    count(*) filter (
      where journey.billing_activated_at is not null
    )::bigint as billing_activated,
    count(*) filter (
      where journey.first_stamp_at is not null
    )::bigint as first_customer_stamped,
    count(*) filter (
      where journey.billing_activated_at is not null
        and journey.first_stamp_at >= journey.billing_activated_at
        and journey.first_stamp_at <= journey.billing_activated_at + interval '7 days'
    )::bigint as first_stamp_7d_yes,
    count(*) filter (
      where journey.billing_activated_at is not null
        and p_as_of >= journey.billing_activated_at + interval '7 days'
        and not (
          journey.first_stamp_at is not null
          and journey.first_stamp_at >= journey.billing_activated_at
          and journey.first_stamp_at <= journey.billing_activated_at + interval '7 days'
        )
    )::bigint as first_stamp_7d_no,
    count(*) filter (
      where journey.billing_activated_at is null
        or (
          p_as_of < journey.billing_activated_at + interval '7 days'
          and not (
            journey.first_stamp_at is not null
            and journey.first_stamp_at >= journey.billing_activated_at
            and journey.first_stamp_at <= journey.billing_activated_at + interval '7 days'
          )
        )
    )::bigint as first_stamp_7d_pending,
    percentile_cont(0.5) within group (
      order by extract(
        epoch from journey.poster_ready_at - journey.account_created_at
      )
    ) filter (
      where journey.poster_ready_at is not null
        and journey.poster_ready_at >= journey.account_created_at
    )::numeric as median_signup_to_poster_seconds
  from journey;
end;
$function$;

revoke all on function public.record_merchant_activation_event(
  uuid,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;
grant execute on function public.record_merchant_activation_event(
  uuid,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;

revoke all on function public.get_merchant_activation_cohort_facts(
  timestamptz,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.get_merchant_activation_cohort_facts(
  timestamptz,
  timestamptz,
  timestamptz
) to service_role;

notify pgrst, 'reload schema';
