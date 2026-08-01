-- Accept Stripe's exact 28-day recurring Price (`interval=day`,
-- `interval_count=28`) in authoritative subscription snapshots. Historical
-- monthly and annual subscriptions remain readable and manageable, but new
-- Checkout is offered only through the 28-day Price.

alter table public.billing_customers
  drop constraint if exists billing_customers_interval_valid;

alter table public.billing_customers
  add constraint billing_customers_interval_valid
  check (billing_interval is null or billing_interval in ('day', 'month', 'year'));

create or replace function public.apply_stripe_subscription_event(
  p_stripe_event_id text,
  p_lease_id uuid,
  p_merchant_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_subscription_status text,
  p_stripe_subscription_created_at timestamptz,
  p_stripe_price_id text,
  p_billing_interval text,
  p_unit_amount bigint,
  p_currency text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_cancel_at timestamptz,
  p_entitlement_status text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := transaction_timestamp();
  v_event public.stripe_webhook_events%rowtype;
  v_billing public.billing_customers%rowtype;
  v_attempt public.billing_checkout_attempts%rowtype;
  v_result text := 'applied';
begin
  if p_merchant_id is null
    or nullif(btrim(p_stripe_customer_id), '') is null
    or nullif(btrim(p_stripe_subscription_id), '') is null
    or p_stripe_subscription_status not in (
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )
    or p_stripe_subscription_created_at is null
    or nullif(btrim(p_stripe_price_id), '') is null
    or p_billing_interval not in ('day', 'month', 'year')
    or p_unit_amount is null
    or p_unit_amount < 0
    or p_currency !~ '^[a-z]{3}$'
    or p_current_period_end is null
    or p_cancel_at_period_end is null
    or (p_cancel_at_period_end and p_cancel_at is null)
    or p_entitlement_status not in (
      'trialing', 'active', 'past_due', 'cancelled', 'suspended'
    ) then
    raise invalid_parameter_value using message = 'Invalid billing snapshot';
  end if;

  select events.*
  into v_event
  from public.stripe_webhook_events as events
  where events.stripe_event_id = p_stripe_event_id
  for update;

  if v_event.stripe_event_id is null
    or v_event.processed_at is not null
    or v_event.lease_id is distinct from p_lease_id then
    raise object_not_in_prerequisite_state using message = 'Webhook lease is not current';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || p_merchant_id::text, 0)
  );

  select bc.*
  into v_billing
  from public.billing_customers as bc
  where bc.merchant_id = p_merchant_id
  for update;

  if v_billing.id is not null then
    if v_billing.stripe_subscription_id = p_stripe_subscription_id then
      if v_billing.stripe_subscription_created_at is not null
        and v_billing.stripe_subscription_created_at
          <> p_stripe_subscription_created_at then
        raise invalid_parameter_value using message = 'Subscription identity mismatch';
      end if;

      if v_billing.stripe_state_event_created_at is not null
        and v_event.stripe_created_at
          < v_billing.stripe_state_event_created_at then
        v_result := 'stale';
      end if;
    elsif v_billing.stripe_subscription_created_at is not null
      and p_stripe_subscription_created_at
        <= v_billing.stripe_subscription_created_at then
      v_result := 'stale';
    end if;
  end if;

  if v_result = 'applied' then
    select attempts.*
    into v_attempt
    from public.billing_checkout_attempts as attempts
    where attempts.merchant_id = p_merchant_id
    for update;

    if v_attempt.merchant_id is not null
      and v_attempt.stripe_customer_id is not null
      and v_attempt.stripe_customer_id <> p_stripe_customer_id then
      raise object_not_in_prerequisite_state using message = 'Checkout customer mismatch';
    end if;

    insert into public.billing_customers (
      merchant_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      current_period_end,
      stripe_subscription_status,
      stripe_subscription_created_at,
      stripe_price_id,
      billing_interval,
      unit_amount,
      currency,
      cancel_at_period_end,
      cancel_at,
      stripe_state_event_created_at,
      stripe_state_event_id,
      created_at,
      updated_at
    ) values (
      p_merchant_id,
      p_stripe_customer_id,
      p_stripe_subscription_id,
      'growth',
      p_entitlement_status,
      p_current_period_end,
      p_stripe_subscription_status,
      p_stripe_subscription_created_at,
      p_stripe_price_id,
      p_billing_interval,
      p_unit_amount,
      p_currency,
      p_cancel_at_period_end,
      p_cancel_at,
      v_event.stripe_created_at,
      p_stripe_event_id,
      v_now,
      v_now
    )
    on conflict (merchant_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        plan = excluded.plan,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        stripe_subscription_status = excluded.stripe_subscription_status,
        stripe_subscription_created_at = excluded.stripe_subscription_created_at,
        stripe_price_id = excluded.stripe_price_id,
        billing_interval = excluded.billing_interval,
        unit_amount = excluded.unit_amount,
        currency = excluded.currency,
        cancel_at_period_end = excluded.cancel_at_period_end,
        cancel_at = excluded.cancel_at,
        stripe_state_event_created_at = excluded.stripe_state_event_created_at,
        stripe_state_event_id = excluded.stripe_state_event_id,
        updated_at = v_now;

    insert into public.billing_checkout_attempts (
      merchant_id,
      stripe_customer_id,
      created_at,
      updated_at
    ) values (
      p_merchant_id,
      p_stripe_customer_id,
      v_now,
      v_now
    )
    on conflict (merchant_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        attempt_id = null,
        billing_interval = null,
        stripe_price_id = null,
        success_url = null,
        cancel_url = null,
        attempt_expires_at = null,
        worker_lease_id = null,
        worker_lease_expires_at = null,
        stripe_checkout_session_id = null,
        stripe_checkout_session_url = null,
        stripe_checkout_session_expires_at = null,
        updated_at = v_now;
  end if;

  update public.stripe_webhook_events as events
  set processed_at = v_now,
      failed_at = null,
      last_error = null,
      lease_id = null,
      lease_expires_at = null
  where events.stripe_event_id = p_stripe_event_id
    and events.processed_at is null
    and events.lease_id = p_lease_id;

  if not found then
    raise object_not_in_prerequisite_state using message = 'Webhook lease changed';
  end if;

  return v_result;
end
$function$;

create or replace function public.apply_current_stripe_subscription(
  p_merchant_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_subscription_status text,
  p_stripe_subscription_created_at timestamptz,
  p_stripe_price_id text,
  p_billing_interval text,
  p_unit_amount bigint,
  p_currency text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_cancel_at timestamptz,
  p_entitlement_status text,
  p_expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := transaction_timestamp();
  v_billing public.billing_customers%rowtype;
  v_attempt public.billing_checkout_attempts%rowtype;
begin
  if p_merchant_id is null
    or nullif(btrim(p_stripe_customer_id), '') is null
    or nullif(btrim(p_stripe_subscription_id), '') is null
    or p_stripe_subscription_status not in (
      'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )
    or p_stripe_subscription_created_at is null
    or nullif(btrim(p_stripe_price_id), '') is null
    or p_billing_interval not in ('day', 'month', 'year')
    or p_unit_amount is null
    or p_unit_amount < 0
    or p_currency !~ '^[a-z]{3}$'
    or p_current_period_end is null
    or p_cancel_at_period_end is null
    or (p_cancel_at_period_end and p_cancel_at is null)
    or p_entitlement_status not in (
      'trialing', 'active', 'past_due', 'cancelled', 'suspended'
    ) then
    raise invalid_parameter_value using message = 'Invalid billing snapshot';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || p_merchant_id::text, 0)
  );

  select bc.*
  into v_billing
  from public.billing_customers as bc
  where bc.merchant_id = p_merchant_id
  for update;

  if v_billing.id is null then
    if p_expected_updated_at is not null then
      return 'stale';
    end if;
  else
    if v_billing.updated_at is distinct from p_expected_updated_at then
      return 'stale';
    end if;

    if v_billing.stripe_subscription_id = p_stripe_subscription_id then
      if v_billing.stripe_subscription_created_at is not null
        and v_billing.stripe_subscription_created_at
          <> p_stripe_subscription_created_at then
        raise invalid_parameter_value using message = 'Subscription identity mismatch';
      end if;
    elsif v_billing.stripe_subscription_created_at is not null
      and p_stripe_subscription_created_at
        <= v_billing.stripe_subscription_created_at then
      return 'stale';
    end if;
  end if;

  select attempts.*
  into v_attempt
  from public.billing_checkout_attempts as attempts
  where attempts.merchant_id = p_merchant_id
  for update;

  if v_attempt.merchant_id is not null
    and v_attempt.stripe_customer_id is not null
    and v_attempt.stripe_customer_id <> p_stripe_customer_id then
    raise object_not_in_prerequisite_state using message = 'Checkout customer mismatch';
  end if;

  insert into public.billing_customers (
    merchant_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    current_period_end,
    stripe_subscription_status,
    stripe_subscription_created_at,
    stripe_price_id,
    billing_interval,
    unit_amount,
    currency,
    cancel_at_period_end,
    cancel_at,
    created_at,
    updated_at
  ) values (
    p_merchant_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    'growth',
    p_entitlement_status,
    p_current_period_end,
    p_stripe_subscription_status,
    p_stripe_subscription_created_at,
    p_stripe_price_id,
    p_billing_interval,
    p_unit_amount,
    p_currency,
    p_cancel_at_period_end,
    p_cancel_at,
    v_now,
    v_now
  )
  on conflict (merchant_id) do update
  set stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan = excluded.plan,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      stripe_subscription_status = excluded.stripe_subscription_status,
      stripe_subscription_created_at = excluded.stripe_subscription_created_at,
      stripe_price_id = excluded.stripe_price_id,
      billing_interval = excluded.billing_interval,
      unit_amount = excluded.unit_amount,
      currency = excluded.currency,
      cancel_at_period_end = excluded.cancel_at_period_end,
      cancel_at = excluded.cancel_at,
      updated_at = v_now;

  insert into public.billing_checkout_attempts (
    merchant_id,
    stripe_customer_id,
    created_at,
    updated_at
  ) values (
    p_merchant_id,
    p_stripe_customer_id,
    v_now,
    v_now
  )
  on conflict (merchant_id) do update
  set stripe_customer_id = excluded.stripe_customer_id,
      attempt_id = null,
      billing_interval = null,
      stripe_price_id = null,
      success_url = null,
      cancel_url = null,
      attempt_expires_at = null,
      worker_lease_id = null,
      worker_lease_expires_at = null,
      stripe_checkout_session_id = null,
      stripe_checkout_session_url = null,
      stripe_checkout_session_expires_at = null,
      updated_at = v_now;

  return 'applied';
end
$function$;
