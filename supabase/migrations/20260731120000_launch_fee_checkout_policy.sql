-- Persist the launch-fee decision used by each Stripe Checkout attempt and a
-- durable, monotonic record that a merchant has paid it or qualified for the
-- annual inclusion. This keeps retries byte-stable and prevents a reactivation
-- from charging the one-time launch fee again.

alter table public.billing_customers
  add column if not exists launch_fee_status text,
  add column if not exists launch_fee_satisfied_at timestamptz,
  add column if not exists launch_fee_subscription_id text;

update public.billing_customers
set launch_fee_status = 'grandfathered',
    launch_fee_satisfied_at = coalesce(updated_at, transaction_timestamp()),
    launch_fee_subscription_id = stripe_subscription_id
where stripe_subscription_id is not null
  and launch_fee_status is null;

alter table public.billing_customers
  drop constraint if exists billing_customers_launch_fee_status_valid,
  drop constraint if exists billing_customers_launch_fee_evidence_paired;

alter table public.billing_customers
  add constraint billing_customers_launch_fee_status_valid
    check (
      launch_fee_status is null
      or launch_fee_status in ('paid', 'annual_included', 'grandfathered')
    ),
  add constraint billing_customers_launch_fee_evidence_paired
    check (
      (launch_fee_status is null)
      = (launch_fee_satisfied_at is null)
      and (launch_fee_status is null)
      = (launch_fee_subscription_id is null)
    );

alter table public.billing_checkout_attempts
  add column if not exists checkout_offer_bound boolean not null default false,
  add column if not exists stripe_launch_price_id text,
  add column if not exists launch_fee_policy text;

alter table public.billing_checkout_attempts
  drop constraint if exists billing_checkout_attempts_offer_binding_valid;

alter table public.billing_checkout_attempts
  add constraint billing_checkout_attempts_offer_binding_valid
  check (
    (
      checkout_offer_bound = false
      and stripe_launch_price_id is null
      and launch_fee_policy is null
    )
    or
    (
      checkout_offer_bound = true
      and attempt_id is not null
      and (
        (
          billing_interval = 'month'
          and launch_fee_policy = 'charged'
          and nullif(btrim(stripe_launch_price_id), '') is not null
        )
        or
        (
          billing_interval = 'year'
          and launch_fee_policy = 'annual_included'
          and stripe_launch_price_id is null
        )
        or
        (
          billing_interval in ('month', 'year')
          and launch_fee_policy = 'previously_satisfied'
          and stripe_launch_price_id is null
        )
      )
    )
  );

create or replace function public.reset_billing_checkout_offer_binding()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.attempt_id is null
    or (tg_op = 'UPDATE' and new.attempt_id is distinct from old.attempt_id) then
    new.checkout_offer_bound := false;
    new.stripe_launch_price_id := null;
    new.launch_fee_policy := null;
  end if;

  return new;
end
$function$;

drop trigger if exists billing_checkout_attempts_reset_offer_binding
  on public.billing_checkout_attempts;
create trigger billing_checkout_attempts_reset_offer_binding
  before insert or update on public.billing_checkout_attempts
  for each row execute function public.reset_billing_checkout_offer_binding();

create or replace function public.bind_billing_checkout_offer(
  p_merchant_id uuid,
  p_attempt_id uuid,
  p_worker_lease_id uuid,
  p_configured_launch_price_id text
)
returns table (
  bind_status text,
  launch_fee_policy text,
  stripe_launch_price_id text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_attempt public.billing_checkout_attempts%rowtype;
  v_launch_fee_status text;
begin
  if p_merchant_id is null
    or p_attempt_id is null
    or p_worker_lease_id is null
    or nullif(btrim(p_configured_launch_price_id), '') is null then
    raise invalid_parameter_value using message = 'Invalid Checkout offer binding';
  end if;

  select attempts.*
  into v_attempt
  from public.billing_checkout_attempts as attempts
  where attempts.merchant_id = p_merchant_id
  for update;

  if v_attempt.merchant_id is null
    or v_attempt.attempt_id is distinct from p_attempt_id
    or v_attempt.worker_lease_id is distinct from p_worker_lease_id
    or v_attempt.worker_lease_expires_at <= transaction_timestamp() then
    return query select 'conflict'::text, null::text, null::text;
    return;
  end if;

  if v_attempt.checkout_offer_bound then
    return query select
      'existing'::text,
      v_attempt.launch_fee_policy,
      v_attempt.stripe_launch_price_id;
    return;
  end if;

  select customers.launch_fee_status
  into v_launch_fee_status
  from public.billing_customers as customers
  where customers.merchant_id = p_merchant_id;

  if v_launch_fee_status is not null then
    v_attempt.launch_fee_policy := 'previously_satisfied';
    v_attempt.stripe_launch_price_id := null;
  elsif v_attempt.billing_interval = 'year' then
    v_attempt.launch_fee_policy := 'annual_included';
    v_attempt.stripe_launch_price_id := null;
  elsif v_attempt.billing_interval = 'month' then
    v_attempt.launch_fee_policy := 'charged';
    v_attempt.stripe_launch_price_id := btrim(p_configured_launch_price_id);
  else
    return query select 'conflict'::text, null::text, null::text;
    return;
  end if;

  update public.billing_checkout_attempts as attempts
  set checkout_offer_bound = true,
      launch_fee_policy = v_attempt.launch_fee_policy,
      stripe_launch_price_id = v_attempt.stripe_launch_price_id,
      updated_at = transaction_timestamp()
  where attempts.merchant_id = p_merchant_id
    and attempts.attempt_id = p_attempt_id
    and attempts.worker_lease_id = p_worker_lease_id
  returning attempts.* into v_attempt;

  return query select
    'bound'::text,
    v_attempt.launch_fee_policy,
    v_attempt.stripe_launch_price_id;
end
$function$;

create or replace function public.satisfy_merchant_launch_fee(
  p_merchant_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_launch_fee_policy text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := transaction_timestamp();
  v_billing public.billing_customers%rowtype;
  v_attempt_customer_id text;
  v_status text;
begin
  if p_merchant_id is null
    or nullif(btrim(p_stripe_customer_id), '') is null
    or nullif(btrim(p_stripe_subscription_id), '') is null
    or p_launch_fee_policy not in ('charged', 'annual_included') then
    raise invalid_parameter_value using message = 'Invalid launch fee evidence';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || p_merchant_id::text, 0)
  );

  select customers.*
  into v_billing
  from public.billing_customers as customers
  where customers.merchant_id = p_merchant_id
  for update;

  select attempts.stripe_customer_id
  into v_attempt_customer_id
  from public.billing_checkout_attempts as attempts
  where attempts.merchant_id = p_merchant_id;

  if (v_billing.id is not null
      and v_billing.stripe_customer_id <> p_stripe_customer_id)
    or (v_attempt_customer_id is not null
      and v_attempt_customer_id <> p_stripe_customer_id) then
    raise object_not_in_prerequisite_state using message = 'Launch fee customer mismatch';
  end if;

  if v_billing.launch_fee_status is not null then
    return true;
  end if;

  v_status := case p_launch_fee_policy
    when 'charged' then 'paid'
    else 'annual_included'
  end;

  insert into public.billing_customers (
    merchant_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    launch_fee_status,
    launch_fee_satisfied_at,
    launch_fee_subscription_id,
    created_at,
    updated_at
  ) values (
    p_merchant_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    'growth',
    'suspended',
    v_status,
    v_now,
    p_stripe_subscription_id,
    v_now,
    v_now
  )
  on conflict (merchant_id) do update
  set launch_fee_status = excluded.launch_fee_status,
      launch_fee_satisfied_at = excluded.launch_fee_satisfied_at,
      launch_fee_subscription_id = excluded.launch_fee_subscription_id,
      updated_at = v_now
  where billing_customers.stripe_customer_id = excluded.stripe_customer_id
    and billing_customers.launch_fee_status is null;

  select customers.*
  into v_billing
  from public.billing_customers as customers
  where customers.merchant_id = p_merchant_id;

  if v_billing.launch_fee_status is null
    or v_billing.stripe_customer_id <> p_stripe_customer_id then
    return false;
  end if;

  insert into public.audit_logs (
    actor_type,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  ) values (
    'system',
    p_merchant_id,
    'billing_customers',
    v_billing.id,
    'launch_fee_satisfied',
    pg_catalog.jsonb_build_object(
      'status', v_billing.launch_fee_status,
      'stripe_subscription_id', p_stripe_subscription_id
    )
  );

  return true;
end
$function$;

revoke all on function public.bind_billing_checkout_offer(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.bind_billing_checkout_offer(uuid, uuid, uuid, text)
  to service_role;

revoke all on function public.satisfy_merchant_launch_fee(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.satisfy_merchant_launch_fee(uuid, text, text, text)
  to service_role;

revoke all on function public.reset_billing_checkout_offer_binding()
  from public, anon, authenticated;
grant execute on function public.reset_billing_checkout_offer_binding()
  to service_role;
