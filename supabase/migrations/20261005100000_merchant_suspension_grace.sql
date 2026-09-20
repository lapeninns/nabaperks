-- Merchant suspension and billing-lapse reward grace.
--
-- WHAT CHANGES
--   * Manual suspension becomes an attributed, admin-only state transition.
--   * Billing lapses and manual suspensions share one durable 30-day reward grace.
--   * Rewards issued before the pause remain collectable during grace; earning
--     and newly issued rewards stay blocked.
--   * Recovery extends each open reward once by the actual paused duration.
--   * Suspension notices are service messages in the transactional category.
--
-- Forward-only and re-runnable.

-- 1. Durable suspension state -------------------------------------------------
alter table public.merchants
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null,
  add column if not exists status_before_suspension text;

update public.merchants
set suspended_at = coalesce(suspended_at, updated_at, created_at),
    suspension_reason = coalesce(nullif(btrim(suspension_reason), ''), 'Legacy suspension'),
    status_before_suspension = coalesce(status_before_suspension, 'active')
where status = 'suspended'
  and (suspended_at is null
       or nullif(btrim(suspension_reason), '') is null
       or status_before_suspension is null);

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'merchants_suspension_state_coherent'
      and conrelid = 'public.merchants'::regclass
  ) then
    alter table public.merchants
      add constraint merchants_suspension_state_coherent check (
        (status = 'suspended') = (suspended_at is not null)
        and (status <> 'suspended' or (
          char_length(btrim(suspension_reason)) between 4 and 500
          and status_before_suspension in ('trial', 'active', 'paused', 'cancelled')
        ))
      ) not valid;
    alter table public.merchants
      validate constraint merchants_suspension_state_coherent;
  end if;
end
$do$;

comment on column public.merchants.suspended_at is
  'Start of the current manual suspension. Null outside a manual suspension.';
comment on column public.merchants.suspension_reason is
  'Internal-admin reason for the current manual suspension.';
comment on column public.merchants.suspended_by is
  'Internal admin who began the current manual suspension.';
comment on column public.merchants.status_before_suspension is
  'Merchant status restored when the current manual suspension ends.';

-- Stripe event time must continue advancing for stale-event rejection, so a
-- separate timestamp preserves the start of a continuous blocked billing run.
alter table public.billing_customers
  add column if not exists loyalty_suspended_at timestamptz;

update public.billing_customers
set loyalty_suspended_at = coalesce(
  loyalty_suspended_at,
  stripe_state_event_created_at,
  updated_at,
  created_at
)
where status in ('past_due', 'cancelled', 'suspended')
  and loyalty_suspended_at is null;

update public.billing_customers
set loyalty_suspended_at = null
where status not in ('past_due', 'cancelled', 'suspended')
  and loyalty_suspended_at is not null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'billing_customers_loyalty_suspension_coherent'
      and conrelid = 'public.billing_customers'::regclass
  ) then
    alter table public.billing_customers
      add constraint billing_customers_loyalty_suspension_coherent check (
        (status in ('past_due', 'cancelled', 'suspended'))
          = (loyalty_suspended_at is not null)
      ) not valid;
    alter table public.billing_customers
      validate constraint billing_customers_loyalty_suspension_coherent;
  end if;
end
$do$;

comment on column public.billing_customers.loyalty_suspended_at is
  'Start of the continuous billing-ineligible period. Blocked-to-blocked Stripe events do not reset it.';

-- 2. Private grace and one-shot extension primitives --------------------------
create table if not exists private.reward_suspension_extensions (
  extension_key text primary key,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  extended_reward_count integer not null default 0 check (extended_reward_count >= 0),
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

revoke all on table private.reward_suspension_extensions
  from public, anon, authenticated, service_role;

create or replace function private.merchant_suspended_at(p_merchant_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select case
    when merchants.status = 'suspended' then merchants.suspended_at
    when merchants.requires_billing
      and billing.status in ('past_due', 'cancelled', 'suspended')
      then coalesce(billing.loyalty_suspended_at, billing.stripe_state_event_created_at)
    else null
  end
  from public.merchants merchants
  left join public.billing_customers billing on billing.merchant_id = merchants.id
  where merchants.id = p_merchant_id;
$function$;

create or replace function private.reward_redemption_grace_until(p_reward_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select private.merchant_suspended_at(rewards.merchant_id) + interval '30 days'
  from public.reward_events rewards
  where rewards.id = p_reward_id
    and rewards.created_at < private.merchant_suspended_at(rewards.merchant_id);
$function$;

create or replace function private.reward_in_suspension_grace(
  p_reward_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
  select coalesce((
    select rewards.status = 'unlocked'
      and rewards.created_at < suspended.at
      and p_at >= suspended.at
      and p_at < suspended.at + interval '30 days'
    from public.reward_events rewards
    cross join lateral (
      select private.merchant_suspended_at(rewards.merchant_id) as at
    ) suspended
    where rewards.id = p_reward_id
      and suspended.at is not null
  ), false);
$function$;

create or replace function private.extend_open_reward_expiry(
  p_merchant_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_extension_key text
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_count integer := 0;
begin
  if p_merchant_id is null
     or p_started_at is null
     or p_ended_at is null
     or p_ended_at < p_started_at
     or nullif(btrim(p_extension_key), '') is null then
    raise invalid_parameter_value using message = 'A valid suspension extension is required';
  end if;

  insert into private.reward_suspension_extensions (
    extension_key, merchant_id, started_at, ended_at
  ) values (
    p_extension_key, p_merchant_id, p_started_at, p_ended_at
  )
  on conflict (extension_key) do nothing;

  if not found then return 0; end if;

  update public.reward_events rewards
  set expires_at = case
        when rewards.reward_policy_version = 'v2' then
          private.snap_v2_reward_expiry_extension(
            rewards.id,
            rewards.expires_at + (p_ended_at - p_started_at)
          )
        else rewards.expires_at + (p_ended_at - p_started_at)
      end,
      reward_policy_snapshot = coalesce(rewards.reward_policy_snapshot, '{}'::jsonb)
        || jsonb_build_object(
          'suspension_expiry_extensions',
          coalesce(rewards.reward_policy_snapshot -> 'suspension_expiry_extensions', '[]'::jsonb)
            || jsonb_build_array(jsonb_build_object(
              'key', p_extension_key,
              'started_at', p_started_at,
              'ended_at', p_ended_at,
              'duration_seconds', extract(epoch from (p_ended_at - p_started_at))::bigint
            ))
        ),
      updated_at = now()
  where rewards.merchant_id = p_merchant_id
    and rewards.status = 'unlocked'
    and rewards.created_at < p_started_at
    and rewards.expires_at is not null;
  get diagnostics v_count = row_count;

  update private.reward_suspension_extensions
  set extended_reward_count = v_count
  where extension_key = p_extension_key;

  return v_count;
end;
$function$;

revoke all on function private.merchant_suspended_at(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.reward_redemption_grace_until(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.reward_in_suspension_grace(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.extend_open_reward_expiry(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated, service_role;

-- 3. Notices and serialized billing transitions ------------------------------
create or replace function private.enqueue_venue_paused_notices(
  p_merchant_id uuid,
  p_suspended_at timestamptz,
  p_source text
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_reward record;
  v_count integer := 0;
begin
  for v_reward in
    select rewards.id, rewards.customer_id, rewards.membership_id,
           rewards.cycle_number, merchants.business_name
    from public.reward_events rewards
    join public.merchants merchants on merchants.id = rewards.merchant_id
    where rewards.merchant_id = p_merchant_id
      and rewards.status = 'unlocked'
      and rewards.created_at < p_suspended_at
  loop
    perform public.enqueue_notification_event(
      'venue_paused',
      v_reward.customer_id,
      p_merchant_id,
      v_reward.membership_id,
      v_reward.id,
      v_reward.cycle_number,
      public.uk_business_date(p_suspended_at),
      now(),
      'venue_paused:' || v_reward.id::text || ':' || extract(epoch from p_suspended_at)::text,
      jsonb_build_object(
        'title', coalesce(v_reward.business_name, 'Venue') || ' rewards paused',
        'body', 'This reward can still be collected for 30 days.',
        'url', '/home/rewards',
        'rewardEventId', v_reward.id,
        'graceUntil', p_suspended_at + interval '30 days'
      ),
      jsonb_build_object('source', p_source, 'service_message', true)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function private.enqueue_venue_paused_notices(uuid, timestamptz, text)
  from public, anon, authenticated, service_role;

create or replace function private.prepare_billing_loyalty_suspension()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || new.merchant_id::text, 0)
  );

  if new.status in ('past_due', 'cancelled', 'suspended') then
    if tg_op = 'UPDATE'
       and old.status in ('past_due', 'cancelled', 'suspended') then
      new.loyalty_suspended_at := old.loyalty_suspended_at;
    else
      new.loyalty_suspended_at := coalesce(
        new.stripe_state_event_created_at,
        clock_timestamp()
      );
    end if;
  else
    new.loyalty_suspended_at := null;
  end if;

  return new;
end;
$function$;

create or replace function private.finish_billing_loyalty_suspension()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_ended_at timestamptz;
  v_requires_billing boolean;
begin
  select merchants.requires_billing
  into v_requires_billing
  from public.merchants merchants
  where merchants.id = new.merchant_id;

  if not coalesce(v_requires_billing, true) then return new; end if;

  if (tg_op = 'INSERT'
      or old.status not in ('past_due', 'cancelled', 'suspended'))
     and new.status in ('past_due', 'cancelled', 'suspended') then
    perform private.enqueue_venue_paused_notices(
      new.merchant_id,
      new.loyalty_suspended_at,
      'billing_lapse'
    );
  elsif old.status in ('past_due', 'cancelled', 'suspended')
        and new.status not in ('past_due', 'cancelled', 'suspended') then
    v_ended_at := coalesce(new.stripe_state_event_created_at, clock_timestamp());
    perform private.extend_open_reward_expiry(
      new.merchant_id,
      old.loyalty_suspended_at,
      greatest(v_ended_at, old.loyalty_suspended_at),
      'billing:' || new.merchant_id::text || ':' || extract(epoch from old.loyalty_suspended_at)::text
    );
  end if;

  return new;
end;
$function$;

revoke all on function private.prepare_billing_loyalty_suspension()
  from public, anon, authenticated, service_role;
revoke all on function private.finish_billing_loyalty_suspension()
  from public, anon, authenticated, service_role;

drop trigger if exists billing_customers_prepare_loyalty_suspension
  on public.billing_customers;
create trigger billing_customers_prepare_loyalty_suspension
  before insert or update of status on public.billing_customers
  for each row
  execute function private.prepare_billing_loyalty_suspension();

drop trigger if exists billing_customers_finish_loyalty_suspension
  on public.billing_customers;
create trigger billing_customers_finish_loyalty_suspension
  after insert or update of status on public.billing_customers
  for each row
  execute function private.finish_billing_loyalty_suspension();

-- 4. Admin-only manual transitions -------------------------------------------
create or replace function public.admin_suspend_merchant(
  p_merchant_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_merchant public.merchants%rowtype;
  v_suspended_at timestamptz := now();
begin
  if v_admin_id is null or not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Internal admin required';
  end if;
  if p_merchant_id is null then
    raise invalid_parameter_value using message = 'Merchant is required';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 4 and 500 then
    raise invalid_parameter_value using message = 'Suspension reason must be between 4 and 500 characters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || p_merchant_id::text, 0)
  );
  select * into v_merchant
  from public.merchants
  where id = p_merchant_id
  for update;

  if not found then raise no_data_found using message = 'Merchant not found'; end if;
  if v_merchant.status = 'suspended' then
    raise object_not_in_prerequisite_state using message = 'Merchant is already suspended';
  end if;

  update public.merchants
  set status_before_suspension = v_merchant.status,
      status = 'suspended',
      suspended_at = v_suspended_at,
      suspension_reason = btrim(p_reason),
      suspended_by = v_admin_id,
      updated_at = now()
  where id = p_merchant_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'admin', v_admin_id::text, p_merchant_id, 'merchants', p_merchant_id,
    'merchant_suspended',
    jsonb_build_object(
      'reason', btrim(p_reason),
      'status_before_suspension', v_merchant.status,
      'suspended_at', v_suspended_at
    )
  );

  perform private.enqueue_venue_paused_notices(
    p_merchant_id,
    v_suspended_at,
    'manual_suspension'
  );
end;
$function$;

create or replace function public.admin_reinstate_merchant(p_merchant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_merchant public.merchants%rowtype;
  v_reinstated_at timestamptz := now();
  v_extension_count integer;
begin
  if v_admin_id is null or not public.is_internal_admin() then
    raise insufficient_privilege using message = 'Internal admin required';
  end if;
  if p_merchant_id is null then
    raise invalid_parameter_value using message = 'Merchant is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || p_merchant_id::text, 0)
  );
  select * into v_merchant
  from public.merchants
  where id = p_merchant_id
  for update;

  if not found then raise no_data_found using message = 'Merchant not found'; end if;
  if v_merchant.status <> 'suspended' or v_merchant.suspended_at is null then
    raise object_not_in_prerequisite_state using message = 'Merchant is not suspended';
  end if;

  v_extension_count := private.extend_open_reward_expiry(
    p_merchant_id,
    v_merchant.suspended_at,
    greatest(v_reinstated_at, v_merchant.suspended_at),
    'manual:' || p_merchant_id::text || ':' || extract(epoch from v_merchant.suspended_at)::text
  );

  update public.merchants
  set status = v_merchant.status_before_suspension,
      suspended_at = null,
      suspension_reason = null,
      suspended_by = null,
      status_before_suspension = null,
      updated_at = now()
  where id = p_merchant_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'admin', v_admin_id::text, p_merchant_id, 'merchants', p_merchant_id,
    'merchant_reinstated',
    jsonb_build_object(
      'suspended_at', v_merchant.suspended_at,
      'reinstated_at', v_reinstated_at,
      'restored_status', v_merchant.status_before_suspension,
      'extended_reward_count', v_extension_count
    )
  );
end;
$function$;

revoke all on function public.admin_suspend_merchant(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_suspend_merchant(uuid, text)
  to authenticated;
revoke all on function public.admin_reinstate_merchant(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_reinstate_merchant(uuid)
  to authenticated;

-- 5. Protect every suspension field from direct owner writes -----------------
create or replace function public.enforce_merchant_business_state_protection()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_privileged boolean;
begin
  v_privileged := public.is_service_role_request()
    or public.is_internal_admin()
    or not public.has_request_context();

  if tg_op = 'INSERT' then
    if not v_privileged
       and (new.status is distinct from 'trial'
         or new.requires_billing is distinct from true
         or new.suspended_at is not null
         or new.suspension_reason is not null
         or new.suspended_by is not null
         or new.status_before_suspension is not null) then
      raise insufficient_privilege using message = 'New venues start on trial with billing required';
    end if;
    return new;
  end if;

  if new.requires_billing is not distinct from old.requires_billing
     and new.status is not distinct from old.status
     and new.suspended_at is not distinct from old.suspended_at
     and new.suspension_reason is not distinct from old.suspension_reason
     and new.suspended_by is not distinct from old.suspended_by
     and new.status_before_suspension is not distinct from old.status_before_suspension then
    return new;
  end if;

  if not v_privileged then
    raise insufficient_privilege using
      message = 'Merchant billing and suspension state cannot be changed directly';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_merchant_business_state_protection()
  from public, anon, authenticated;
grant execute on function public.enforce_merchant_business_state_protection()
  to service_role;

-- 6. Earning blocks while redemption admits only legitimate grace ------------
create or replace function public.enforce_stamp_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_requires_billing boolean;
  v_billing_status text;
  v_merchant_status text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || new.merchant_id::text, 0)
  );

  select merchants.requires_billing, merchants.status, billing.status
  into v_requires_billing, v_merchant_status, v_billing_status
  from public.merchants merchants
  left join public.billing_customers billing on billing.merchant_id = merchants.id
  where merchants.id = new.merchant_id;

  if v_merchant_status not in ('trial', 'active')
     or not public.loyalty_billing_entitled(v_requires_billing, v_billing_status) then
    raise exception 'This loyalty programme is unavailable while the venue is paused';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_stamp_billing_entitlement()
  from public, anon, authenticated;
grant execute on function public.enforce_stamp_billing_entitlement()
  to service_role;

create or replace function public.enforce_reward_billing_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_requires_billing boolean;
  v_billing_status text;
  v_merchant_status text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || new.merchant_id::text, 0)
  );

  select merchants.requires_billing, merchants.status, billing.status
  into v_requires_billing, v_merchant_status, v_billing_status
  from public.merchants merchants
  left join public.billing_customers billing on billing.merchant_id = merchants.id
  where merchants.id = new.merchant_id;

  if public.loyalty_billing_entitled(v_requires_billing, v_billing_status)
     and v_merchant_status in ('trial', 'active') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status = 'redeemed'
     and private.reward_in_suspension_grace(old.id, now()) then
    return new;
  end if;

  raise exception 'This loyalty programme is unavailable while the venue is paused';
end;
$function$;

revoke all on function public.enforce_reward_billing_entitlement()
  from public, anon, authenticated;
grant execute on function public.enforce_reward_billing_entitlement()
  to service_role;

-- 7. Suspension-aware collection state ---------------------------------------
create or replace function private.reward_collection_state(
  p_reward_id uuid,
  p_at timestamptz default now()
)
returns table (
  state text,
  reason text,
  available_from timestamptz,
  expires_at timestamptz,
  in_window boolean,
  window_id uuid,
  window_ends_at timestamptz,
  upgrade_pool_item_id uuid,
  upgrade_reward_name text,
  upgrade_reward_terms text,
  next_window_starts_at timestamptz,
  next_window_ends_at timestamptz,
  next_window_upgrade_name text
)
language plpgsql
stable
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_reward record;
  v_current_window record;
  v_upgrade record;
  v_next_window record;
  v_requires_age_check boolean;
  v_suspended_at timestamptz;
  v_in_grace boolean;
begin
  select
    rewards.status,
    rewards.source,
    rewards.created_at,
    rewards.reward_policy_version,
    rewards.reward_policy_snapshot,
    rewards.redeemable_from,
    rewards.available_from as stored_available_from,
    rewards.expires_at as stored_expires_at,
    rewards.merchant_id,
    cards.location_id,
    customers.id as customer_id,
    customers.full_name,
    customers.date_of_birth,
    customers.email,
    customers.email_verified_at,
    memberships.current_stamp_count,
    cards.stamps_required,
    cards.reward_policy_version as card_policy_version,
    public.loyalty_availability_reason(
      merchants.status, cards.is_active, billing.status, merchants.requires_billing
    ) as unavailable_reason
  into v_reward
  from public.reward_events rewards
  join public.customer_memberships memberships on memberships.id = rewards.membership_id
  join public.customers customers on customers.id = rewards.customer_id
  join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
  join public.merchants merchants on merchants.id = rewards.merchant_id
  left join public.billing_customers billing on billing.merchant_id = rewards.merchant_id
  where rewards.id = p_reward_id;

  in_window := false;
  expires_at := v_reward.stored_expires_at;
  available_from := case
    when v_reward.reward_policy_version = 'legacy_v1'
      then v_reward.redeemable_from::timestamp at time zone 'Europe/London'
    else v_reward.stored_available_from
  end;

  if not found then state := 'blocked'; reason := 'Reward not found'; return next; return; end if;

  v_suspended_at := private.merchant_suspended_at(v_reward.merchant_id);
  v_in_grace := v_suspended_at is not null
    and v_reward.status = 'unlocked'
    and v_reward.created_at < v_suspended_at
    and p_at >= v_suspended_at
    and p_at < v_suspended_at + interval '30 days';
  if v_suspended_at is not null
     and v_reward.status = 'unlocked'
     and v_reward.created_at < v_suspended_at then
    expires_at := v_suspended_at + interval '30 days';
  end if;

  if v_reward.reward_policy_version = 'v2' then
    select * into v_current_window
    from private.current_collection_window(v_reward.location_id, p_at);
    if v_current_window.window_id is not null then
      in_window := true;
      window_id := v_current_window.window_id;
      window_ends_at := v_current_window.window_ends_at;
    end if;

    select * into v_upgrade
    from private.reward_window_upgrade(p_reward_id, p_at);
    if v_upgrade.pool_item_id is not null then
      upgrade_pool_item_id := v_upgrade.pool_item_id;
      upgrade_reward_name := v_upgrade.reward_name;
      upgrade_reward_terms := v_upgrade.reward_terms;
    end if;

    select * into v_next_window
    from private.next_reward_upgrade_window(p_reward_id, p_at);
    next_window_starts_at := v_next_window.window_starts_at;
    next_window_ends_at := v_next_window.window_ends_at;
    next_window_upgrade_name := v_next_window.upgrade_reward_name;
  end if;

  if v_reward.status = 'redeemed' then state := 'redeemed'; reason := 'Reward already redeemed'; return next; return; end if;
  if v_reward.status = 'cancelled' then state := 'cancelled'; reason := 'Reward is not ready to collect'; return next; return; end if;
  if v_reward.status = 'expired' then state := 'expired'; reason := 'Reward expired'; return next; return; end if;
  if v_reward.status <> 'unlocked' then
    state := 'blocked'; reason := 'Reward is not ready to collect'; return next; return;
  end if;
  if v_suspended_at is not null
     and v_reward.created_at < v_suspended_at
     and p_at >= v_suspended_at + interval '30 days' then
    state := 'expired'; reason := 'Reward expired'; return next; return;
  end if;
  if not v_in_grace and expires_at is not null and expires_at <= p_at then
    state := 'expired'; reason := 'Reward expired'; return next; return;
  end if;
  if v_suspended_at is not null and not v_in_grace then
    state := 'blocked'; reason := 'venue_paused'; return next; return;
  end if;
  if v_reward.unavailable_reason is not null
     and not (v_in_grace and v_reward.unavailable_reason in (
       'merchant_inactive', 'billing_blocked', 'billing_required'
     )) then
    state := 'blocked'; reason := 'This loyalty programme is unavailable right now'; return next; return;
  end if;
  -- Programme availability is decided before timing: a paused or unbillable
  -- venue must not advertise a later collection time it cannot honour.
  if v_reward.reward_policy_version = 'legacy_v1'
     and v_reward.redeemable_from > public.uk_business_date(p_at) then
    state := 'waiting'; reason := 'Reward is not redeemable until the next UK business day'; return next; return;
  elsif v_reward.reward_policy_version <> 'legacy_v1'
     and available_from is not null and p_at < available_from then
    state := 'waiting'; reason := 'Reward is not ready to collect yet'; return next; return;
  end if;
  if v_reward.source = 'stamp_cycle'
     and v_reward.card_policy_version <> 'v2'
     and v_reward.current_stamp_count < v_reward.stamps_required then
    state := 'blocked'; reason := 'Reward is not ready to redeem'; return next; return;
  end if;
  if private.standard_reward_daily_cap_reached(p_reward_id, p_at) then
    state := 'blocked'; reason := 'One reward per visit day already collected'; return next; return;
  end if;
  if nullif(btrim(v_reward.email), '') is not null and v_reward.email_verified_at is null then
    state := 'blocked'; reason := 'Verified email required for reward collection'; return next; return;
  end if;
  if nullif(btrim(v_reward.full_name), '') is null
     or v_reward.date_of_birth is null
     or v_reward.date_of_birth < date '1900-01-01' then
    state := 'blocked'; reason := 'Complete your profile before redeeming'; return next; return;
  end if;

  v_requires_age_check := private.reward_effective_requires_age_check(p_reward_id, p_at);
  if v_requires_age_check
     and not public.customer_has_verified_adult_date_of_birth(v_reward.customer_id, p_at) then
    state := 'blocked'; reason := 'Customer must have verified photo ID and be 18 or over to redeem'; return next; return;
  end if;

  state := 'ready';
  reason := null;
  return next;
end;
$function$;

revoke all on function private.reward_collection_state(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- 8. Redemption serializes before eligibility reads --------------------------
create or replace function public.verify_and_collect_reward_scan_token(
  p_scan_token uuid, p_expected_date_of_birth date, p_id_confirmed boolean
)
returns table (
  reward_event_id uuid, reward_name text, membership_id uuid, new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_merchant_id uuid := private.reward_scan_owner_merchant(p_scan_token);
  v_owner_id uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_token public.reward_scan_tokens%rowtype;
  v_reason text;
  v_verified_at timestamptz := clock_timestamp();
  v_receipt_id uuid;
begin
  if p_id_confirmed is distinct from true then
    raise exception 'Confirm the in-person photo ID check before collection';
  end if;

  select * into v_token from public.reward_scan_tokens where id = p_scan_token;
  if v_token.id is null then raise exception 'Reward scan token not found'; end if;
  if v_token.merchant_id is distinct from v_merchant_id then
    raise insufficient_privilege using message = 'Reward not available to this merchant';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || v_token.merchant_id::text, 0)
  );
  select * into v_customer from public.customers where id = v_token.customer_id for update;
  perform 1 from public.reward_events where id = v_token.reward_event_id for update;
  select * into v_token from public.reward_scan_tokens where id = p_scan_token for update;
  if not found then raise exception 'Reward scan token not found'; end if;
  if v_token.merchant_id is distinct from v_merchant_id then
    raise insufficient_privilege using message = 'Reward not available to this merchant';
  end if;
  if v_token.superseded_at is not null then raise exception 'Reward scan token superseded'; end if;
  if v_token.expires_at <= now() then raise exception 'Reward scan token expired'; end if;
  if v_token.consumed_at is not null then raise exception 'Reward already collected'; end if;
  if p_expected_date_of_birth is null
     or v_customer.date_of_birth is distinct from p_expected_date_of_birth then
    raise exception 'Customer date of birth changed; refresh and check the ID again';
  end if;
  perform private.reward_scan_owner_merchant(p_scan_token);
  v_reason := private.reward_scan_token_eligibility_reason(v_token.reward_event_id);
  if v_reason is not null then raise exception '%', v_reason; end if;

  insert into private.merchant_id_verification_receipts (
    customer_id, merchant_id, owner_user_id, reward_event_id, verified_at, attestation
  ) values (
    v_customer.id, v_merchant_id, v_owner_id, v_token.reward_event_id, v_verified_at,
    'photo_id_matches_customer_dob_and_adult'
  ) returning id into v_receipt_id;

  if not public.customer_has_verified_adult_date_of_birth(v_customer.id) then
    update public.customers
    set date_of_birth_verified_at = v_verified_at,
        date_of_birth_verification_source = 'merchant_owner',
        date_of_birth_verified_by = v_owner_id
    where id = v_customer.id;
  end if;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  ) values (
    'merchant', v_owner_id::text, v_merchant_id, v_customer.id, 'customers', v_customer.id,
    'customer_date_of_birth_verified',
    jsonb_build_object(
      'verification_source', 'merchant_owner', 'receipt_id', v_receipt_id,
      'reward_id', v_token.reward_event_id, 'changed', false,
      'reason', 'In-person photo ID matches customer, stored date of birth and adult age',
      'account_already_verified', v_customer.date_of_birth_verified_at is not null
    )
  );

  return query select * from public.collect_current_reward_scan_token(p_scan_token, v_merchant_id);
end;
$function$;
revoke all on function public.verify_and_collect_reward_scan_token(uuid, date, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_and_collect_reward_scan_token(uuid, date, boolean)
  to authenticated;

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
as $function$
declare
  token_record record;
  redeem_record record;
  merchant_record record;
  v_reward_source text;
  v_reward_status text;
begin
  -- Read identifiers without row locks, then use the same order as minting,
  -- verification and customer DOB updates: customer -> reward -> token.
  select * into token_record from public.reward_scan_tokens where id = p_scan_token;
  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;
  if p_merchant_id is null
     or token_record.merchant_id is distinct from p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || token_record.merchant_id::text, 0)
  );
  perform 1 from public.customers where id = token_record.customer_id for update;
  perform 1 from public.reward_events where id = token_record.reward_event_id for update;
  select tokens.*,
         rewards.status as reward_status
  into token_record
  from public.reward_scan_tokens tokens
  join public.reward_events rewards
    on rewards.id = tokens.reward_event_id
  where tokens.id = p_scan_token
  for update of tokens;

  if token_record.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;

  if p_merchant_id is null
     or token_record.merchant_id is distinct from p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;

  if token_record.superseded_at is not null then
    raise exception 'Reward scan token superseded';
  end if;

  if token_record.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;

  if token_record.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;

  if token_record.reward_status = 'redeemed' then
    raise exception 'Reward already collected';
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
    and consumed_at is null
    and superseded_at is null;

  if not found then
    raise exception 'Reward scan token is no longer collectable';
  end if;

  select reward_events.source,
         reward_events.status
  into v_reward_source,
       v_reward_status
  from public.reward_events
  where reward_events.id = redeem_record.reward_event_id;

  if v_reward_status <> 'redeemed' then
    raise exception 'Reward collection did not complete';
  end if;

  if v_reward_source = 'stamp_cycle' then
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
        'body', redeem_record.reward_name || ' collected at '
          || coalesce(merchant_record.business_name, 'the venue') || '.',
        'url', '/card/' || redeem_record.membership_id::text,
        'rewardEventId', redeem_record.reward_event_id,
        'membershipId', redeem_record.membership_id
      ),
      jsonb_build_object(
        'source', 'collect_reward_scan_token',
        'scan_token_expiry_separate', true,
        'cycle_started', false
      )
    );
  end if;

  reward_event_id := redeem_record.reward_event_id;
  reward_name := redeem_record.reward_name;
  membership_id := redeem_record.membership_id;
  new_stamp_count := redeem_record.new_stamp_count;
  return next;
end;
$function$;

revoke all on function public.collect_reward_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.collect_reward_scan_token(uuid, uuid)
  to service_role;

create or replace function private.redeem_self_service_reward_transition(
  p_reward_event_id uuid,
  p_customer_id uuid,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := now();
  v_reward record;
  v_merchant_id uuid;
  v_collection record;
  v_upgrade record;
  v_distance numeric;
  v_geo_flagged boolean := false;
  v_owner_collection boolean := false;
  v_upgraded boolean := false;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  select rewards.merchant_id
  into v_merchant_id
  from public.reward_events rewards
  where rewards.id = p_reward_event_id;
  if v_merchant_id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-state:' || v_merchant_id::text, 0)
  );

  select rewards.id, rewards.status, rewards.source, rewards.merchant_id,
         rewards.customer_id, rewards.membership_id as reward_membership_id,
         rewards.reward_pool_item_id, rewards.reward_name as assigned_reward_name,
         rewards.reward_terms as assigned_reward_terms, customers.auth_user_id,
         cards.location_id, locations.latitude, locations.longitude,
         locations.geofence_radius_meters, locations.require_geofence,
         memberships.current_stamp_count
  into v_reward
  from public.reward_events rewards
  join public.customer_memberships memberships on memberships.id = rewards.membership_id
  join public.customers customers on customers.id = rewards.customer_id
  join public.loyalty_cards cards on cards.id = rewards.loyalty_card_id
  left join public.merchant_locations locations on locations.id = cards.location_id
  where rewards.id = p_reward_event_id
  for update of rewards, memberships;

  if v_reward.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;
  if v_reward.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  v_owner_collection := coalesce(private.has_current_owner_id_check(
    p_reward_event_id, p_customer_id, v_user_id
  ), false);
  if not public.is_service_role_request() and not v_owner_collection and (
    v_user_id is null or v_reward.auth_user_id is null or v_reward.auth_user_id <> v_user_id
  ) then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  reward_event_id := v_reward.id;
  reward_name := v_reward.assigned_reward_name;
  membership_id := v_reward.reward_membership_id;
  if v_reward.status = 'redeemed' then
    new_stamp_count := v_reward.current_stamp_count;
    return next;
    return;
  end if;

  select * into v_collection
  from private.reward_collection_state(p_reward_event_id, v_now);
  if v_collection.state <> 'ready' then
    if v_collection.reason = 'One reward per visit day already collected' then
      raise exception '%', v_collection.reason using errcode = 'NBR01';
    end if;
    raise exception '%', coalesce(v_collection.reason, 'Reward is not redeemable');
  end if;

  select * into v_upgrade
  from private.reward_window_upgrade(p_reward_event_id, v_now);
  if v_upgrade.pool_item_id is not null then
    perform 1
    from public.venue_collection_windows windows
    join public.reward_pool_items items
      on items.id = v_upgrade.pool_item_id
     and items.merchant_id = windows.merchant_id
     and items.location_id = windows.location_id
     and items.is_active
    where windows.id = v_upgrade.window_id
      and windows.is_active
      and windows.location_id = v_reward.location_id
    for share of windows, items;
    if found then
      v_upgraded := true;
    end if;
  end if;

  if coalesce(v_reward.require_geofence, false) then
    if p_latitude is null or p_longitude is null
       or v_reward.latitude is null or v_reward.longitude is null then
      v_geo_flagged := true;
      perform public.record_self_service_geo_flag(
        v_reward.merchant_id, v_reward.customer_id, v_reward.reward_membership_id,
        v_reward.location_id, 'self_service_geofence_unknown', 'reward_redeem',
        p_latitude, p_longitude, null, v_reward.geofence_radius_meters
      );
    else
      v_distance := public.geo_distance_meters(
        p_latitude, p_longitude, v_reward.latitude, v_reward.longitude
      );
      if v_distance > v_reward.geofence_radius_meters then
        v_geo_flagged := true;
        perform public.record_self_service_geo_flag(
          v_reward.merchant_id, v_reward.customer_id, v_reward.reward_membership_id,
          v_reward.location_id, 'self_service_geofence_out_of_range', 'reward_redeem',
          p_latitude, p_longitude, v_distance, v_reward.geofence_radius_meters
        );
      end if;
    end if;
  end if;

  update public.reward_events rewards
  set status = 'redeemed',
      redeemed_at = v_now,
      reward_pool_item_id = case
        when v_upgraded then v_upgrade.pool_item_id else rewards.reward_pool_item_id end,
      reward_name = case
        when v_upgraded then v_upgrade.reward_name else rewards.reward_name end,
      reward_terms = case
        when v_upgraded then v_upgrade.reward_terms else rewards.reward_terms end,
      reward_policy_snapshot = case
        when v_upgraded then rewards.reward_policy_snapshot || jsonb_build_object(
          'age_check', v_upgrade.requires_age_check
        )
        else rewards.reward_policy_snapshot
      end,
      metadata = rewards.metadata || jsonb_strip_nulls(jsonb_build_object(
        'redeemed_by', case when v_owner_collection then 'merchant_scan' else 'self_service' end,
        'geo_flagged', v_geo_flagged,
        'upgraded_from', case when v_upgraded then v_reward.reward_pool_item_id end,
        'upgraded_in_window_id', case when v_upgraded then v_upgrade.window_id end,
        'upgraded_at', case when v_upgraded then v_now end
      ))
  where rewards.id = v_reward.id and rewards.status = 'unlocked'
  returning rewards.reward_name into reward_name;
  if not found then raise exception 'Reward already redeemed'; end if;

  update public.customer_memberships memberships
  set total_rewards_redeemed = memberships.total_rewards_redeemed + 1
  where memberships.id = v_reward.reward_membership_id
  returning memberships.current_stamp_count into new_stamp_count;

  if v_upgraded then
    perform public.enqueue_notification_event(
      'reward_upgraded',
      v_reward.customer_id,
      v_reward.merchant_id,
      v_reward.reward_membership_id,
      v_reward.id,
      null,
      public.venue_trading_date(v_reward.merchant_id, v_now),
      v_now,
      'reward_upgraded:' || v_reward.id::text,
      jsonb_build_object(
        'title', 'Reward upgraded',
        'body', reward_name,
        'url', '/home/rewards',
        'rewardEventId', v_reward.id,
        'rewardName', reward_name
      ),
      jsonb_build_object(
        'source', 'collection_window',
        'window_id', v_upgrade.window_id,
        'upgraded_from', v_reward.reward_pool_item_id,
        'upgraded_to', v_upgrade.pool_item_id
      )
    );
  end if;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  ) values (
    'reward_redeemed', v_reward.merchant_id, v_reward.customer_id,
    v_reward.reward_membership_id,
    case when v_owner_collection then 'merchant' else 'customer' end,
    coalesce(v_user_id::text, p_customer_id::text),
    jsonb_strip_nulls(jsonb_build_object(
      'reward_id', v_reward.id,
      'reward_name', reward_name,
      'source', v_reward.source,
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged,
      'upgraded', v_upgraded,
      'upgraded_from', case when v_upgraded then v_reward.reward_pool_item_id end,
      'upgraded_to', case when v_upgraded then v_upgrade.pool_item_id end,
      'window_id', case when v_upgraded then v_upgrade.window_id end
    ))
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id,
    target_table, target_id, action, metadata
  ) values (
    case when v_owner_collection then 'merchant' else 'customer' end,
    coalesce(v_user_id::text, p_customer_id::text), v_reward.merchant_id,
    v_reward.customer_id, 'reward_events', v_reward.id, 'reward_redeemed',
    jsonb_strip_nulls(jsonb_build_object(
      'source', v_reward.source,
      'new_stamp_count', new_stamp_count,
      'geo_flagged', v_geo_flagged,
      'upgraded', v_upgraded,
      'upgraded_from', case when v_upgraded then v_reward.reward_pool_item_id end,
      'upgraded_to', case when v_upgraded then v_upgrade.pool_item_id end,
      'window_id', case when v_upgraded then v_upgrade.window_id end
    ))
  );

  return next;
end;
$function$;

revoke all on function private.redeem_self_service_reward_transition(uuid, uuid, numeric, numeric)
  from public, anon, authenticated, service_role;

-- 9. Stored deadlines cannot bypass suspension grace -------------------------
create or replace function public.prevent_expired_reward_redemption()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.status = 'redeemed'
    and old.status <> 'redeemed'
    and coalesce(new.expires_at, old.expires_at) is not null
    and coalesce(new.expires_at, old.expires_at) <= now()
    and not private.reward_in_suspension_grace(old.id, now()) then
    raise exception 'Reward has expired';
  end if;

  return new;
end;
$function$;

revoke all on function public.prevent_expired_reward_redemption()
  from public, anon, authenticated, service_role;

create or replace function public.prevent_expired_reward_scan_token()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_expires_at timestamptz;
  v_grace_until timestamptz;
begin
  select reward_events.expires_at
  into v_expires_at
  from public.reward_events
  where reward_events.id = new.reward_event_id;

  if v_expires_at is not null and v_expires_at <= now() then
    if not private.reward_in_suspension_grace(new.reward_event_id, now()) then
      raise exception 'Reward has expired';
    end if;
    v_grace_until := private.reward_redemption_grace_until(new.reward_event_id);
    new.expires_at := least(now() + interval '10 minutes', v_grace_until);
  end if;

  return new;
end;
$function$;

revoke all on function public.prevent_expired_reward_scan_token()
  from public, anon, authenticated, service_role;

-- 10. Expiry honours the full grace and closes it deterministically -----------
create or replace function public.expire_due_reward_events(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  expired_reward record;
  v_count integer := 0;
begin
  perform public.release_completed_cycles_without_reward();

  for expired_reward in
    update public.reward_events rewards
    set status = 'expired',
        expired_at = coalesce(rewards.expired_at, p_now),
        metadata = rewards.metadata || jsonb_build_object(
          'expired_by', case
            when private.merchant_suspended_at(rewards.merchant_id) is not null
             and rewards.created_at < private.merchant_suspended_at(rewards.merchant_id)
             and p_now >= private.merchant_suspended_at(rewards.merchant_id) + interval '30 days'
              then 'suspension_grace_elapsed'
            else 'scheduled_notification_worker'
          end
        )
    where rewards.status = 'unlocked'
      and (
        (
          private.merchant_suspended_at(rewards.merchant_id) is null
          and rewards.expires_at is not null
          and rewards.expires_at <= p_now
        )
        or (
          private.merchant_suspended_at(rewards.merchant_id) is not null
          and rewards.created_at < private.merchant_suspended_at(rewards.merchant_id)
          and p_now >= private.merchant_suspended_at(rewards.merchant_id) + interval '30 days'
        )
        or (
          private.merchant_suspended_at(rewards.merchant_id) is not null
          and rewards.created_at >= private.merchant_suspended_at(rewards.merchant_id)
          and rewards.expires_at is not null
          and rewards.expires_at <= p_now
        )
      )
    returning rewards.*
  loop
    v_count := v_count + 1;

    if expired_reward.source = 'stamp_cycle' then
      update public.customer_memberships memberships
      set total_rewards_expired = memberships.total_rewards_expired + 1
      where memberships.id = expired_reward.membership_id;

      insert into public.audit_logs (
        actor_type, actor_id, merchant_id, customer_id,
        target_table, target_id, action, metadata
      ) values (
        'system', 'system', expired_reward.merchant_id, expired_reward.customer_id,
        'reward_events', expired_reward.id, 'reward_expired',
        jsonb_build_object(
          'membership_id', expired_reward.membership_id,
          'cycle_number', expired_reward.cycle_number,
          'expires_at', expired_reward.expires_at,
          'expired_by', expired_reward.metadata ->> 'expired_by'
        )
      );
    end if;

    perform public.enqueue_notification_event(
      'reward_expired',
      expired_reward.customer_id,
      expired_reward.merchant_id,
      expired_reward.membership_id,
      expired_reward.id,
      expired_reward.cycle_number,
      public.uk_business_date(p_now),
      p_now,
      'reward_expired:' || expired_reward.id::text,
      jsonb_build_object(
        'title', 'Reward expired',
        'body', expired_reward.reward_name,
        'url', '/home/rewards',
        'rewardEventId', expired_reward.id
      ),
      jsonb_build_object(
        'source', 'reward_expiry',
        'expired_by', expired_reward.metadata ->> 'expired_by'
      )
    );
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.expire_due_reward_events(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_due_reward_events(timestamptz)
  to service_role;

notify pgrst, 'reload schema';
