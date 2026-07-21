-- DeepSec consistency closure:
--   * update reward activation without replaying stale row fields;
--   * re-check stale-customer eligibility while the identity is locked;
--   * claim each merchant/week digest before contacting the email provider.

create or replace function public.set_reward_pool_item_active(
  p_merchant_id uuid,
  p_loyalty_card_id uuid,
  p_reward_pool_item_id uuid,
  p_is_active boolean
)
returns table (reward_pool_item_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth
as $function$
#variable_conflict use_column
declare
  v_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select public.is_merchant_owner(p_merchant_id)) then
    raise insufficient_privilege using message = 'Merchant ownership required';
  end if;

  select cards.location_id
  into v_location_id
  from public.loyalty_cards as cards
  where cards.id = p_loyalty_card_id
    and cards.merchant_id = p_merchant_id
  for update of cards;

  if v_location_id is null then
    raise insufficient_privilege using message = 'Loyalty card not found for merchant';
  end if;

  update public.reward_pool_items as items
  set is_active = p_is_active
  where items.id = p_reward_pool_item_id
    and items.merchant_id = p_merchant_id
    and items.location_id = v_location_id
    and items.loyalty_card_id = p_loyalty_card_id
  returning items.id into reward_pool_item_id;

  if reward_pool_item_id is null then
    raise insufficient_privilege using message = 'Reward pool item not found for merchant';
  end if;

  perform public.assert_reward_pool_launch_ready(
    p_merchant_id,
    p_loyalty_card_id,
    v_location_id
  );

  saved_action := case
    when p_is_active then 'reward_pool_item_activated'
    else 'reward_pool_item_deactivated'
  end;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    saved_action,
    p_merchant_id,
    'merchant',
    (select auth.uid())::text,
    pg_catalog.jsonb_build_object(
      'loyalty_card_id', p_loyalty_card_id,
      'reward_pool_item_id', reward_pool_item_id,
      'is_active', p_is_active
    )
  );

  insert into public.audit_logs (
    actor_type,
    actor_id,
    merchant_id,
    target_table,
    target_id,
    action,
    metadata
  )
  values (
    'merchant',
    (select auth.uid())::text,
    p_merchant_id,
    'reward_pool_items',
    reward_pool_item_id,
    saved_action,
    pg_catalog.jsonb_build_object('loyalty_card_id', p_loyalty_card_id)
  );

  return next;
end;
$function$;

revoke all on function public.set_reward_pool_item_active(uuid, uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_reward_pool_item_active(uuid, uuid, uuid, boolean)
  to authenticated, service_role;

create or replace function public.admin_purge_stale_customer_pii(
  p_cutoff timestamp with time zone default (now() - '365 days'::interval)
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  stale_customer record;
  purged_count integer := 0;
  v_phone_hmac text;
  v_email_hmac text;
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'admin_purge_stale_customer_pii requires the service role';
  end if;

  perform set_config('app.customer_erasure', 'true', true);

  for stale_customer in
    select customers.id
    from public.customers
    where customers.updated_at < p_cutoff
      and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = customers.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = customers.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = customers.id
          and stamp_events.created_at >= p_cutoff
      )
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('customer-identity:' || stale_customer.id::text, 0)
    );

    select customers.phone_hmac, customers.email_hmac
    into v_phone_hmac, v_email_hmac
    from public.customers
    where customers.id = stale_customer.id
    for update;

    update public.customers as target
    set auth_user_id = null,
        email = 'erased+' || replace(stale_customer.id::text, '-', '') || '@privacy.invalid',
        email_hmac = null,
        email_verified_at = null,
        full_name = null,
        date_of_birth = null,
        phone_hmac = null,
        phone_ciphertext = null,
        phone_last4 = null,
        phone_country = null,
        phone_verified_at = null,
        updated_at = now()
    where target.id = stale_customer.id
      and target.updated_at < p_cutoff
      and coalesce(target.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = stale_customer.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = stale_customer.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = stale_customer.id
          and stamp_events.created_at >= p_cutoff
      );

    if not found then
      continue;
    end if;

    update public.customer_sessions
    set revoked_at = now()
    where customer_id = stale_customer.id
      and revoked_at is null;

    update public.push_subscriptions
    set enabled = false,
        revoked_at = coalesce(revoked_at, now()),
        updated_at = now()
    where customer_id = stale_customer.id;

    update public.notification_events
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now(),
        metadata = metadata || jsonb_build_object('cancelled_reason', 'customer_erased')
    where customer_id = stale_customer.id
      and status in ('queued', 'delivering');

    update public.pending_reward_invites
    set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
        email_hmac = null,
        phone_hmac = null,
        email_masked = null,
        phone_last4 = null,
        claim_token_hash = 'scrubbed:' || id::text,
        updated_at = now()
    where matched_customer_id = stale_customer.id
       or attached_customer_id = stale_customer.id
       or (v_phone_hmac is not null and phone_hmac = v_phone_hmac)
       or (v_email_hmac is not null and email_hmac = v_email_hmac);

    purged_count := purged_count + 1;
  end loop;

  perform set_config('app.customer_erasure', '', true);
  return purged_count;
end;
$function$;

revoke execute on function public.admin_purge_stale_customer_pii(timestamp with time zone)
  from public, anon, authenticated;
grant execute on function public.admin_purge_stale_customer_pii(timestamp with time zone)
  to service_role;

create table if not exists public.merchant_weekly_digest_runs (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  period_start date not null,
  status text not null check (status in ('processing', 'sent', 'failed')),
  lease_id uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (merchant_id, period_start),
  check (
    (status = 'processing' and lease_id is not null and lease_expires_at is not null)
    or (status in ('sent', 'failed'))
  )
);

alter table public.merchant_weekly_digest_runs enable row level security;
alter table public.merchant_weekly_digest_runs force row level security;
revoke all on table public.merchant_weekly_digest_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.merchant_weekly_digest_runs to service_role;

create or replace function public.claim_merchant_weekly_digest(
  p_merchant_id uuid,
  p_period_start date,
  p_now timestamptz default now()
)
returns table (claim_status text, claim_lease_id uuid, attempt_count integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_lease_id uuid := gen_random_uuid();
  v_status text;
  v_expires_at timestamptz;
  v_attempt_count integer;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  insert into public.merchant_weekly_digest_runs (
    merchant_id,
    period_start,
    status,
    lease_id,
    lease_expires_at,
    attempt_count
  )
  values (
    p_merchant_id,
    p_period_start,
    'processing',
    v_lease_id,
    p_now + interval '10 minutes',
    1
  )
  on conflict (merchant_id, period_start) do nothing;

  if found then
    return query select 'claimed'::text, v_lease_id, 1;
    return;
  end if;

  select runs.status, runs.lease_expires_at, runs.attempt_count
  into v_status, v_expires_at, v_attempt_count
  from public.merchant_weekly_digest_runs as runs
  where runs.merchant_id = p_merchant_id
    and runs.period_start = p_period_start
  for update;

  if v_status = 'sent' then
    return query select 'sent'::text, null::uuid, v_attempt_count;
    return;
  end if;

  if v_status = 'failed' or v_expires_at <= p_now then
    update public.merchant_weekly_digest_runs as runs
    set status = 'processing',
        lease_id = v_lease_id,
        lease_expires_at = p_now + interval '10 minutes',
        attempt_count = runs.attempt_count + 1,
        last_error_code = null,
        updated_at = p_now
    where runs.merchant_id = p_merchant_id
      and runs.period_start = p_period_start
    returning runs.attempt_count into v_attempt_count;

    return query select 'claimed'::text, v_lease_id, v_attempt_count;
    return;
  end if;

  return query select 'busy'::text, null::uuid, v_attempt_count;
end;
$function$;

create or replace function public.complete_merchant_weekly_digest(
  p_merchant_id uuid,
  p_period_start date,
  p_lease_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  update public.merchant_weekly_digest_runs
  set status = 'sent',
      lease_id = null,
      lease_expires_at = null,
      sent_at = p_now,
      updated_at = p_now
  where merchant_id = p_merchant_id
    and period_start = p_period_start
    and status = 'processing'
    and lease_id = p_lease_id;

  return found;
end;
$function$;

create or replace function public.fail_merchant_weekly_digest(
  p_merchant_id uuid,
  p_period_start date,
  p_lease_id uuid,
  p_error_code text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  update public.merchant_weekly_digest_runs
  set status = 'failed',
      lease_id = null,
      lease_expires_at = null,
      last_error_code = left(coalesce(p_error_code, 'send_failed'), 80),
      updated_at = p_now
  where merchant_id = p_merchant_id
    and period_start = p_period_start
    and status = 'processing'
    and lease_id = p_lease_id;

  return found;
end;
$function$;

revoke all on function public.claim_merchant_weekly_digest(uuid, date, timestamptz)
  from public, anon, authenticated;
revoke all on function public.complete_merchant_weekly_digest(uuid, date, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.fail_merchant_weekly_digest(uuid, date, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_merchant_weekly_digest(uuid, date, timestamptz)
  to service_role;
grant execute on function public.complete_merchant_weekly_digest(uuid, date, uuid, timestamptz)
  to service_role;
grant execute on function public.fail_merchant_weekly_digest(uuid, date, uuid, text, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
