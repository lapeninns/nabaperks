-- db dead field cleanup: drop verified-dead fields, duplicate indexes, and
-- the never-called record_qr_download RPC (2026-07-06 schema audit,
-- reports/db-schema-audit-2026-07-06.md).
--
--   * min_spend_pence on loyalty_cards / reward_pool_items / reward_events:
--     the 20260624 remove_minimum_spend migration dropped the RPC parameters
--     but never the columns; redemption was never gated on spend.
--   * merchants ROI trio (average_order_value_pence,
--     estimated_gross_margin_bps, reward_cost_pence): only ever written as
--     zeros by column DEFAULTs; read by nothing (dashboard metrics aggregate
--     event tables).
--   * merchant_locations.timezone: never read; business dates hardcode
--     Europe/London via uk_business_date().
--   * Seven duplicate indexes fully covered by another index's leading
--     columns — pure write amplification on the hottest tables.
--   * record_qr_download(): zero call sites; qr_downloaded is recorded via
--     recordProductEvent (analytics qr downloaded wire).
--
-- Two functions reference doomed columns and are recreated FIRST:
--   * get_reward_scan_context declared (but never assigned) min_spend_pence
--     in its RETURNS table — result shapes cannot be replaced, so drop +
--     create + explicit re-grant (drop/create would otherwise fall back to
--     PUBLIC execute).
--   * create_merchant_onboarding named merchant_locations.timezone in its
--     INSERTs — CREATE OR REPLACE with the timezone lines removed (shape
--     unchanged, grants survive).
--
-- Idempotent: re-running on an already-migrated database is a no-op.

drop function if exists public.get_reward_scan_context(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_reward_scan_context(p_scan_token uuid, p_merchant_id uuid)
 RETURNS TABLE(scan_status text, reward_event_id uuid, reward_name text, reward_terms text, membership_id uuid, current_stamp_count integer, customer_email text, customer_phone text, customer_phone_last4 text, blocked_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  scan_record record;
  availability_reason text;
begin
  select
    reward_scan_tokens.id as token_id,
    reward_scan_tokens.merchant_id as token_merchant_id,
    reward_scan_tokens.expires_at,
    reward_scan_tokens.consumed_at,
    reward_events.id as event_id,
    reward_events.status as event_status,
    reward_events.source as reward_source,
    reward_events.reward_name as assigned_reward_name,
    reward_events.reward_terms as assigned_reward_terms,
    reward_events.redeemable_from,
    customer_memberships.id as card_membership_id,
    customer_memberships.current_stamp_count as card_stamp_count,
    customers.email as safe_customer_email,
    customers.phone as safe_customer_phone,
    customers.phone_last4 as safe_customer_phone_last4,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status,
    merchants.requires_billing,
    billing_customers.status as billing_status
  into scan_record
  from public.reward_scan_tokens
  join public.reward_events
    on reward_events.id = reward_scan_tokens.reward_event_id
  join public.customer_memberships
    on customer_memberships.id = reward_scan_tokens.membership_id
  join public.customers
    on customers.id = reward_scan_tokens.customer_id
  join public.loyalty_cards
    on loyalty_cards.id = reward_events.loyalty_card_id
  join public.merchants
    on merchants.id = reward_scan_tokens.merchant_id
  left join public.billing_customers
    on billing_customers.merchant_id = reward_scan_tokens.merchant_id
  where reward_scan_tokens.id = p_scan_token;

  if scan_record.token_id is null then
    scan_status := 'not_found';
    return next;
    return;
  end if;

  if scan_record.token_merchant_id <> p_merchant_id then
    scan_status := 'unauthorized';
    return next;
    return;
  end if;

  reward_event_id := scan_record.event_id;
  reward_name := scan_record.assigned_reward_name;
  reward_terms := scan_record.assigned_reward_terms;
  membership_id := scan_record.card_membership_id;
  current_stamp_count := scan_record.card_stamp_count;
  customer_email := scan_record.safe_customer_email;
  customer_phone := scan_record.safe_customer_phone;
  customer_phone_last4 := scan_record.safe_customer_phone_last4;

  if scan_record.consumed_at is not null or scan_record.event_status = 'redeemed' then
    scan_status := 'redeemed';
    return next;
    return;
  end if;

  -- Expired tokens get a stable, distinct status so the read path agrees with
  -- the collect path (which raises 'Reward scan token expired') instead of
  -- collapsing expiry into not_found / a 404.
  if scan_record.expires_at <= now() then
    scan_status := 'expired';
    return next;
    return;
  end if;

  if scan_record.event_status <> 'unlocked' then
    scan_status := 'blocked';
    blocked_reason := 'This reward is not ready to collect.';
    return next;
    return;
  end if;

  if scan_record.redeemable_from is not null
    and scan_record.redeemable_from > public.uk_business_date(now()) then
    scan_status := 'blocked';
    blocked_reason := 'This reward cannot be collected until the next opening day.';
    return next;
    return;
  end if;

  availability_reason := public.loyalty_availability_reason(
    scan_record.merchant_status,
    scan_record.card_is_active,
    scan_record.billing_status,
    scan_record.requires_billing
  );

  if availability_reason is not null then
    scan_status := 'blocked';
    blocked_reason := 'This loyalty programme is unavailable right now.';
    return next;
    return;
  end if;

  -- Stamp threshold applies to earned rewards only; issued rewards skip it.
  if scan_record.reward_source = 'stamp_cycle'
    and scan_record.card_stamp_count < scan_record.stamps_required then
    scan_status := 'blocked';
    blocked_reason := 'This customer has not collected enough stamps yet.';
    return next;
    return;
  end if;

  if scan_record.customer_full_name is null
    or btrim(scan_record.customer_full_name) = ''
    or scan_record.customer_date_of_birth is null
    or (scan_record.safe_customer_email is not null
        and scan_record.customer_email_verified_at is null) then
    scan_status := 'blocked';
    blocked_reason := 'Ask the customer to finish their profile before this reward can be collected.';
    return next;
    return;
  end if;

  -- Age gate parity with the mint/redeem paths: DOB is non-null by the profile
  -- gate above. Blocks a token whose customer is (or became) under 18.
  if scan_record.customer_date_of_birth
       > (public.uk_business_date(now()) - interval '18 years')::date then
    scan_status := 'blocked';
    blocked_reason := 'This customer must be 18 or over to collect this reward.';
    return next;
    return;
  end if;

  scan_status := 'ready';
  return next;
end;
$function$;


revoke all on function public.get_reward_scan_context(uuid, uuid) from public;
grant execute on function public.get_reward_scan_context(uuid, uuid) to service_role;

CREATE OR REPLACE FUNCTION public.create_merchant_onboarding(p_owner_user_id uuid, p_email text, p_business_name text, p_business_slug text, p_business_type text, p_phone text, p_location_name text)
 RETURNS TABLE(merchant_id uuid, location_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  existing_merchant_id uuid;
  existing_location_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_owner_user_id <> (select auth.uid()) then
    raise insufficient_privilege using message = 'Owner user mismatch';
  end if;

  select merchants.id
  into existing_merchant_id
  from public.merchants
  where merchants.owner_user_id = p_owner_user_id
  limit 1;

  if existing_merchant_id is not null then
    select merchant_locations.id
    into existing_location_id
    from public.merchant_locations
    where merchant_locations.merchant_id = existing_merchant_id
    order by merchant_locations.created_at asc
    limit 1;

    if existing_location_id is null then
      insert into public.merchant_locations (
        merchant_id,
        name,
        is_primary
      )
      values (
        existing_merchant_id,
        p_location_name,
        true
      )
      returning id into existing_location_id;
    end if;

    merchant_id := existing_merchant_id;
    location_id := existing_location_id;
    return next;
    return;
  end if;

  insert into public.merchants (
    owner_user_id,
    business_name,
    business_slug,
    business_type,
    email,
    phone,
    status
  )
  values (
    p_owner_user_id,
    p_business_name,
    p_business_slug,
    p_business_type,
    p_email,
    nullif(p_phone, ''),
    'trial'
  )
  returning id into merchant_id;

  insert into public.merchant_locations (
    merchant_id,
    name,
    is_primary
  )
  values (
    merchant_id,
    p_location_name,
    true
  )
  returning id into location_id;

  insert into public.product_events (
    event_name,
    merchant_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'merchant_signed_up',
    merchant_id,
    'merchant',
    p_owner_user_id::text,
    jsonb_build_object('source', 'onboarding')
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
    p_owner_user_id::text,
    merchant_id,
    'merchants',
    merchant_id,
    'merchant_onboarded',
    jsonb_build_object('location_id', location_id)
  );

  return next;
end;
$function$;


alter table public.loyalty_cards drop column if exists min_spend_pence;
alter table public.reward_pool_items drop column if exists min_spend_pence;
alter table public.reward_events drop column if exists min_spend_pence;
alter table public.merchants drop column if exists average_order_value_pence;
alter table public.merchants drop column if exists estimated_gross_margin_bps;
alter table public.merchants drop column if exists reward_cost_pence;
alter table public.merchant_locations drop column if exists timezone;

drop index if exists public.billing_customers_merchant_id_idx;
drop index if exists public.customers_auth_user_id_idx;
drop index if exists public.customer_memberships_merchant_id_idx;
drop index if exists public.loyalty_cards_merchant_location_idx;
drop index if exists public.merchant_locations_merchant_id_idx;
drop index if exists public.reward_events_membership_id_idx;
drop index if exists public.stamp_events_membership_id_idx;

drop function if exists public.record_qr_download(uuid, uuid, text);
