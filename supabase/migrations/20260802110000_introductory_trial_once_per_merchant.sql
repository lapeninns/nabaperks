-- The 28-day introductory trial is a once-per-merchant benefit.
--
-- lib/stripe/checkout.ts hardcodes `trial_period_days: 28` on every Checkout
-- Session. Restarting after cancellation is intentionally supported
-- (classifyCheckoutEligibility returns allowed for 'cancelled', and
-- claim_billing_checkout_attempt carries the durable Stripe customer forward),
-- and the launch fee is correctly remembered as 'previously_satisfied' — but
-- nothing recorded that the TRIAL had already been consumed. A merchant could
-- therefore cancel and restart indefinitely, taking a fresh 28 free days each
-- time while never paying.
--
-- Current subscription status cannot be the test: 'cancelled' is exactly the
-- state a returning merchant is in. Only a durable ledger works. This mirrors
-- launch_fee_status (20260731120000), the in-repo precedent for a lifetime
-- benefit ledger, including its "policy decided at bind, stored on the attempt"
-- shape — eligibility MUST be frozen into the attempt because Stripe rejects a
-- conflicting request body for an already-used idempotency key
-- (`billing-checkout:<attemptId>`), so a retry must rebuild byte-identically.
--
-- Closes: billing-repeatable-stripe-trial.

alter table public.billing_customers
  add column if not exists introductory_trial_status text
    check (introductory_trial_status in ('consumed', 'grandfathered')),
  add column if not exists introductory_trial_consumed_at timestamptz;

alter table public.billing_checkout_attempts
  add column if not exists trial_policy text
    check (trial_policy in ('introductory_28_day', 'not_eligible'));

-- Conservative backfill: any merchant with an existing Stripe subscription has
-- already been through Checkout, so mark them 'grandfathered'. Deliberately NOT
-- inspecting whether that subscription actually carried a trial — the failure
-- direction matters. Marking a never-trialled merchant ineligible costs them a
-- promotion; leaving a trialled merchant eligible reopens the finding.
update public.billing_customers
set introductory_trial_status = 'grandfathered',
    introductory_trial_consumed_at = coalesce(stripe_subscription_created_at, created_at)
where introductory_trial_status is null
  and stripe_subscription_id is not null;

/**
 * Record that this merchant's introductory trial has been used.
 *
 * Deliberately NOT guarded on current subscription status: a cancellation
 * sighting is the exact case this exists for, and a consumed trial can never be
 * un-consumed. Idempotent — first write wins, so the timestamp is the earliest
 * evidence.
 */
create or replace function public.consume_merchant_introductory_trial(
  p_merchant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_service_role_request() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Service role required';
  end if;

  if p_merchant_id is null then return false; end if;

  update public.billing_customers
  set introductory_trial_status = 'consumed',
      introductory_trial_consumed_at = coalesce(introductory_trial_consumed_at, now()),
      updated_at = now()
  where merchant_id = p_merchant_id
    and introductory_trial_status is null;

  return found;
end;
$$;

revoke all on function public.consume_merchant_introductory_trial(uuid)
  from public, anon, authenticated;
grant execute on function public.consume_merchant_introductory_trial(uuid) to service_role;

-- The return type gains a column, so replace is impossible.
drop function if exists public.bind_billing_checkout_offer(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.bind_billing_checkout_offer(p_merchant_id uuid, p_attempt_id uuid, p_worker_lease_id uuid, p_configured_launch_price_id text)
 RETURNS TABLE(bind_status text, launch_fee_policy text, stripe_launch_price_id text, trial_policy text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_attempt public.billing_checkout_attempts%rowtype;
  v_launch_fee_status text;
  v_trial_status text;
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
    return query select 'conflict'::text, null::text, null::text, null::text;
    return;
  end if;

  if v_attempt.checkout_offer_bound then
    return query select
      'existing'::text,
      v_attempt.launch_fee_policy,
      v_attempt.stripe_launch_price_id,
      v_attempt.trial_policy;
    return;
  end if;

  -- Plain SELECT, deliberately not FOR UPDATE: the caller already holds the
  -- billing-checkout advisory lock for this merchant, which mutually excludes
  -- the only writer of these columns. Adding a row lock here would take
  -- billing_checkout_attempts before billing_customers, the opposite order to
  -- claim_billing_checkout_attempt / apply_current_stripe_subscription /
  -- apply_stripe_subscription_event, and invite a 40P01 deadlock.
  select customers.launch_fee_status, customers.introductory_trial_status
  into v_launch_fee_status, v_trial_status
  from public.billing_customers as customers
  where customers.merchant_id = p_merchant_id;

  -- A trial is a once-per-merchant introductory benefit. Cancelled restart is
  -- intentionally allowed, so current status cannot be the test — only a
  -- durable record of a previously granted trial can be.
  v_attempt.trial_policy := case
    when v_trial_status is not null then 'not_eligible'
    else 'introductory_28_day'
  end;

  if v_launch_fee_status is not null then
    v_attempt.launch_fee_policy := 'previously_satisfied';
    v_attempt.stripe_launch_price_id := null;
  elsif v_attempt.billing_interval in ('month', 'year') then
    v_attempt.launch_fee_policy := 'charged';
    v_attempt.stripe_launch_price_id := btrim(p_configured_launch_price_id);
  else
    return query select 'conflict'::text, null::text, null::text, null::text;
    return;
  end if;

  update public.billing_checkout_attempts as attempts
  set checkout_offer_bound = true,
      launch_fee_policy = v_attempt.launch_fee_policy,
      stripe_launch_price_id = v_attempt.stripe_launch_price_id,
      trial_policy = v_attempt.trial_policy,
      updated_at = transaction_timestamp()
  where attempts.merchant_id = p_merchant_id
    and attempts.attempt_id = p_attempt_id
    and attempts.worker_lease_id = p_worker_lease_id
  returning attempts.* into v_attempt;

  return query select
    'bound'::text,
    v_attempt.launch_fee_policy,
    v_attempt.stripe_launch_price_id,
    v_attempt.trial_policy;
end
$function$;

revoke all on function public.bind_billing_checkout_offer(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.bind_billing_checkout_offer(uuid, uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
