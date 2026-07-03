-- Issued rewards, phase 3: merchant-direct send to an existing member.
--
-- `issue_merchant_direct_reward` mints one `merchant_direct` reward for a member
-- of the calling merchant. Owner-gated with the merchant row locked FOR UPDATE
-- so the per-day caps (1 per membership, 100 per merchant, over the UK business
-- day) serialise against concurrent sends. Billing fail-closed mirrors the
-- redeem gate. Records a `reward_sent` product event + a `direct_reward_issued`
-- audit log and enqueues the marketing `merchant_reward_received` push. No 18+
-- gate at issue time — DOB is usually absent when a gift is sent, and every
-- redemption path already enforces it. SECURITY DEFINER; authenticated (owner)
-- + service_role.

create or replace function public.issue_merchant_direct_reward(
  p_merchant_id uuid,
  p_membership_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_expires_in_days integer default 30,
  p_reason text default null
)
returns table (
  reward_event_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_merchant record;
  v_membership record;
  v_card_id uuid;
  v_billing_status text;
  v_name text := btrim(coalesce(p_reward_name, ''));
  v_terms text := btrim(coalesce(p_reward_terms, ''));
  v_expires_in integer := coalesce(p_expires_in_days, 30);
  v_now timestamptz := now();
  v_business_date date := public.uk_business_date(now());
  v_membership_today integer;
  v_merchant_today integer;
  v_reward_id uuid;
  v_expires_at timestamptz;
begin
  -- Owner auth, with the merchant row locked to serialise the daily caps.
  select
    merchants.id,
    merchants.status,
    merchants.owner_user_id,
    merchants.requires_billing,
    merchants.business_name
  into v_merchant
  from public.merchants
  where merchants.id = p_merchant_id
  for update;

  if v_merchant.id is null then
    raise insufficient_privilege using message = 'Merchant not found';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null or v_merchant.owner_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Merchant owner access required';
    end if;
  end if;

  -- Membership tenancy (locked).
  select
    customer_memberships.id,
    customer_memberships.customer_id
  into v_membership
  from public.customer_memberships
  where customer_memberships.id = p_membership_id
    and customer_memberships.merchant_id = p_merchant_id
  for update;

  if v_membership.id is null then
    raise exception 'Membership not found for merchant';
  end if;

  -- Bounds.
  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'Reward name must be 1 to 100 characters';
  end if;
  if char_length(v_terms) not between 12 and 500 then
    raise exception 'Reward terms must be between 12 and 500 characters';
  end if;
  if v_expires_in not between 1 and 365 then
    raise exception 'Reward expiry must be between 1 and 365 days';
  end if;

  -- Merchant active + billing fail-closed (inline, mirroring redeem).
  if v_merchant.status not in ('trial', 'active') then
    raise exception 'This merchant loyalty programme is not active';
  end if;

  select billing_customers.status
  into v_billing_status
  from public.billing_customers
  where billing_customers.merchant_id = p_merchant_id;

  if coalesce(v_merchant.requires_billing, true) and v_billing_status is null then
    raise exception 'This merchant loyalty programme is not active yet';
  end if;
  if v_billing_status in ('cancelled', 'suspended') then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  -- Oldest active card (deterministic; mirrors issue_self_service_stamp).
  select loyalty_cards.id
  into v_card_id
  from public.loyalty_cards
  where loyalty_cards.merchant_id = p_merchant_id
    and loyalty_cards.is_active
  order by loyalty_cards.created_at asc
  limit 1;

  if v_card_id is null then
    raise exception 'This loyalty card is not active';
  end if;

  -- Daily caps over the UK business day.
  select count(*)
  into v_membership_today
  from public.reward_events
  where reward_events.membership_id = p_membership_id
    and reward_events.source = 'merchant_direct'
    and public.uk_business_date(reward_events.created_at) = v_business_date;

  if v_membership_today >= 1 then
    raise exception 'A reward has already been sent to this member today';
  end if;

  select count(*)
  into v_merchant_today
  from public.reward_events
  where reward_events.merchant_id = p_merchant_id
    and reward_events.source = 'merchant_direct'
    and public.uk_business_date(reward_events.created_at) = v_business_date;

  if v_merchant_today >= 100 then
    raise exception 'Daily sent-reward limit reached for this merchant';
  end if;

  v_expires_at := v_now + make_interval(days => v_expires_in);

  insert into public.reward_events (
    merchant_id,
    customer_id,
    membership_id,
    loyalty_card_id,
    status,
    source,
    reward_name,
    reward_terms,
    redeemable_from,
    expires_at,
    cycle_number,
    metadata,
    created_at,
    updated_at
  )
  values (
    p_merchant_id,
    v_membership.customer_id,
    p_membership_id,
    v_card_id,
    'unlocked',
    'merchant_direct',
    v_name,
    v_terms,
    v_business_date,
    v_expires_at,
    null,
    jsonb_build_object(
      'issued_by', 'merchant_direct',
      'issuer_user_id', coalesce(current_user_id::text, 'service_role'),
      'reason', nullif(btrim(coalesce(p_reason, '')), '')
    ),
    v_now,
    v_now
  )
  returning id into v_reward_id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  )
  values (
    'reward_sent',
    p_merchant_id,
    v_membership.customer_id,
    p_membership_id,
    'merchant',
    coalesce(current_user_id::text, p_merchant_id::text),
    jsonb_build_object('reward_id', v_reward_id, 'reward_name', v_name, 'source', 'merchant_direct')
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'merchant',
    coalesce(current_user_id::text, p_merchant_id::text),
    p_merchant_id,
    v_membership.customer_id,
    'reward_events',
    v_reward_id,
    'direct_reward_issued',
    jsonb_build_object('reward_name', v_name, 'expires_in_days', v_expires_in)
  );

  perform public.enqueue_notification_event(
    'merchant_reward_received',
    v_membership.customer_id,
    p_merchant_id,
    p_membership_id,
    v_reward_id,
    null,
    v_business_date,
    v_now,
    'merchant_reward_received:' || v_reward_id::text,
    jsonb_build_object(
      'title', 'A reward for you',
      'body', v_name || ' at ' || coalesce(v_merchant.business_name, 'your venue'),
      'url', '/home/rewards',
      'rewardEventId', v_reward_id
    ),
    jsonb_build_object('source', 'merchant_direct')
  );

  reward_event_id := v_reward_id;
  expires_at := v_expires_at;
  return next;
end;
$$;

revoke all on function public.issue_merchant_direct_reward(uuid, uuid, text, text, integer, text) from public;
grant execute on function public.issue_merchant_direct_reward(uuid, uuid, text, text, integer, text) to authenticated, service_role;

notify pgrst, 'reload schema';
