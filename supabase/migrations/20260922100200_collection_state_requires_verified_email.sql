-- Collection readiness requires a verified email, like the QR gate.
--
-- WHAT CHANGES
--   * private.reward_collection_state blocks a reward whose customer has no
--     email address, not only one whose address is unverified. The profile
--     completion gate and the reward QR route already require a verified
--     address, so the canonical state the home page, merchant dashboard and
--     notification producers trust can no longer say "ready" for a reward
--     whose code cannot be minted.
--   * Signature, grants, wrappers and every other rule are unchanged.
--
-- Forward-only and re-runnable.

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
begin
  select
    rewards.status,
    rewards.source,
    rewards.reward_policy_version,
    rewards.reward_policy_snapshot,
    rewards.redeemable_from,
    rewards.available_from as stored_available_from,
    rewards.expires_at as stored_expires_at,
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
  if v_reward.status = 'redeemed' then state := 'redeemed'; reason := 'Reward already redeemed'; return next; return; end if;
  if v_reward.status = 'cancelled' then state := 'cancelled'; reason := 'Reward is not ready to collect'; return next; return; end if;
  if v_reward.status = 'expired' or (expires_at is not null and expires_at <= p_at) then
    state := 'expired'; reason := 'Reward expired'; return next; return;
  end if;
  if v_reward.status <> 'unlocked' then
    state := 'blocked'; reason := 'Reward is not ready to collect'; return next; return;
  end if;

  if v_reward.reward_policy_version = 'legacy_v1'
     and v_reward.redeemable_from > public.uk_business_date(p_at) then
    state := 'waiting'; reason := 'Reward is not redeemable until the next UK business day'; return next; return;
  elsif v_reward.reward_policy_version <> 'legacy_v1'
     and available_from is not null and p_at < available_from then
    state := 'waiting'; reason := 'Reward is not ready to collect yet'; return next; return;
  end if;

  if v_reward.unavailable_reason is not null then
    state := 'blocked'; reason := 'This loyalty programme is unavailable right now'; return next; return;
  end if;
  if v_reward.source = 'stamp_cycle'
     and v_reward.card_policy_version <> 'v2'
     and v_reward.current_stamp_count < v_reward.stamps_required then
    state := 'blocked'; reason := 'Reward is not ready to redeem'; return next; return;
  end if;
  if private.standard_reward_daily_cap_reached(p_reward_id, p_at) then
    state := 'blocked'; reason := 'One reward per visit day already collected'; return next; return;
  end if;
  if nullif(btrim(v_reward.email), '') is null or v_reward.email_verified_at is null then
    state := 'blocked'; reason := 'Verified email required for reward collection'; return next; return;
  end if;
  if nullif(btrim(v_reward.full_name), '') is null
     or v_reward.date_of_birth is null
     or v_reward.date_of_birth < date '1900-01-01' then
    state := 'blocked'; reason := 'Complete your profile before redeeming'; return next; return;
  end if;
  if coalesce((v_reward.reward_policy_snapshot ->> 'age_check')::boolean, true)
     and v_reward.date_of_birth > (public.uk_business_date(p_at) - interval '18 years')::date then
    state := 'blocked'; reason := 'Customer must be 18 or over to redeem'; return next; return;
  end if;

  state := 'ready';
  reason := null;
  return next;
end;
$function$;

revoke all on function private.reward_collection_state(uuid, timestamptz)
  from public, anon, authenticated, service_role;
