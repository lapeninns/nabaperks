create or replace function private.reward_phone_verification_required()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$ select false $$;

revoke all on function private.reward_phone_verification_required()
  from public, anon, authenticated, service_role;

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
    customers.phone_hmac,
    customers.phone_verified_at,
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
  if private.standard_reward_daily_cap_reached(p_reward_id, p_at) then
    state := 'blocked'; reason := 'One reward per visit day already collected'; return next; return;
  end if;
  if nullif(btrim(v_reward.email), '') is null or v_reward.email_verified_at is null then
    state := 'blocked'; reason := 'Verified email required for reward collection'; return next; return;
  end if;
  if private.reward_phone_verification_required()
     and (v_reward.phone_hmac is null or v_reward.phone_verified_at is null) then
    state := 'blocked'; reason := 'Complete your profile before redeeming'; return next; return;
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


create or replace function public.require_reward_verified_phone()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
begin
  if private.reward_phone_verification_required() and not exists (
    select 1 from public.customers
    where id = new.customer_id
      and phone_hmac is not null
      and phone_verified_at is not null
  ) then
    raise check_violation using message = 'Complete your profile before redeeming';
  end if;
  return new;
end;
$function$;

revoke all on function public.require_reward_verified_phone()
  from public, anon, authenticated, service_role;

create trigger reward_scan_tokens_require_verified_phone
  before insert on public.reward_scan_tokens
  for each row execute function public.require_reward_verified_phone();

create trigger reward_events_redeem_require_verified_phone
  before update of status on public.reward_events
  for each row
  when (new.status = 'redeemed' and old.status is distinct from new.status)
  execute function public.require_reward_verified_phone();

notify pgrst, 'reload schema';
