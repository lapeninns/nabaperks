-- Durable, order-safe Stripe billing state for MS-billing-state-durability.
-- This migration is intentionally replay-safe for disposable local proof.

alter table public.billing_customers
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_subscription_created_at timestamptz,
  add column if not exists stripe_price_id text,
  add column if not exists billing_interval text,
  add column if not exists unit_amount bigint,
  add column if not exists currency text,
  add column if not exists cancel_at_period_end boolean,
  add column if not exists cancel_at timestamptz,
  add column if not exists stripe_state_event_created_at timestamptz,
  add column if not exists stripe_state_event_id text;

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_customers'::regclass
      and conname = 'billing_customers_provider_status_valid'
  ) then
    alter table public.billing_customers
      add constraint billing_customers_provider_status_valid
      check (
        stripe_subscription_status is null
        or stripe_subscription_status in (
          'incomplete',
          'incomplete_expired',
          'trialing',
          'active',
          'past_due',
          'canceled',
          'unpaid',
          'paused'
        )
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_customers'::regclass
      and conname = 'billing_customers_interval_valid'
  ) then
    alter table public.billing_customers
      add constraint billing_customers_interval_valid
      check (billing_interval is null or billing_interval in ('month', 'year'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_customers'::regclass
      and conname = 'billing_customers_unit_amount_valid'
  ) then
    alter table public.billing_customers
      add constraint billing_customers_unit_amount_valid
      check (unit_amount is null or unit_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_customers'::regclass
      and conname = 'billing_customers_currency_valid'
  ) then
    alter table public.billing_customers
      add constraint billing_customers_currency_valid
      check (currency is null or currency ~ '^[a-z]{3}$');
  end if;

  alter table public.billing_customers
    drop constraint if exists billing_customers_cancellation_coherent;
  alter table public.billing_customers
    add constraint billing_customers_cancellation_coherent
    check (cancel_at_period_end is not true or cancel_at is not null);

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_customers'::regclass
      and conname = 'billing_customers_event_cursor_paired'
  ) then
    alter table public.billing_customers
      add constraint billing_customers_event_cursor_paired
      check (
        (stripe_state_event_created_at is null)
        = (stripe_state_event_id is null)
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_customers'::regclass
      and conname = 'billing_customers_provider_snapshot_complete'
  ) then
    alter table public.billing_customers
      add constraint billing_customers_provider_snapshot_complete
      check (
        (
          stripe_subscription_status is null
          and stripe_subscription_created_at is null
          and stripe_price_id is null
          and billing_interval is null
          and unit_amount is null
          and currency is null
          and cancel_at_period_end is null
          and cancel_at is null
        )
        or
        (
          stripe_subscription_status is not null
          and stripe_subscription_created_at is not null
          and stripe_customer_id is not null
          and stripe_subscription_id is not null
          and stripe_price_id is not null
          and billing_interval is not null
          and unit_amount is not null
          and currency is not null
          and current_period_end is not null
          and cancel_at_period_end is not null
        )
      );
  end if;
end
$migration$;

create table if not exists public.billing_checkout_attempts (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  stripe_customer_id text unique,
  attempt_id uuid unique,
  billing_interval text,
  stripe_price_id text,
  success_url text,
  cancel_url text,
  attempt_expires_at timestamptz,
  worker_lease_id uuid,
  worker_lease_expires_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_checkout_session_url text,
  stripe_checkout_session_expires_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp()
);

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_checkout_attempts'::regclass
      and conname = 'billing_checkout_attempts_contract_all_or_none'
  ) then
    alter table public.billing_checkout_attempts
      add constraint billing_checkout_attempts_contract_all_or_none
      check (
        (
          attempt_id is null
          and billing_interval is null
          and stripe_price_id is null
          and success_url is null
          and cancel_url is null
          and attempt_expires_at is null
        )
        or
        (
          attempt_id is not null
          and billing_interval in ('month', 'year')
          and nullif(btrim(stripe_price_id), '') is not null
          and success_url ~ '^https?://'
          and cancel_url ~ '^https?://'
          and attempt_expires_at is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_checkout_attempts'::regclass
      and conname = 'billing_checkout_attempts_worker_lease_paired'
  ) then
    alter table public.billing_checkout_attempts
      add constraint billing_checkout_attempts_worker_lease_paired
      check (
        (worker_lease_id is null) = (worker_lease_expires_at is null)
        and (worker_lease_id is null or attempt_id is not null)
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_checkout_attempts'::regclass
      and conname = 'billing_checkout_attempts_session_all_or_none'
  ) then
    alter table public.billing_checkout_attempts
      add constraint billing_checkout_attempts_session_all_or_none
      check (
        (
          stripe_checkout_session_id is null
          and stripe_checkout_session_url is null
          and stripe_checkout_session_expires_at is null
        )
        or
        (
          attempt_id is not null
          and nullif(btrim(stripe_checkout_session_id), '') is not null
          and stripe_checkout_session_url ~ '^https?://'
          and stripe_checkout_session_expires_at is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.billing_checkout_attempts'::regclass
      and conname = 'billing_checkout_attempts_customer_nonempty'
  ) then
    alter table public.billing_checkout_attempts
      add constraint billing_checkout_attempts_customer_nonempty
      check (stripe_customer_id is null or nullif(btrim(stripe_customer_id), '') is not null);
  end if;
end
$migration$;

create index if not exists billing_checkout_attempts_attempt_expiry_idx
  on public.billing_checkout_attempts (attempt_expires_at)
  where attempt_id is not null;

alter table public.billing_checkout_attempts enable row level security;
alter table public.billing_checkout_attempts force row level security;

drop policy if exists billing_checkout_attempts_service_role_all
  on public.billing_checkout_attempts;
create policy billing_checkout_attempts_service_role_all
  on public.billing_checkout_attempts
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.billing_checkout_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_checkout_attempts to service_role;

alter table public.stripe_webhook_events
  add column if not exists lease_id uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.stripe_webhook_events'::regclass
      and conname = 'stripe_webhook_events_lease_paired'
  ) then
    alter table public.stripe_webhook_events
      add constraint stripe_webhook_events_lease_paired
      check ((lease_id is null) = (lease_expires_at is null));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.stripe_webhook_events'::regclass
      and conname = 'stripe_webhook_events_attempt_count_valid'
  ) then
    alter table public.stripe_webhook_events
      add constraint stripe_webhook_events_attempt_count_valid
      check (attempt_count >= 0);
  end if;
end
$migration$;

create index if not exists stripe_webhook_events_lease_expiry_idx
  on public.stripe_webhook_events (lease_expires_at)
  where processed_at is null and lease_id is not null;

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

drop policy if exists stripe_webhook_events_service_role_all
  on public.stripe_webhook_events;
create policy stripe_webhook_events_service_role_all
  on public.stripe_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_webhook_events to service_role;

create or replace function public.claim_billing_checkout_attempt(
  p_merchant_id uuid,
  p_billing_interval text,
  p_stripe_price_id text,
  p_success_url text,
  p_cancel_url text,
  p_attempt_expires_at timestamptz,
  p_stripe_customer_id text default null
)
returns table (
  claim_status text,
  merchant_id uuid,
  attempt_id uuid,
  billing_interval text,
  stripe_price_id text,
  success_url text,
  cancel_url text,
  attempt_expires_at timestamptz,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_checkout_session_url text,
  stripe_checkout_session_expires_at timestamptz,
  worker_lease_id uuid,
  worker_lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := transaction_timestamp();
  v_lease_id uuid := extensions.gen_random_uuid();
  v_row public.billing_checkout_attempts%rowtype;
  v_billing_status text;
  v_billing_customer_id text;
  v_effective_customer_id text;
begin
  if p_merchant_id is null
    or p_billing_interval not in ('month', 'year')
    or nullif(btrim(p_stripe_price_id), '') is null
    or p_success_url !~ '^https?://'
    or p_cancel_url !~ '^https?://'
    or p_attempt_expires_at is null
    or p_attempt_expires_at <= v_now
    or (p_stripe_customer_id is not null and nullif(btrim(p_stripe_customer_id), '') is null) then
    raise invalid_parameter_value using message = 'Invalid Checkout attempt parameters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-checkout:' || p_merchant_id::text, 0)
  );

  select bc.status, bc.stripe_customer_id
  into v_billing_status, v_billing_customer_id
  from public.billing_customers as bc
  where bc.merchant_id = p_merchant_id
  for update;

  if v_billing_status in ('trialing', 'active', 'past_due', 'suspended') then
    return query select
      'blocked'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  if v_billing_customer_id is not null
    and p_stripe_customer_id is not null
    and v_billing_customer_id <> p_stripe_customer_id then
    return query select
      'blocked'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  v_effective_customer_id := coalesce(v_billing_customer_id, p_stripe_customer_id);

  select attempts.*
  into v_row
  from public.billing_checkout_attempts as attempts
  where attempts.merchant_id = p_merchant_id
  for update;

  if v_row.merchant_id is null then
    insert into public.billing_checkout_attempts (
      merchant_id,
      stripe_customer_id,
      attempt_id,
      billing_interval,
      stripe_price_id,
      success_url,
      cancel_url,
      attempt_expires_at,
      worker_lease_id,
      worker_lease_expires_at,
      created_at,
      updated_at
    ) values (
      p_merchant_id,
      v_effective_customer_id,
      extensions.gen_random_uuid(),
      p_billing_interval,
      p_stripe_price_id,
      p_success_url,
      p_cancel_url,
      p_attempt_expires_at,
      v_lease_id,
      v_now + interval '5 minutes',
      v_now,
      v_now
    )
    returning * into v_row;

    return query select
      'claimed'::text,
      v_row.merchant_id,
      v_row.attempt_id,
      v_row.billing_interval,
      v_row.stripe_price_id,
      v_row.success_url,
      v_row.cancel_url,
      v_row.attempt_expires_at,
      v_row.stripe_customer_id,
      v_row.stripe_checkout_session_id,
      v_row.stripe_checkout_session_url,
      v_row.stripe_checkout_session_expires_at,
      v_row.worker_lease_id,
      v_row.worker_lease_expires_at;
    return;
  end if;

  if v_row.stripe_customer_id is not null
    and v_effective_customer_id is not null
    and v_row.stripe_customer_id <> v_effective_customer_id then
    return query select
      'blocked'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  if v_row.stripe_customer_id is null and v_effective_customer_id is not null then
    update public.billing_checkout_attempts as attempts
    set stripe_customer_id = v_effective_customer_id,
        updated_at = v_now
    where attempts.merchant_id = p_merchant_id
    returning attempts.* into v_row;
  end if;

  if v_row.attempt_id is null then
    update public.billing_checkout_attempts as attempts
    set attempt_id = extensions.gen_random_uuid(),
        billing_interval = p_billing_interval,
        stripe_price_id = p_stripe_price_id,
        success_url = p_success_url,
        cancel_url = p_cancel_url,
        attempt_expires_at = p_attempt_expires_at,
        worker_lease_id = v_lease_id,
        worker_lease_expires_at = v_now + interval '5 minutes',
        stripe_checkout_session_id = null,
        stripe_checkout_session_url = null,
        stripe_checkout_session_expires_at = null,
        updated_at = v_now
    where attempts.merchant_id = p_merchant_id
    returning attempts.* into v_row;

    return query select
      'claimed'::text,
      v_row.merchant_id,
      v_row.attempt_id,
      v_row.billing_interval,
      v_row.stripe_price_id,
      v_row.success_url,
      v_row.cancel_url,
      v_row.attempt_expires_at,
      v_row.stripe_customer_id,
      v_row.stripe_checkout_session_id,
      v_row.stripe_checkout_session_url,
      v_row.stripe_checkout_session_expires_at,
      v_row.worker_lease_id,
      v_row.worker_lease_expires_at;
    return;
  end if;

  -- A provider Session always expires before its durable attempt. Once the
  -- attempt itself has expired, an unrecorded Session can no longer be
  -- completed, so a worker with no live competing lease may safely recycle the
  -- attempt. Before expiry the stable attempt id remains the Stripe
  -- idempotency key, including after an ambiguous provider response.
  if v_row.stripe_checkout_session_id is null
    and v_row.attempt_expires_at <= v_now
    and (
      v_row.worker_lease_id is null
      or v_row.worker_lease_expires_at <= v_now
    ) then
    update public.billing_checkout_attempts as attempts
    set attempt_id = extensions.gen_random_uuid(),
        billing_interval = p_billing_interval,
        stripe_price_id = p_stripe_price_id,
        success_url = p_success_url,
        cancel_url = p_cancel_url,
        attempt_expires_at = p_attempt_expires_at,
        worker_lease_id = v_lease_id,
        worker_lease_expires_at = v_now + interval '5 minutes',
        stripe_checkout_session_id = null,
        stripe_checkout_session_url = null,
        stripe_checkout_session_expires_at = null,
        updated_at = v_now
    where attempts.merchant_id = p_merchant_id
    returning attempts.* into v_row;

    return query select
      'claimed'::text,
      v_row.merchant_id,
      v_row.attempt_id,
      v_row.billing_interval,
      v_row.stripe_price_id,
      v_row.success_url,
      v_row.cancel_url,
      v_row.attempt_expires_at,
      v_row.stripe_customer_id,
      v_row.stripe_checkout_session_id,
      v_row.stripe_checkout_session_url,
      v_row.stripe_checkout_session_expires_at,
      v_row.worker_lease_id,
      v_row.worker_lease_expires_at;
    return;
  end if;

  if v_row.billing_interval <> p_billing_interval then
    return query select
      'interval_conflict'::text,
      v_row.merchant_id,
      v_row.attempt_id,
      v_row.billing_interval,
      v_row.stripe_price_id,
      v_row.success_url,
      v_row.cancel_url,
      v_row.attempt_expires_at,
      v_row.stripe_customer_id,
      v_row.stripe_checkout_session_id,
      v_row.stripe_checkout_session_url,
      v_row.stripe_checkout_session_expires_at,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  if v_row.stripe_checkout_session_id is not null then
    return query select
      'existing'::text,
      v_row.merchant_id,
      v_row.attempt_id,
      v_row.billing_interval,
      v_row.stripe_price_id,
      v_row.success_url,
      v_row.cancel_url,
      v_row.attempt_expires_at,
      v_row.stripe_customer_id,
      v_row.stripe_checkout_session_id,
      v_row.stripe_checkout_session_url,
      v_row.stripe_checkout_session_expires_at,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  if v_row.worker_lease_id is not null and v_row.worker_lease_expires_at > v_now then
    return query select
      'busy'::text,
      v_row.merchant_id,
      v_row.attempt_id,
      v_row.billing_interval,
      v_row.stripe_price_id,
      v_row.success_url,
      v_row.cancel_url,
      v_row.attempt_expires_at,
      v_row.stripe_customer_id,
      null::text,
      null::text,
      null::timestamptz,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  update public.billing_checkout_attempts as attempts
  set worker_lease_id = v_lease_id,
      worker_lease_expires_at = v_now + interval '5 minutes',
      updated_at = v_now
  where attempts.merchant_id = p_merchant_id
  returning attempts.* into v_row;

  return query select
    'claimed'::text,
    v_row.merchant_id,
    v_row.attempt_id,
    v_row.billing_interval,
    v_row.stripe_price_id,
    v_row.success_url,
    v_row.cancel_url,
    v_row.attempt_expires_at,
    v_row.stripe_customer_id,
    v_row.stripe_checkout_session_id,
    v_row.stripe_checkout_session_url,
    v_row.stripe_checkout_session_expires_at,
    v_row.worker_lease_id,
    v_row.worker_lease_expires_at;
end
$function$;

create or replace function public.bind_billing_checkout_customer(
  p_merchant_id uuid,
  p_attempt_id uuid,
  p_worker_lease_id uuid,
  p_stripe_customer_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_changed integer;
begin
  if nullif(btrim(p_stripe_customer_id), '') is null then
    raise invalid_parameter_value using message = 'Invalid Stripe customer';
  end if;

  update public.billing_checkout_attempts as attempts
  set stripe_customer_id = p_stripe_customer_id,
      updated_at = transaction_timestamp()
  where attempts.merchant_id = p_merchant_id
    and attempts.attempt_id = p_attempt_id
    and attempts.worker_lease_id = p_worker_lease_id
    and attempts.worker_lease_expires_at > transaction_timestamp()
    and (
      attempts.stripe_customer_id is null
      or attempts.stripe_customer_id = p_stripe_customer_id
    );
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end
$function$;

create or replace function public.finalize_billing_checkout_session(
  p_merchant_id uuid,
  p_attempt_id uuid,
  p_worker_lease_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_checkout_session_url text,
  p_stripe_checkout_session_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_changed integer;
begin
  if nullif(btrim(p_stripe_checkout_session_id), '') is null
    or p_stripe_checkout_session_url !~ '^https?://'
    or p_stripe_checkout_session_expires_at is null
    or p_stripe_checkout_session_expires_at <= transaction_timestamp() then
    raise invalid_parameter_value using message = 'Invalid Checkout Session';
  end if;

  update public.billing_checkout_attempts as attempts
  set stripe_checkout_session_id = p_stripe_checkout_session_id,
      stripe_checkout_session_url = p_stripe_checkout_session_url,
      stripe_checkout_session_expires_at = p_stripe_checkout_session_expires_at,
      worker_lease_id = null,
      worker_lease_expires_at = null,
      updated_at = transaction_timestamp()
  where attempts.merchant_id = p_merchant_id
    and attempts.attempt_id = p_attempt_id
    and attempts.worker_lease_id = p_worker_lease_id
    and attempts.worker_lease_expires_at > transaction_timestamp()
    and attempts.stripe_customer_id is not null
    and p_stripe_checkout_session_expires_at <= attempts.attempt_expires_at
    and (
      attempts.stripe_checkout_session_id is null
      or (
        attempts.stripe_checkout_session_id = p_stripe_checkout_session_id
        and attempts.stripe_checkout_session_url = p_stripe_checkout_session_url
        and attempts.stripe_checkout_session_expires_at = p_stripe_checkout_session_expires_at
      )
    );
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end
$function$;

create or replace function public.release_billing_checkout_attempt(
  p_merchant_id uuid,
  p_attempt_id uuid,
  p_worker_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_changed integer;
begin
  update public.billing_checkout_attempts as attempts
  set worker_lease_id = null,
      worker_lease_expires_at = null,
      updated_at = transaction_timestamp()
  where attempts.merchant_id = p_merchant_id
    and attempts.attempt_id = p_attempt_id
    and attempts.worker_lease_id = p_worker_lease_id;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end
$function$;

create or replace function public.rotate_billing_checkout_attempt(
  p_merchant_id uuid,
  p_expected_attempt_id uuid,
  p_expected_session_id text,
  p_billing_interval text,
  p_stripe_price_id text,
  p_success_url text,
  p_cancel_url text,
  p_attempt_expires_at timestamptz
)
returns table (
  rotation_status text,
  attempt_id uuid,
  worker_lease_id uuid,
  worker_lease_expires_at timestamptz,
  stripe_customer_id text,
  billing_interval text,
  stripe_price_id text,
  success_url text,
  cancel_url text,
  attempt_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := transaction_timestamp();
  v_new_attempt_id uuid := extensions.gen_random_uuid();
  v_new_lease_id uuid := extensions.gen_random_uuid();
  v_row public.billing_checkout_attempts%rowtype;
  v_billing_status text;
  v_billing_customer_id text;
begin
  if p_merchant_id is null
    or p_expected_attempt_id is null
    or p_billing_interval not in ('month', 'year')
    or nullif(btrim(p_stripe_price_id), '') is null
    or p_success_url !~ '^https?://'
    or p_cancel_url !~ '^https?://'
    or p_attempt_expires_at is null
    or p_attempt_expires_at <= v_now then
    raise invalid_parameter_value using message = 'Invalid Checkout rotation parameters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-checkout:' || p_merchant_id::text, 0)
  );

  select bc.status, bc.stripe_customer_id
  into v_billing_status, v_billing_customer_id
  from public.billing_customers as bc
  where bc.merchant_id = p_merchant_id
  for update;

  if v_billing_status in ('trialing', 'active', 'past_due', 'suspended') then
    return query select
      'blocked'::text,
      null::uuid,
      null::uuid,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz;
    return;
  end if;

  select attempts.*
  into v_row
  from public.billing_checkout_attempts as attempts
  where attempts.merchant_id = p_merchant_id
  for update;

  if v_row.merchant_id is null
    or v_row.attempt_id is distinct from p_expected_attempt_id
    or v_row.stripe_checkout_session_id is distinct from p_expected_session_id
    or (
      v_row.stripe_customer_id is not null
      and v_row.stripe_checkout_session_id is null
    )
    or (
      v_billing_customer_id is not null
      and v_row.stripe_customer_id is distinct from v_billing_customer_id
    )
    or (v_row.worker_lease_id is not null and v_row.worker_lease_expires_at > v_now) then
    return query select
      'conflict'::text,
      null::uuid,
      null::uuid,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz;
    return;
  end if;

  update public.billing_checkout_attempts as attempts
  set attempt_id = v_new_attempt_id,
      billing_interval = p_billing_interval,
      stripe_price_id = p_stripe_price_id,
      success_url = p_success_url,
      cancel_url = p_cancel_url,
      attempt_expires_at = p_attempt_expires_at,
      worker_lease_id = v_new_lease_id,
      worker_lease_expires_at = v_now + interval '5 minutes',
      stripe_checkout_session_id = null,
      stripe_checkout_session_url = null,
      stripe_checkout_session_expires_at = null,
      updated_at = v_now
  where attempts.merchant_id = p_merchant_id
  returning attempts.* into v_row;

  return query select
    'claimed'::text,
    v_row.attempt_id,
    v_row.worker_lease_id,
    v_row.worker_lease_expires_at,
    v_row.stripe_customer_id,
    v_row.billing_interval,
    v_row.stripe_price_id,
    v_row.success_url,
    v_row.cancel_url,
    v_row.attempt_expires_at;
end
$function$;

create or replace function public.claim_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_stripe_created_at timestamptz
)
returns table (
  claim_status text,
  lease_id uuid,
  lease_expires_at timestamptz,
  attempt_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := transaction_timestamp();
  v_new_lease_id uuid := extensions.gen_random_uuid();
  v_row public.stripe_webhook_events%rowtype;
begin
  if nullif(btrim(p_stripe_event_id), '') is null
    or nullif(btrim(p_event_type), '') is null
    or p_livemode is null
    or p_stripe_created_at is null then
    raise invalid_parameter_value using message = 'Invalid webhook claim';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stripe-webhook:' || p_stripe_event_id, 0)
  );

  select events.*
  into v_row
  from public.stripe_webhook_events as events
  where events.stripe_event_id = p_stripe_event_id
  for update;

  if v_row.stripe_event_id is null then
    insert into public.stripe_webhook_events (
      stripe_event_id,
      event_type,
      livemode,
      stripe_created_at,
      received_at,
      processed_at,
      failed_at,
      last_error,
      lease_id,
      lease_expires_at,
      attempt_count
    ) values (
      p_stripe_event_id,
      p_event_type,
      p_livemode,
      p_stripe_created_at,
      v_now,
      null,
      null,
      null,
      v_new_lease_id,
      v_now + interval '5 minutes',
      1
    )
    returning * into v_row;

    return query select
      'claimed'::text,
      v_row.lease_id,
      v_row.lease_expires_at,
      v_row.attempt_count;
    return;
  end if;

  if v_row.event_type <> p_event_type
    or v_row.livemode <> p_livemode
    or v_row.stripe_created_at is distinct from p_stripe_created_at then
    raise invalid_parameter_value using message = 'Webhook event identity mismatch';
  end if;

  if v_row.processed_at is not null then
    return query select
      'processed'::text,
      null::uuid,
      null::timestamptz,
      v_row.attempt_count;
    return;
  end if;

  if v_row.attempt_count = 0
    and v_row.lease_id is null
    and v_row.failed_at is null
    and v_row.received_at + interval '5 minutes' > v_now then
    return query select
      'busy'::text,
      null::uuid,
      null::timestamptz,
      v_row.attempt_count;
    return;
  end if;

  if v_row.lease_id is not null and v_row.lease_expires_at > v_now then
    return query select
      'busy'::text,
      null::uuid,
      null::timestamptz,
      v_row.attempt_count;
    return;
  end if;

  update public.stripe_webhook_events as events
  set lease_id = v_new_lease_id,
      lease_expires_at = v_now + interval '5 minutes',
      attempt_count = events.attempt_count + 1,
      failed_at = null,
      last_error = null
  where events.stripe_event_id = p_stripe_event_id
  returning events.* into v_row;

  return query select
    'claimed'::text,
    v_row.lease_id,
    v_row.lease_expires_at,
    v_row.attempt_count;
end
$function$;

create or replace function public.fail_stripe_webhook_event(
  p_stripe_event_id text,
  p_lease_id uuid,
  p_error_code text default 'processing_failed'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_changed integer;
  v_safe_error text;
begin
  v_safe_error := case
    when p_error_code ~ '^[a-z0-9_:-]{1,64}$' then p_error_code
    else 'processing_failed'
  end;

  update public.stripe_webhook_events as events
  set failed_at = transaction_timestamp(),
      last_error = v_safe_error,
      lease_id = null,
      lease_expires_at = null
  where events.stripe_event_id = p_stripe_event_id
    and events.processed_at is null
    and events.lease_id = p_lease_id;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end
$function$;

create or replace function public.complete_stripe_webhook_event(
  p_stripe_event_id text,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_changed integer;
begin
  update public.stripe_webhook_events as events
  set processed_at = transaction_timestamp(),
      failed_at = null,
      last_error = null,
      lease_id = null,
      lease_expires_at = null
  where events.stripe_event_id = p_stripe_event_id
    and events.processed_at is null
    and events.lease_id = p_lease_id;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end
$function$;

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
    or p_billing_interval not in ('month', 'year')
    or p_unit_amount is null
    or p_unit_amount < 0
    or p_currency !~ '^[a-z]{3}$'
    or p_current_period_end is null
    or p_cancel_at_period_end is null
    or (p_cancel_at_period_end and p_cancel_at is null)
    or p_entitlement_status not in ('trialing', 'active', 'past_due', 'cancelled', 'suspended') then
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
        and v_billing.stripe_subscription_created_at <> p_stripe_subscription_created_at then
        raise invalid_parameter_value using message = 'Subscription identity mismatch';
      end if;

      if v_billing.stripe_state_event_created_at is not null
        and v_event.stripe_created_at < v_billing.stripe_state_event_created_at then
        v_result := 'stale';
      end if;
    elsif v_billing.stripe_subscription_created_at is not null
      and p_stripe_subscription_created_at <= v_billing.stripe_subscription_created_at then
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
  p_entitlement_status text
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
    or p_billing_interval not in ('month', 'year')
    or p_unit_amount is null
    or p_unit_amount < 0
    or p_currency !~ '^[a-z]{3}$'
    or p_current_period_end is null
    or p_cancel_at_period_end is null
    or (p_cancel_at_period_end and p_cancel_at is null)
    or p_entitlement_status not in ('trialing', 'active', 'past_due', 'cancelled', 'suspended') then
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

  if v_billing.id is not null then
    if v_billing.stripe_subscription_id = p_stripe_subscription_id then
      if v_billing.stripe_subscription_created_at is not null
        and v_billing.stripe_subscription_created_at <> p_stripe_subscription_created_at then
        raise invalid_parameter_value using message = 'Subscription identity mismatch';
      end if;
    elsif v_billing.stripe_subscription_created_at is not null
      and p_stripe_subscription_created_at <= v_billing.stripe_subscription_created_at then
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

revoke all on function public.claim_billing_checkout_attempt(uuid, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_billing_checkout_attempt(uuid, text, text, text, text, timestamptz, text) to service_role;

revoke all on function public.bind_billing_checkout_customer(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.bind_billing_checkout_customer(uuid, uuid, uuid, text) to service_role;

revoke all on function public.finalize_billing_checkout_session(uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_billing_checkout_session(uuid, uuid, uuid, text, text, timestamptz) to service_role;

revoke all on function public.release_billing_checkout_attempt(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_billing_checkout_attempt(uuid, uuid, uuid) to service_role;

revoke all on function public.rotate_billing_checkout_attempt(uuid, uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.rotate_billing_checkout_attempt(uuid, uuid, text, text, text, text, text, timestamptz) to service_role;

revoke all on function public.claim_stripe_webhook_event(text, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, boolean, timestamptz) to service_role;

revoke all on function public.fail_stripe_webhook_event(text, uuid, text) from public, anon, authenticated;
grant execute on function public.fail_stripe_webhook_event(text, uuid, text) to service_role;

revoke all on function public.complete_stripe_webhook_event(text, uuid) from public, anon, authenticated;
grant execute on function public.complete_stripe_webhook_event(text, uuid) to service_role;

revoke all on function public.apply_stripe_subscription_event(text, uuid, uuid, text, text, text, timestamptz, text, text, bigint, text, timestamptz, boolean, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, uuid, uuid, text, text, text, timestamptz, text, text, bigint, text, timestamptz, boolean, timestamptz, text) to service_role;

revoke all on function public.apply_current_stripe_subscription(uuid, text, text, text, timestamptz, text, text, bigint, text, timestamptz, boolean, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_current_stripe_subscription(uuid, text, text, text, timestamptz, text, text, bigint, text, timestamptz, boolean, timestamptz, text) to service_role;
