-- Commercial growth controls:
--   * governed, reproducible case-study evidence with recorded approval;
--   * merchant cancellation interviews before the Stripe cancellation flow;
--   * new annual Checkout attempts pay the launch fee separately, matching the
--     public £299.99 launch + 28-day pilot + £699.90 annual offer.

create table if not exists public.commercial_evidence_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  source_kind text not null check (source_kind in (
    'onboarding_call', 'support_call', 'dashboard_win',
    'testimonial_campaign', 'merchant_submission'
  )),
  status text not null default 'draft' check (status in (
    'draft', 'published', 'withdrawn'
  )),
  attribution_name text,
  before_summary text not null,
  after_summary text not null,
  testimonial_quote text,
  measurement_start date not null,
  measurement_end date not null,
  new_members integer not null check (new_members >= 0),
  normal_visit_stamps integer not null check (normal_visit_stamps >= 0),
  verified_return_visits integer not null check (verified_return_visits >= 0),
  rewards_redeemed integer not null check (rewards_redeemed >= 0),
  metric_definition_version text not null,
  metric_snapshot_hash text not null,
  metric_snapshot_at timestamptz not null,
  source_reference text not null,
  asset_reference text,
  approval_reference text,
  merchant_approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint commercial_evidence_measurement_window_valid
    check (
      measurement_end >= measurement_start
      and measurement_end <= measurement_start + 366
    ),
  constraint commercial_evidence_copy_bounded
    check (
      length(btrim(before_summary)) between 1 and 1200
      and length(btrim(after_summary)) between 1 and 1200
      and length(coalesce(testimonial_quote, '')) <= 600
      and length(coalesce(attribution_name, '')) <= 160
      and length(btrim(source_reference)) between 1 and 500
      and length(coalesce(asset_reference, '')) <= 500
      and length(coalesce(approval_reference, '')) <= 500
    ),
  constraint commercial_evidence_publication_valid
    check (
      status <> 'published'
      or (
        nullif(btrim(attribution_name), '') is not null
        and nullif(btrim(approval_reference), '') is not null
        and merchant_approved_at is not null
        and published_at is not null
        and withdrawn_at is null
      )
    ),
  constraint commercial_evidence_withdrawal_valid
    check (
      status <> 'withdrawn'
      or (withdrawn_at is not null and published_at is not null)
    )
);

create index if not exists commercial_evidence_cases_status_published_idx
  on public.commercial_evidence_cases (status, published_at desc)
  where status = 'published';

create index if not exists commercial_evidence_cases_merchant_created_idx
  on public.commercial_evidence_cases (merchant_id, created_at desc);

-- The evidence snapshot is an occasional admin operation, but it must remain
-- bounded to the selected merchant and measurement window as ledgers grow.
create index if not exists stamp_events_commercial_evidence_idx
  on public.stamp_events (merchant_id, earned_business_date, membership_id)
  where event_type = 'earned'
    and stamps_delta > 0
    and earned_business_date is not null;

alter table public.commercial_evidence_cases enable row level security;
alter table public.commercial_evidence_cases force row level security;

drop policy if exists commercial_evidence_admin_read
  on public.commercial_evidence_cases;
create policy commercial_evidence_admin_read
  on public.commercial_evidence_cases
  for select
  to authenticated
  using ((select public.is_internal_admin()));

create table if not exists public.merchant_cancellation_interviews (
  id uuid primary key default extensions.gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  stripe_subscription_id text not null,
  primary_reason text not null check (primary_reason in (
    'price', 'not_using', 'missing_feature', 'technical_issue',
    'poor_results', 'seasonal_pause', 'closing', 'other'
  )),
  details text,
  requested_resolution text not null check (requested_resolution in (
    'continue_cancellation', 'support_call'
  )),
  status text not null check (status in ('portal_opened', 'follow_up_requested')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default transaction_timestamp(),
  portal_opened_at timestamptz,
  constraint cancellation_interview_portal_state_valid
    check (
      (status = 'portal_opened') = (portal_opened_at is not null)
    )
);

create index if not exists merchant_cancellation_interviews_merchant_created_idx
  on public.merchant_cancellation_interviews (merchant_id, created_at desc);

alter table public.merchant_cancellation_interviews enable row level security;
alter table public.merchant_cancellation_interviews force row level security;

drop policy if exists cancellation_interviews_merchant_read
  on public.merchant_cancellation_interviews;
create policy cancellation_interviews_merchant_read
  on public.merchant_cancellation_interviews
  for select
  to authenticated
  using (
    (select public.is_merchant_owner(merchant_id))
    or (select public.is_internal_admin())
  );

create or replace function public.admin_capture_commercial_evidence_case(
  p_merchant_id uuid,
  p_source_kind text,
  p_before_summary text,
  p_after_summary text,
  p_testimonial_quote text,
  p_attribution_name text,
  p_measurement_start date,
  p_measurement_end date,
  p_source_reference text,
  p_asset_reference text,
  p_approval_reference text,
  p_merchant_approved boolean,
  p_publish boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_admin_id uuid := (select auth.uid());
  v_case_id uuid;
  v_new_members integer;
  v_normal_visit_stamps integer;
  v_verified_return_visits integer;
  v_rewards_redeemed integer;
  v_snapshot_at timestamptz := transaction_timestamp();
  v_definition text := 'normal-return-visits-v1';
  v_hash text;
begin
  if v_admin_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_merchant_id is null
    or not exists (select 1 from public.merchants where id = p_merchant_id)
    or p_source_kind not in (
      'onboarding_call', 'support_call', 'dashboard_win',
      'testimonial_campaign', 'merchant_submission'
    )
    or nullif(btrim(p_before_summary), '') is null
    or nullif(btrim(p_after_summary), '') is null
    or nullif(btrim(p_source_reference), '') is null
    or length(p_before_summary) > 1200
    or length(p_after_summary) > 1200
    or length(coalesce(p_testimonial_quote, '')) > 600
    or length(coalesce(p_attribution_name, '')) > 160
    or length(p_source_reference) > 500
    or length(coalesce(p_asset_reference, '')) > 500
    or length(coalesce(p_approval_reference, '')) > 500
    or p_measurement_start is null
    or p_measurement_end is null
    or p_measurement_end < p_measurement_start
    or p_measurement_end > p_measurement_start + 366
    or (p_publish and (
      not p_merchant_approved
      or nullif(btrim(p_attribution_name), '') is null
      or nullif(btrim(p_approval_reference), '') is null
    )) then
    raise invalid_parameter_value using message = 'Invalid commercial evidence case';
  end if;

  select count(*)::integer
  into v_new_members
  from public.customer_memberships as memberships
  where memberships.merchant_id = p_merchant_id
    and (memberships.created_at at time zone 'Europe/London')::date
      between p_measurement_start and p_measurement_end;

  select count(*)::integer
  into v_normal_visit_stamps
  from public.stamp_events as events
  where events.merchant_id = p_merchant_id
    and events.event_type = 'earned'
    and events.stamps_delta > 0
    and events.earned_business_date
      between p_measurement_start and p_measurement_end;

  select count(*)::integer
  into v_verified_return_visits
  from public.stamp_events as events
  where events.merchant_id = p_merchant_id
    and events.event_type = 'earned'
    and events.stamps_delta > 0
    and events.earned_business_date
      between p_measurement_start and p_measurement_end
    and exists (
      select 1
      from public.stamp_events as prior
      where prior.membership_id = events.membership_id
        and prior.event_type = 'earned'
        and prior.stamps_delta > 0
        and prior.earned_business_date < events.earned_business_date
    );

  select count(*)::integer
  into v_rewards_redeemed
  from public.reward_events as rewards
  where rewards.merchant_id = p_merchant_id
    and rewards.status = 'redeemed'
    and (coalesce(rewards.redeemed_at, rewards.updated_at)
      at time zone 'Europe/London')::date
      between p_measurement_start and p_measurement_end;

  v_hash := encode(extensions.digest(
    pg_catalog.jsonb_build_object(
      'definition', v_definition,
      'merchant_id', p_merchant_id,
      'measurement_start', p_measurement_start,
      'measurement_end', p_measurement_end,
      'new_members', v_new_members,
      'normal_visit_stamps', v_normal_visit_stamps,
      'verified_return_visits', v_verified_return_visits,
      'rewards_redeemed', v_rewards_redeemed
    )::text,
    'sha256'
  ), 'hex');

  insert into public.commercial_evidence_cases (
    merchant_id,
    source_kind,
    status,
    attribution_name,
    before_summary,
    after_summary,
    testimonial_quote,
    measurement_start,
    measurement_end,
    new_members,
    normal_visit_stamps,
    verified_return_visits,
    rewards_redeemed,
    metric_definition_version,
    metric_snapshot_hash,
    metric_snapshot_at,
    source_reference,
    asset_reference,
    approval_reference,
    merchant_approved_at,
    created_by,
    published_at
  ) values (
    p_merchant_id,
    p_source_kind,
    case when p_publish then 'published' else 'draft' end,
    nullif(btrim(p_attribution_name), ''),
    btrim(p_before_summary),
    btrim(p_after_summary),
    nullif(btrim(p_testimonial_quote), ''),
    p_measurement_start,
    p_measurement_end,
    v_new_members,
    v_normal_visit_stamps,
    v_verified_return_visits,
    v_rewards_redeemed,
    v_definition,
    v_hash,
    v_snapshot_at,
    btrim(p_source_reference),
    nullif(btrim(p_asset_reference), ''),
    nullif(btrim(p_approval_reference), ''),
    case when p_merchant_approved then v_snapshot_at else null end,
    v_admin_id,
    case when p_publish then v_snapshot_at else null end
  ) returning id into v_case_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'admin', v_admin_id::text, p_merchant_id,
    'commercial_evidence_cases', v_case_id,
    case when p_publish then 'commercial_evidence_published'
      else 'commercial_evidence_drafted' end,
    pg_catalog.jsonb_build_object(
      'source_kind', p_source_kind,
      'measurement_start', p_measurement_start,
      'measurement_end', p_measurement_end,
      'metric_definition_version', v_definition,
      'metric_snapshot_hash', v_hash,
      'merchant_approved', p_merchant_approved
    )
  );

  return v_case_id;
end
$function$;

create or replace function public.record_merchant_cancellation_interview(
  p_merchant_id uuid,
  p_primary_reason text,
  p_details text,
  p_requested_resolution text
)
returns table (
  interview_id uuid,
  stripe_subscription_id text,
  should_open_portal boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_subscription_id text;
  v_interview_id uuid;
  v_open_portal boolean;
begin
  if v_user_id is null
    or p_merchant_id is null
    or not (select public.is_merchant_owner(p_merchant_id))
    or p_primary_reason not in (
      'price', 'not_using', 'missing_feature', 'technical_issue',
      'poor_results', 'seasonal_pause', 'closing', 'other'
    )
    or p_requested_resolution not in (
      'continue_cancellation', 'support_call'
    )
    or length(coalesce(p_details, '')) > 2000 then
    raise invalid_parameter_value using message = 'Invalid cancellation interview';
  end if;

  select customers.stripe_subscription_id
  into v_subscription_id
  from public.billing_customers as customers
  where customers.merchant_id = p_merchant_id
    and customers.stripe_subscription_id is not null
    and customers.status in ('trialing', 'active', 'past_due')
  for update;

  if nullif(btrim(v_subscription_id), '') is null then
    raise object_not_in_prerequisite_state using message = 'No cancellable subscription';
  end if;

  v_open_portal := p_requested_resolution = 'continue_cancellation';

  insert into public.merchant_cancellation_interviews (
    merchant_id,
    stripe_subscription_id,
    primary_reason,
    details,
    requested_resolution,
    status,
    created_by,
    portal_opened_at
  ) values (
    p_merchant_id,
    v_subscription_id,
    p_primary_reason,
    nullif(btrim(p_details), ''),
    p_requested_resolution,
    case when v_open_portal then 'portal_opened' else 'follow_up_requested' end,
    v_user_id,
    case when v_open_portal then transaction_timestamp() else null end
  ) returning id into v_interview_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', v_user_id::text, p_merchant_id,
    'merchant_cancellation_interviews', v_interview_id,
    'merchant_cancellation_interview_recorded',
    pg_catalog.jsonb_build_object(
      'primary_reason', p_primary_reason,
      'requested_resolution', p_requested_resolution,
      'portal_opened', v_open_portal
    )
  );

  return query select v_interview_id, v_subscription_id, v_open_portal;
end
$function$;

revoke all on table public.commercial_evidence_cases from public, anon, authenticated;
revoke all on table public.merchant_cancellation_interviews from public, anon, authenticated;
grant select on table public.commercial_evidence_cases
  to authenticated, service_role;
grant select on table public.merchant_cancellation_interviews
  to authenticated, service_role;

revoke all on function public.admin_capture_commercial_evidence_case(
  uuid, text, text, text, text, text, date, date, text, text, text, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.admin_capture_commercial_evidence_case(
  uuid, text, text, text, text, text, date, date, text, text, text, boolean, boolean
) to authenticated, service_role;

revoke all on function public.record_merchant_cancellation_interview(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_merchant_cancellation_interview(
  uuid, text, text, text
) to authenticated, service_role;

-- A new annual sale no longer bundles the launch. Both current cadences charge
-- the same one-time launch Price unless it was already satisfied. The legacy
-- annual_included state remains valid for historical attempts/readback.
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
          billing_interval in ('month', 'year')
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
  elsif v_attempt.billing_interval in ('month', 'year') then
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

revoke all on function public.bind_billing_checkout_offer(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.bind_billing_checkout_offer(uuid, uuid, uuid, text)
  to service_role;
