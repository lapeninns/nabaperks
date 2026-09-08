-- Customer read path: two service-role RPCs that collapse per-request waterfalls.
--
--   touch_customer_session_and_load  session touch + customers row in one hop
--   get_customer_card_state          /card/[membershipId] read in one hop
--
-- Both are ADDITIVE. touch_customer_session (20260903120000) and
-- register_customer_session (20260908120000, SEC-RISK-001 reopened) are not
-- redefined here; the session loader CALLS touch_customer_session so the
-- device binding, revocation, hard expiry and the trusted-device slide keep a
-- single definition.
--
-- Forward-only and re-runnable.

-- 1. Session touch + customer load ---------------------------------------------
create or replace function public.touch_customer_session_and_load(
  p_customer_id uuid,
  p_session_id uuid,
  p_device_hash text
)
returns table (
  status text,
  id uuid,
  auth_user_id uuid,
  email text,
  email_verified_at timestamptz,
  full_name text,
  date_of_birth date,
  date_of_birth_verified_at timestamptz,
  phone_last4 text,
  phone_country text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  -- Session validity is delegated verbatim: nothing about device binding,
  -- revocation, expiry or the trusted-device slide is re-implemented here.
  if p_customer_id is null
     or p_session_id is null
     or not public.touch_customer_session(p_customer_id, p_session_id, p_device_hash)
  then
    status := 'inactive';
    return next;
    return;
  end if;

  return query
    select
      'active'::text,
      c.id,
      c.auth_user_id,
      c.email,
      c.email_verified_at,
      c.full_name,
      c.date_of_birth,
      c.date_of_birth_verified_at,
      c.phone_last4,
      c.phone_country,
      c.created_at
    from public.customers c
    where c.id = p_customer_id;

  if not found then
    -- Reachable only in a delete race (customer_sessions cascades on delete):
    -- the session was live, the identity is gone. Distinct from 'inactive' so
    -- the app clears the cookie instead of bouncing to login.
    status := 'customer_missing';
    return next;
  end if;
end;
$function$;

revoke all on function public.touch_customer_session_and_load(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.touch_customer_session_and_load(uuid, uuid, text)
  to service_role;

comment on function public.touch_customer_session_and_load(uuid, uuid, text) is
  'Validates and touches a device-bound customer session via touch_customer_session, then returns the masked customers row. status: inactive | customer_missing | active; PII columns are null unless active. Service role only.';

-- 2. Customer card read ---------------------------------------------------------
create or replace function public.get_customer_card_state(
  p_membership_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_membership record;
  v_card jsonb;
  v_rewards jsonb;
  v_billing_status text;
begin
  if not public.is_service_role_request() then
    raise insufficient_privilege using message = 'Service role required';
  end if;

  if p_membership_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select
    m.id,
    m.merchant_id,
    m.customer_id,
    m.current_stamp_count,
    m.total_rewards_redeemed,
    m.active_cycle_number,
    m.referral_code,
    m.referral_code_active,
    mer.business_name,
    mer.business_slug,
    mer.status as merchant_status,
    mer.requires_billing,
    mer.pub_google_review,
    mer.locals
  into v_membership
  from public.customer_memberships m
  join public.merchants mer on mer.id = m.merchant_id
  where m.id = p_membership_id;

  if v_membership.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Ownership is proven here, before any card, reward or billing detail is
  -- read. A non-owner learns only that the id exists.
  if p_customer_id is null or v_membership.customer_id <> p_customer_id then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  -- Same selection as lib/customer/home.ts: the active card, else the earliest.
  select jsonb_build_object(
    'card_name', c.card_name,
    'stamps_required', c.stamps_required,
    'reward_name', c.reward_name,
    'reward_terms', c.reward_terms,
    'is_active', c.is_active
  )
  into v_card
  from public.loyalty_cards c
  where c.merchant_id = v_membership.merchant_id
  order by c.is_active desc, c.created_at asc
  limit 1;

  -- Every unlocked reward; the app splits stamp-cycle from issued rewards.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'reward_name', r.reward_name,
        'reward_terms', r.reward_terms,
        'redeemable_from', r.redeemable_from,
        'expires_at', r.expires_at,
        'source', r.source,
        'created_at', r.created_at
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rewards
  from public.reward_events r
  where r.membership_id = v_membership.id
    and r.status = 'unlocked';

  select b.status
  into v_billing_status
  from public.billing_customers b
  where b.merchant_id = v_membership.merchant_id;

  return jsonb_build_object(
    'status', 'ready',
    'membership', jsonb_build_object(
      'id', v_membership.id,
      'merchant_id', v_membership.merchant_id,
      'customer_id', v_membership.customer_id,
      'current_stamp_count', v_membership.current_stamp_count,
      'total_rewards_redeemed', v_membership.total_rewards_redeemed,
      'active_cycle_number', v_membership.active_cycle_number,
      'referral_code', v_membership.referral_code,
      'referral_code_active', v_membership.referral_code_active
    ),
    'merchant', jsonb_build_object(
      'business_name', v_membership.business_name,
      'business_slug', v_membership.business_slug,
      'status', v_membership.merchant_status,
      'requires_billing', v_membership.requires_billing,
      'pub_google_review', v_membership.pub_google_review,
      'locals', v_membership.locals
    ),
    'loyalty_card', v_card,
    'unlocked_rewards', v_rewards,
    'billing_status', v_billing_status
  );
end;
$function$;

revoke all on function public.get_customer_card_state(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_customer_card_state(uuid, uuid)
  to service_role;

comment on function public.get_customer_card_state(uuid, uuid) is
  'One-hop read for /card/[membershipId]: membership + merchant, the active (else earliest) loyalty card, every unlocked reward, and billing status. status: not_found | unauthorized | ready; non-owners receive status only. Service role only.';

notify pgrst, 'reload schema';
