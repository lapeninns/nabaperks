-- Anchor every new merchant's usable 28-day platform pilot to confirmed poster
-- delivery. Stripe starts with a conservative 42-day provisional trial; this
-- ledger owns fulfilment evidence, synchronisation leases and safe operations
-- review without placing provider calls inside database transactions.

alter table public.billing_checkout_attempts
  add column if not exists checkout_contract_version text;

-- Attempts already holding an idempotency key were created with the former
-- 28-day provider request. Empty ledgers and all later attempts use the
-- delivery-anchored 42-day contract.
update public.billing_checkout_attempts
set checkout_contract_version = case
  when attempt_id is null then 'delivery_anchored_42_day'
  else 'legacy_28_day'
end
where checkout_contract_version is null;

alter table public.billing_checkout_attempts
  alter column checkout_contract_version
    set default 'delivery_anchored_42_day',
  alter column checkout_contract_version set not null,
  add constraint billing_checkout_attempts_contract_version_valid check (
    checkout_contract_version in (
      'legacy_28_day', 'delivery_anchored_42_day'
    )
  );

create function public.set_billing_checkout_contract_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.attempt_id is not null
    and new.attempt_id is distinct from old.attempt_id then
    new.checkout_contract_version := 'delivery_anchored_42_day';
  end if;
  return new;
end
$function$;

create trigger billing_checkout_attempts_contract_version
before update of attempt_id on public.billing_checkout_attempts
for each row execute function public.set_billing_checkout_contract_version();

revoke all on function public.set_billing_checkout_contract_version()
  from public, anon, authenticated, service_role;

create table public.merchant_launch_fulfilments (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null unique
    references public.merchants(id) on delete cascade,
  fulfilment_status text not null default 'awaiting_dispatch'
    check (fulfilment_status in ('awaiting_dispatch', 'dispatched', 'delivered')),
  delivery_unknown boolean not null default false,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  pilot_starts_at timestamptz,
  base_pilot_ends_at timestamptz,
  approved_extension_end timestamptz,
  provisional_stripe_trial_end timestamptz,
  desired_stripe_trial_end timestamptz,
  confirmed_stripe_trial_end timestamptz,
  stripe_subscription_id text,
  sync_status text not null default 'awaiting_delivery'
    check (sync_status in (
      'awaiting_delivery', 'pending', 'retry', 'synchronised', 'review_required'
    )),
  retry_count integer not null default 0 check (retry_count >= 0),
  next_retry_at timestamptz,
  worker_lease_id uuid,
  worker_lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  sync_confirmed_at timestamptz,
  last_error_code text check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  operations_review_required boolean not null default false,
  review_reason text check (
    review_reason is null
    or review_reason ~ '^[a-z0-9_]{1,64}$'
  ),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint merchant_launch_fulfilments_timestamps_coherent check (
    (
      fulfilment_status = 'awaiting_dispatch'
      and dispatched_at is null
      and delivered_at is null
      and pilot_starts_at is null
      and base_pilot_ends_at is null
    )
    or (
      fulfilment_status = 'dispatched'
      and dispatched_at is not null
      and delivered_at is null
      and pilot_starts_at is null
      and base_pilot_ends_at is null
    )
    or (
      fulfilment_status = 'delivered'
      and dispatched_at is not null
      and delivered_at is not null
      and dispatched_at <= delivered_at
      and pilot_starts_at = delivered_at
      and base_pilot_ends_at = delivered_at + interval '28 days'
    )
  ),
  constraint merchant_launch_fulfilments_trial_ends_coherent check (
    (approved_extension_end is null or pilot_starts_at is not null)
    and (desired_stripe_trial_end is null or (
      base_pilot_ends_at is null
      or desired_stripe_trial_end >= base_pilot_ends_at
    ))
    and (confirmed_stripe_trial_end is null or stripe_subscription_id is not null)
  ),
  constraint merchant_launch_fulfilments_lease_coherent check (
    (worker_lease_id is null) = (worker_lease_expires_at is null)
  )
);

create index merchant_launch_fulfilments_due_sync_idx
  on public.merchant_launch_fulfilments (next_retry_at, updated_at)
  where sync_status in ('pending', 'retry');
create index merchant_launch_fulfilments_lease_idx
  on public.merchant_launch_fulfilments (worker_lease_expires_at)
  where worker_lease_id is not null;
create index merchant_launch_fulfilments_review_idx
  on public.merchant_launch_fulfilments (updated_at desc)
  where operations_review_required;

alter table public.merchant_launch_fulfilments enable row level security;
alter table public.merchant_launch_fulfilments force row level security;

create policy merchant_launch_fulfilments_owner_or_admin_read
  on public.merchant_launch_fulfilments
  for select
  to authenticated
  using (
    (select public.is_merchant_owner(merchant_id))
    or (select public.is_internal_admin())
  );

revoke all on table public.merchant_launch_fulfilments
  from public, anon, authenticated;
grant select on table public.merchant_launch_fulfilments to authenticated;
grant select, insert, update on table public.merchant_launch_fulfilments
  to service_role;

create or replace function public.sync_merchant_launch_from_billing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
begin
  if new.launch_fee_status is null or new.stripe_subscription_id is null then
    return new;
  end if;

  insert into public.merchant_launch_fulfilments (
    merchant_id,
    stripe_subscription_id,
    provisional_stripe_trial_end,
    confirmed_stripe_trial_end,
    sync_status,
    operations_review_required,
    review_reason,
    created_at,
    updated_at
  ) values (
    new.merchant_id,
    new.stripe_subscription_id,
    case when new.stripe_subscription_status = 'trialing'
      then new.current_period_end else null end,
    case when new.stripe_subscription_status = 'trialing'
      then new.current_period_end else null end,
    case when new.stripe_subscription_status is null
      or new.stripe_subscription_status = 'trialing'
      then 'awaiting_delivery' else 'review_required' end,
    new.stripe_subscription_status is not null
      and new.stripe_subscription_status <> 'trialing',
    case when new.stripe_subscription_status is not null
      and new.stripe_subscription_status <> 'trialing'
      then 'trial_ended_before_delivery_sync' else null end,
    transaction_timestamp(),
    transaction_timestamp()
  )
  on conflict (merchant_id) do update
  set stripe_subscription_id = excluded.stripe_subscription_id,
      provisional_stripe_trial_end = coalesce(
        excluded.provisional_stripe_trial_end,
        merchant_launch_fulfilments.provisional_stripe_trial_end
      ),
      confirmed_stripe_trial_end = case
        when merchant_launch_fulfilments.confirmed_stripe_trial_end is null
          then excluded.confirmed_stripe_trial_end
        else merchant_launch_fulfilments.confirmed_stripe_trial_end
      end,
      sync_status = case
        when new.stripe_subscription_status = 'trialing'
          and merchant_launch_fulfilments.delivered_at is null
          then 'awaiting_delivery'
        when new.stripe_subscription_status is not null
          and new.stripe_subscription_status <> 'trialing'
          and merchant_launch_fulfilments.sync_status <> 'synchronised'
          then 'review_required'
        else merchant_launch_fulfilments.sync_status
      end,
      operations_review_required = case
        when new.stripe_subscription_status = 'trialing'
          and merchant_launch_fulfilments.delivered_at is null
          then false
        when new.stripe_subscription_status is not null
          and new.stripe_subscription_status <> 'trialing'
          and merchant_launch_fulfilments.sync_status <> 'synchronised'
          then true
        else merchant_launch_fulfilments.operations_review_required
      end,
      review_reason = case
        when new.stripe_subscription_status = 'trialing'
          and merchant_launch_fulfilments.delivered_at is null
          then null
        when new.stripe_subscription_status is not null
          and new.stripe_subscription_status <> 'trialing'
          and merchant_launch_fulfilments.sync_status <> 'synchronised'
          then 'trial_ended_before_delivery_sync'
        else merchant_launch_fulfilments.review_reason
      end,
      updated_at = transaction_timestamp();

  return new;
end
$function$;

create trigger billing_customers_launch_fulfilment_sync
after insert or update of launch_fee_status, stripe_subscription_id,
  stripe_subscription_status, current_period_end
on public.billing_customers
for each row execute function public.sync_merchant_launch_from_billing();

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

  select attempts.* into v_attempt
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

  select customers.launch_fee_status into v_launch_fee_status
  from public.billing_customers as customers
  where customers.merchant_id = p_merchant_id;

  if v_launch_fee_status is not null then
    v_attempt.launch_fee_policy := 'previously_satisfied';
    v_attempt.stripe_launch_price_id := null;
  elsif v_attempt.billing_interval in ('day', 'month', 'year') then
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

create or replace function public.admin_mark_merchant_launch_dispatched(
  p_merchant_id uuid,
  p_dispatched_at timestamptz default null
)
returns public.merchant_launch_fulfilments
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_admin_id uuid := (select auth.uid());
  v_at timestamptz := pg_catalog.date_trunc(
    'second',
    coalesce(p_dispatched_at, transaction_timestamp())
  );
  v_row public.merchant_launch_fulfilments%rowtype;
begin
  if v_admin_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if p_merchant_id is null
    or v_at > transaction_timestamp() + interval '5 minutes' then
    raise invalid_parameter_value using message = 'Invalid dispatch evidence';
  end if;

  insert into public.merchant_launch_fulfilments (merchant_id)
  values (p_merchant_id)
  on conflict (merchant_id) do nothing;

  select fulfilments.* into v_row
  from public.merchant_launch_fulfilments as fulfilments
  where fulfilments.merchant_id = p_merchant_id
  for update;

  if v_row.fulfilment_status <> 'awaiting_dispatch' then
    return v_row;
  end if;

  update public.merchant_launch_fulfilments as fulfilments
  set fulfilment_status = 'dispatched',
      dispatched_at = v_at,
      delivery_unknown = false,
      updated_at = transaction_timestamp()
  where fulfilments.id = v_row.id
  returning fulfilments.* into v_row;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'admin', v_admin_id::text, p_merchant_id,
    'merchant_launch_fulfilments', v_row.id, 'merchant_launch_dispatched',
    pg_catalog.jsonb_build_object('dispatched_at', v_at)
  );

  return v_row;
end
$function$;

create or replace function public.admin_confirm_merchant_launch_delivered(
  p_merchant_id uuid,
  p_delivered_at timestamptz default null
)
returns public.merchant_launch_fulfilments
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_admin_id uuid := (select auth.uid());
  v_at timestamptz := pg_catalog.date_trunc(
    'second',
    coalesce(p_delivered_at, transaction_timestamp())
  );
  v_notice_floor timestamptz := pg_catalog.date_trunc(
    'second',
    transaction_timestamp() + interval '7 days'
  );
  v_row public.merchant_launch_fulfilments%rowtype;
begin
  if v_admin_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;
  if p_merchant_id is null
    or v_at > transaction_timestamp() + interval '5 minutes' then
    raise invalid_parameter_value using message = 'Invalid delivery evidence';
  end if;

  insert into public.merchant_launch_fulfilments (merchant_id)
  values (p_merchant_id)
  on conflict (merchant_id) do nothing;

  select fulfilments.* into v_row
  from public.merchant_launch_fulfilments as fulfilments
  where fulfilments.merchant_id = p_merchant_id
  for update;

  if v_row.fulfilment_status = 'delivered' then
    return v_row;
  end if;
  if v_row.dispatched_at is not null and v_row.dispatched_at > v_at then
    raise invalid_parameter_value using message = 'Delivery predates dispatch';
  end if;

  update public.merchant_launch_fulfilments as fulfilments
  set fulfilment_status = 'delivered',
      dispatched_at = coalesce(fulfilments.dispatched_at, v_at),
      delivered_at = v_at,
      pilot_starts_at = v_at,
      base_pilot_ends_at = v_at + interval '28 days',
      desired_stripe_trial_end = greatest(
        v_at + interval '28 days',
        coalesce(fulfilments.approved_extension_end, '-infinity'::timestamptz),
        coalesce(fulfilments.desired_stripe_trial_end, '-infinity'::timestamptz),
        coalesce(fulfilments.confirmed_stripe_trial_end, '-infinity'::timestamptz),
        v_notice_floor
      ),
      sync_status = case when greatest(
        v_at + interval '28 days',
        coalesce(fulfilments.approved_extension_end, '-infinity'::timestamptz),
        coalesce(fulfilments.desired_stripe_trial_end, '-infinity'::timestamptz),
        coalesce(fulfilments.confirmed_stripe_trial_end, '-infinity'::timestamptz),
        v_notice_floor
      ) > coalesce(
        fulfilments.confirmed_stripe_trial_end,
        '-infinity'::timestamptz
      ) then 'pending' else 'synchronised' end,
      next_retry_at = case when greatest(
        v_at + interval '28 days',
        coalesce(fulfilments.approved_extension_end, '-infinity'::timestamptz),
        coalesce(fulfilments.desired_stripe_trial_end, '-infinity'::timestamptz),
        coalesce(fulfilments.confirmed_stripe_trial_end, '-infinity'::timestamptz),
        v_notice_floor
      ) > coalesce(
        fulfilments.confirmed_stripe_trial_end,
        '-infinity'::timestamptz
      ) then transaction_timestamp() else null end,
      delivery_unknown = false,
      last_error_code = null,
      operations_review_required = false,
      review_reason = null,
      updated_at = transaction_timestamp()
  where fulfilments.id = v_row.id
  returning fulfilments.* into v_row;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'admin', v_admin_id::text, p_merchant_id,
    'merchant_launch_fulfilments', v_row.id, 'merchant_launch_delivered',
    pg_catalog.jsonb_build_object(
      'delivered_at', v_at,
      'base_pilot_ends_at', v_row.base_pilot_ends_at,
      'desired_stripe_trial_end', v_row.desired_stripe_trial_end
    )
  );

  return v_row;
end
$function$;

create or replace function public.admin_set_merchant_launch_pilot_extension(
  p_merchant_id uuid,
  p_extension_end timestamptz
)
returns public.merchant_launch_fulfilments
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_admin_id uuid := (select auth.uid());
  v_extension_end timestamptz := pg_catalog.date_trunc(
    'second',
    p_extension_end
  );
  v_row public.merchant_launch_fulfilments%rowtype;
begin
  if v_admin_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  select fulfilments.* into v_row
  from public.merchant_launch_fulfilments as fulfilments
  where fulfilments.merchant_id = p_merchant_id
  for update;

  if v_row.fulfilment_status <> 'delivered'
    or v_extension_end is null
    or v_extension_end <= v_row.base_pilot_ends_at
    or v_extension_end < coalesce(
      v_row.approved_extension_end,
      '-infinity'::timestamptz
    ) then
    raise invalid_parameter_value using message = 'Invalid pilot extension';
  end if;
  if v_extension_end = v_row.approved_extension_end then
    return v_row;
  end if;

  update public.merchant_launch_fulfilments as fulfilments
  set approved_extension_end = v_extension_end,
      desired_stripe_trial_end = greatest(
        fulfilments.base_pilot_ends_at,
        v_extension_end,
        coalesce(
          fulfilments.confirmed_stripe_trial_end,
          '-infinity'::timestamptz
        ),
        transaction_timestamp() + interval '7 days'
      ),
      sync_status = case when v_extension_end > coalesce(
        fulfilments.confirmed_stripe_trial_end,
        '-infinity'::timestamptz
      ) then 'pending' else 'synchronised' end,
      next_retry_at = case when v_extension_end > coalesce(
        fulfilments.confirmed_stripe_trial_end,
        '-infinity'::timestamptz
      ) then transaction_timestamp() else null end,
      updated_at = transaction_timestamp()
  where fulfilments.id = v_row.id
  returning fulfilments.* into v_row;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'admin', v_admin_id::text, p_merchant_id,
    'merchant_launch_fulfilments', v_row.id, 'merchant_launch_pilot_extended',
    pg_catalog.jsonb_build_object('extension_end', v_extension_end)
  );

  return v_row;
end
$function$;

create or replace function public.claim_merchant_launch_trial_sync()
returns table (
  fulfilment_id uuid,
  merchant_id uuid,
  stripe_subscription_id text,
  provider_status text,
  desired_trial_end timestamptz,
  lease_id uuid,
  sync_reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_id uuid;
  v_lease uuid := extensions.gen_random_uuid();
begin
  select fulfilments.id into v_id
  from public.merchant_launch_fulfilments as fulfilments
  join public.billing_customers as billing
    on billing.merchant_id = fulfilments.merchant_id
  where billing.stripe_subscription_id is not null
    and (fulfilments.worker_lease_expires_at is null
      or fulfilments.worker_lease_expires_at <= transaction_timestamp())
    and (fulfilments.next_retry_at is null
      or fulfilments.next_retry_at <= transaction_timestamp())
    and fulfilments.sync_status <> 'review_required'
    and (
      (fulfilments.fulfilment_status = 'delivered'
        and fulfilments.desired_stripe_trial_end is not null
        and fulfilments.desired_stripe_trial_end
          > coalesce(
            fulfilments.confirmed_stripe_trial_end,
            '-infinity'::timestamptz
          ))
      or
      (fulfilments.fulfilment_status <> 'delivered' and (
        fulfilments.desired_stripe_trial_end
          > coalesce(
            fulfilments.confirmed_stripe_trial_end,
            '-infinity'::timestamptz
          )
        or greatest(
          coalesce(billing.current_period_end, '-infinity'::timestamptz),
          coalesce(
            fulfilments.confirmed_stripe_trial_end,
            '-infinity'::timestamptz
          )
        ) <= transaction_timestamp() + interval '7 days'
      ))
    )
  order by fulfilments.next_retry_at nulls first, fulfilments.updated_at
  limit 1
  for update of fulfilments skip locked;

  if v_id is null then
    return;
  end if;

  return query
  update public.merchant_launch_fulfilments as fulfilments
  set desired_stripe_trial_end = case
        when fulfilments.fulfilment_status = 'delivered'
          then fulfilments.desired_stripe_trial_end
        else greatest(
          coalesce(
            fulfilments.desired_stripe_trial_end,
            '-infinity'::timestamptz
          ),
          pg_catalog.date_trunc(
            'second',
            transaction_timestamp() + interval '14 days'
          )
        )
      end,
      sync_status = 'pending',
      worker_lease_id = v_lease,
      worker_lease_expires_at = transaction_timestamp() + interval '5 minutes',
      last_attempt_at = transaction_timestamp(),
      updated_at = transaction_timestamp()
  from public.billing_customers as billing
  where fulfilments.id = v_id
    and billing.merchant_id = fulfilments.merchant_id
  returning
    fulfilments.id,
    fulfilments.merchant_id,
    billing.stripe_subscription_id,
    billing.stripe_subscription_status,
    fulfilments.desired_stripe_trial_end,
    v_lease,
    case when fulfilments.fulfilment_status = 'delivered'
      then 'delivery_confirmed'::text else 'undelivered_safety'::text end;
end
$function$;

create or replace function public.confirm_merchant_launch_trial_sync(
  p_fulfilment_id uuid,
  p_lease_id uuid,
  p_stripe_subscription_id text,
  p_confirmed_trial_end timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.merchant_launch_fulfilments%rowtype;
begin
  select fulfilments.* into v_row
  from public.merchant_launch_fulfilments as fulfilments
  where fulfilments.id = p_fulfilment_id
  for update;

  if v_row.id is null
    or v_row.worker_lease_id is distinct from p_lease_id
    or v_row.worker_lease_expires_at <= transaction_timestamp()
    or v_row.stripe_subscription_id is distinct from p_stripe_subscription_id
    or p_confirmed_trial_end is null
    or v_row.desired_stripe_trial_end is null
    or v_row.desired_stripe_trial_end > p_confirmed_trial_end then
    return false;
  end if;

  update public.merchant_launch_fulfilments as fulfilments
  set desired_stripe_trial_end = greatest(
        coalesce(
          fulfilments.desired_stripe_trial_end,
          '-infinity'::timestamptz
        ),
        p_confirmed_trial_end
      ),
      confirmed_stripe_trial_end = p_confirmed_trial_end,
      sync_status = case when fulfilments.fulfilment_status = 'delivered'
        then 'synchronised' else 'awaiting_delivery' end,
      retry_count = 0,
      next_retry_at = null,
      worker_lease_id = null,
      worker_lease_expires_at = null,
      last_error_code = null,
      sync_confirmed_at = transaction_timestamp(),
      updated_at = transaction_timestamp()
  where fulfilments.id = p_fulfilment_id;

  return true;
end
$function$;

create or replace function public.fail_merchant_launch_trial_sync(
  p_fulfilment_id uuid,
  p_lease_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_terminal boolean := p_error_code in (
    'subscription_not_trialing', 'subscription_missing',
    'ownership_mismatch', 'invalid_trial_end'
  );
begin
  if p_error_code not in (
    'stripe_retrieve_failed', 'stripe_update_failed',
    'stripe_readback_mismatch', 'database_confirm_failed',
    'subscription_not_trialing', 'subscription_missing',
    'ownership_mismatch', 'invalid_trial_end'
  ) then
    raise invalid_parameter_value using message = 'Invalid trial sync error code';
  end if;

  update public.merchant_launch_fulfilments as fulfilments
  set retry_count = fulfilments.retry_count + 1,
      sync_status = case when v_terminal then 'review_required' else 'retry' end,
      next_retry_at = case when v_terminal then null else
        transaction_timestamp() + pg_catalog.make_interval(
          secs => 300 * (2 ^ least(fulfilments.retry_count, 8))::integer
        ) end,
      worker_lease_id = null,
      worker_lease_expires_at = null,
      last_error_code = p_error_code,
      operations_review_required = v_terminal,
      review_reason = case when v_terminal then p_error_code
        else fulfilments.review_reason end,
      updated_at = transaction_timestamp()
  where fulfilments.id = p_fulfilment_id
    and fulfilments.worker_lease_id = p_lease_id
    and fulfilments.worker_lease_expires_at > transaction_timestamp();

  return found;
end
$function$;

-- Existing trialling subscriptions remain automatic but are never shortened:
-- target at least the original subscription start + 42 days. Existing billed
-- subscriptions are a report-only cohort for evidence-led credit/refund review.
insert into public.merchant_launch_fulfilments (
  merchant_id,
  delivery_unknown,
  provisional_stripe_trial_end,
  desired_stripe_trial_end,
  confirmed_stripe_trial_end,
  stripe_subscription_id,
  sync_status,
  next_retry_at,
  operations_review_required,
  review_reason,
  created_at,
  updated_at
)
select
  billing.merchant_id,
  true,
  case when billing.stripe_subscription_status = 'trialing'
    then billing.current_period_end else null end,
  case when billing.stripe_subscription_status = 'trialing' then greatest(
    billing.current_period_end,
    billing.stripe_subscription_created_at + interval '42 days'
  ) else null end,
  case when billing.stripe_subscription_status = 'trialing'
    then billing.current_period_end else null end,
  billing.stripe_subscription_id,
  case
    when billing.stripe_subscription_status = 'trialing'
      and greatest(
        billing.current_period_end,
        billing.stripe_subscription_created_at + interval '42 days'
      ) > billing.current_period_end then 'pending'
    when billing.stripe_subscription_status = 'trialing' then 'awaiting_delivery'
    else 'review_required'
  end,
  case when billing.stripe_subscription_status = 'trialing'
    then transaction_timestamp() else null end,
  billing.stripe_subscription_status <> 'trialing',
  case when billing.stripe_subscription_status <> 'trialing'
    then 'already_billed_delivery_review' else null end,
  transaction_timestamp(),
  transaction_timestamp()
from public.billing_customers as billing
where billing.stripe_subscription_id is not null
  and billing.launch_fee_status is not null
on conflict (merchant_id) do nothing;

create view public.merchant_launch_pilot_review
with (security_invoker = true)
as
select
  fulfilments.merchant_id,
  fulfilments.fulfilment_status,
  fulfilments.delivered_at,
  fulfilments.base_pilot_ends_at,
  fulfilments.confirmed_stripe_trial_end,
  fulfilments.sync_status,
  fulfilments.review_reason,
  billing.stripe_subscription_status,
  billing.stripe_subscription_created_at,
  billing.current_period_end,
  case
    when fulfilments.delivered_at is null then null
    else greatest(
      0,
      extract(epoch from (
        coalesce(fulfilments.confirmed_stripe_trial_end, billing.current_period_end)
        - fulfilments.delivered_at
      )) / 86400
    )
  end as observed_usable_pilot_days
from public.merchant_launch_fulfilments as fulfilments
join public.billing_customers as billing
  on billing.merchant_id = fulfilments.merchant_id
where fulfilments.operations_review_required;

revoke all on table public.merchant_launch_pilot_review
  from public, anon, authenticated;
grant select on table public.merchant_launch_pilot_review to service_role;

revoke all on function public.sync_merchant_launch_from_billing() from public;
revoke all on function public.admin_mark_merchant_launch_dispatched(uuid, timestamptz)
  from public, anon;
revoke all on function public.admin_confirm_merchant_launch_delivered(uuid, timestamptz)
  from public, anon;
revoke all on function public.admin_set_merchant_launch_pilot_extension(uuid, timestamptz)
  from public, anon;
revoke all on function public.claim_merchant_launch_trial_sync()
  from public, anon, authenticated;
revoke all on function public.confirm_merchant_launch_trial_sync(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.fail_merchant_launch_trial_sync(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.admin_mark_merchant_launch_dispatched(
  uuid, timestamptz
) to authenticated, service_role;
grant execute on function public.set_billing_checkout_contract_version()
  to service_role;
grant execute on function public.sync_merchant_launch_from_billing()
  to service_role;
grant execute on function public.admin_confirm_merchant_launch_delivered(
  uuid, timestamptz
) to authenticated, service_role;
grant execute on function public.admin_set_merchant_launch_pilot_extension(
  uuid, timestamptz
) to authenticated, service_role;
grant execute on function public.claim_merchant_launch_trial_sync()
  to service_role;
grant execute on function public.confirm_merchant_launch_trial_sync(
  uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.fail_merchant_launch_trial_sync(uuid, uuid, text)
  to service_role;

alter table public.operational_cron_jobs
  drop constraint operational_cron_jobs_name_valid,
  add constraint operational_cron_jobs_name_valid check (
    job_name in (
      'notifications',
      'privacy-retention',
      'merchant-digest',
      'birthday-rewards',
      'referral-bonus-drain',
      'loyalty-invite-drain',
      'billing-trial-sync'
    )
  );

insert into public.operational_cron_jobs (job_name, maximum_gap)
values ('billing-trial-sync', interval '30 minutes')
on conflict (job_name) do update
set maximum_gap = excluded.maximum_gap;
