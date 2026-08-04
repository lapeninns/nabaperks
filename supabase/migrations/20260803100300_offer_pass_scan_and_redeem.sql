-- Merchant Offers and Campaign QR — discount pass scanning and staff redemption.
--
-- Four functions, all SECURITY DEFINER and service-role only:
--   create_offer_pass_scan_token       customer mints the uuid behind their QR
--   purge_expired_offer_pass_scan_tokens  housekeeping for dead bearer rows
--   get_offer_pass_scan_context        staff read-only view of a scanned pass
--   redeem_offer_pass                  the single mutation, after two attestations
--
-- The rules this file exists to enforce, each deliberate:
--
--   * The PASS allows unlimited uses; a single scan TOKEN does not. The
--     entitlement is never consumed and its status is never flipped on
--     redemption — a customer can mint a fresh token seconds later and use the
--     same pass again tomorrow. Single use lives one level down, on
--     offer_pass_scan_tokens.consumed_at plus the UNIQUE offer_redemptions
--     .scan_token_id. This is why the feature does not reuse reward_events,
--     whose redeem path flips 'unlocked' -> 'redeemed'.
--
--   * Redemption is TWO deliberate steps. Scanning navigates and reads; a human
--     then confirms. Nothing here is called from the scan/read path, so a scan
--     can never redeem by itself.
--
--   * There is NO daily usage limit and NO bill amount. No identity-document
--     number, no image and no date of birth is accepted as a parameter or
--     stored. id_check_attested and no_stacking_attested are booleans recording
--     that a member of staff confirmed something, and nothing more.
--
--   * The no-stacking confirmation is ALWAYS required. The ID confirmation is
--     required if and only if the campaign snapshot on the entitlement says so.
--     lib/offers/redeem-core.ts mirrors exactly this rule for the form, and the
--     offer_redemptions_no_stacking_required CHECK is the last line of defence.
--
--   * Redemption keeps working for a pass already issued even when the venue
--     has since been removed from the offer pilot allowlist, or its campaign
--     was paused or ended. Those stop NEW claims. A promise already made to a
--     customer is honoured until the pass's own window closes.
--
-- The 10-minute TTL is the offer_pass_scan_tokens.expires_at default from
-- 20260803100000 and OFFER_PASS_SCAN_TOKEN_TTL_MS in lib/offers/constants.ts.
-- All three must move together.

-- 1. Purge expired scan tokens -------------------------------------------------
-- offer_redemptions.scan_token_id is ON DELETE RESTRICT, so a token that was
-- actually honoured is evidence and must survive: deleting it would either
-- destroy the audit trail or (with RESTRICT) abort the whole purge. Only
-- unredeemed dead bearer rows are removed.
create or replace function public.purge_expired_offer_pass_scan_tokens(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_purged integer;
begin
  delete from public.offer_pass_scan_tokens t
  where t.expires_at <= p_now
    and not exists (
      select 1 from public.offer_redemptions r where r.scan_token_id = t.id
    );

  get diagnostics v_purged = row_count;
  return v_purged;
end;
$function$;

revoke all on function public.purge_expired_offer_pass_scan_tokens(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_expired_offer_pass_scan_tokens(timestamptz)
  to service_role;

-- 2. Mint the customer's scan token --------------------------------------------
-- Clones create_reward_scan_token: purge, then reuse an unconsumed token that
-- still has comfortable life left, otherwise insert a new one. Reuse keeps a
-- customer refreshing their QR at the counter from piling up bearer rows.
create or replace function public.create_offer_pass_scan_token(
  p_entitlement_id uuid,
  p_customer_id uuid
)
returns table (
  scan_token uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_pass record;
  v_reusable record;
  v_today date := public.uk_business_date(now());
  v_availability text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.purge_expired_offer_pass_scan_tokens(now());

  select
    e.id,
    e.customer_id,
    e.merchant_id,
    e.membership_id,
    e.status,
    e.valid_from,
    e.valid_to,
    m.status as merchant_status,
    m.requires_billing,
    bc.status as billing_status,
    exists (
      select 1 from public.loyalty_cards lc
      where lc.merchant_id = e.merchant_id and lc.is_active
    ) as card_active
  into v_pass
  from public.offer_discount_entitlements e
  join public.merchants m on m.id = e.merchant_id
  left join public.billing_customers bc on bc.merchant_id = e.merchant_id
  where e.id = p_entitlement_id
  for update of e;

  if v_pass.id is null then
    raise insufficient_privilege using message = 'Offer pass not found';
  end if;

  if v_pass.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Offer pass ownership required';
  end if;

  if v_pass.status <> 'active' then
    raise exception 'This pass is no longer active';
  end if;

  if v_today < v_pass.valid_from or v_today > v_pass.valid_to then
    raise exception 'This pass is outside its valid dates';
  end if;

  v_availability := public.loyalty_availability_reason(
    v_pass.merchant_status,
    v_pass.card_active,
    v_pass.billing_status,
    v_pass.requires_billing
  );

  if v_availability is not null then
    raise exception 'This loyalty programme is unavailable right now';
  end if;

  select t.id, t.expires_at
  into v_reusable
  from public.offer_pass_scan_tokens t
  where t.entitlement_id = v_pass.id
    and t.customer_id = v_pass.customer_id
    and t.consumed_at is null
    and t.expires_at > now() + interval '5 minutes'
  order by t.expires_at desc
  limit 1;

  if v_reusable.id is not null then
    scan_token := v_reusable.id;
    expires_at := v_reusable.expires_at;
    return next;
    return;
  end if;

  insert into public.offer_pass_scan_tokens (
    entitlement_id,
    merchant_id,
    customer_id,
    membership_id
  )
  values (
    v_pass.id,
    v_pass.merchant_id,
    v_pass.customer_id,
    v_pass.membership_id
  )
  returning id, offer_pass_scan_tokens.expires_at
  into scan_token, expires_at;

  return next;
end;
$function$;

revoke all on function public.create_offer_pass_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_offer_pass_scan_token(uuid, uuid)
  to service_role;

-- 3. Staff read of a scanned pass ----------------------------------------------
-- Pure read: it takes no lock, writes nothing and can never redeem. Expiry gets
-- its own distinct status so the reader never has to substring-match the
-- redeem path's error, and 'redeemed' means "this particular code has been
-- used" — the pass itself remains usable with a fresh code.
--
-- customer_email and customer_phone_last4 are returned so the merchant boundary
-- can compute a masked label. lib/merchant/offer-pass-redemption.ts strips them
-- and only ever exposes formatMerchantCustomerIdentifier(...) output.
create or replace function public.get_offer_pass_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  scan_status text,
  entitlement_id uuid,
  campaign_id uuid,
  discount_percent integer,
  requires_id_check boolean,
  extra_terms text,
  valid_from date,
  valid_to date,
  membership_id uuid,
  customer_email text,
  customer_phone_last4 text,
  blocked_reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v record;
  v_today date := public.uk_business_date(now());
  v_availability text;
begin
  select
    t.id as token_id,
    t.merchant_id as token_merchant_id,
    t.expires_at,
    t.consumed_at,
    e.id as pass_id,
    e.campaign_id as pass_campaign_id,
    e.discount_percent as pass_discount_percent,
    e.requires_id_check as pass_requires_id_check,
    e.extra_terms as pass_extra_terms,
    e.status as pass_status,
    e.valid_from as pass_valid_from,
    e.valid_to as pass_valid_to,
    cm.id as card_membership_id,
    c.email as safe_customer_email,
    c.phone_last4 as safe_customer_phone_last4,
    m.status as merchant_status,
    m.requires_billing,
    bc.status as billing_status,
    exists (
      select 1 from public.loyalty_cards lc
      where lc.merchant_id = t.merchant_id and lc.is_active
    ) as card_active
  into v
  from public.offer_pass_scan_tokens t
  join public.offer_discount_entitlements e on e.id = t.entitlement_id
  join public.customer_memberships cm on cm.id = t.membership_id
  join public.customers c on c.id = t.customer_id
  join public.merchants m on m.id = t.merchant_id
  left join public.billing_customers bc on bc.merchant_id = t.merchant_id
  where t.id = p_scan_token;

  if v.token_id is null then
    scan_status := 'not_found';
    return next;
    return;
  end if;

  if v.token_merchant_id <> p_merchant_id then
    scan_status := 'unauthorized';
    return next;
    return;
  end if;

  entitlement_id := v.pass_id;
  campaign_id := v.pass_campaign_id;
  discount_percent := v.pass_discount_percent;
  requires_id_check := v.pass_requires_id_check;
  extra_terms := v.pass_extra_terms;
  valid_from := v.pass_valid_from;
  valid_to := v.pass_valid_to;
  membership_id := v.card_membership_id;
  customer_email := v.safe_customer_email;
  customer_phone_last4 := v.safe_customer_phone_last4;

  -- One code, one redemption. The customer's pass is untouched.
  if v.consumed_at is not null then
    scan_status := 'redeemed';
    return next;
    return;
  end if;

  if v.expires_at <= now() then
    scan_status := 'expired';
    return next;
    return;
  end if;

  if v.pass_status <> 'active' then
    scan_status := 'blocked';
    blocked_reason := 'This pass is no longer active.';
    return next;
    return;
  end if;

  if v_today < v.pass_valid_from or v_today > v.pass_valid_to then
    scan_status := 'blocked';
    blocked_reason := 'This pass is outside its valid dates.';
    return next;
    return;
  end if;

  v_availability := public.loyalty_availability_reason(
    v.merchant_status,
    v.card_active,
    v.billing_status,
    v.requires_billing
  );

  if v_availability is not null then
    scan_status := 'blocked';
    blocked_reason := 'This loyalty programme is unavailable right now.';
    return next;
    return;
  end if;

  scan_status := 'ready';
  return next;
end;
$function$;

revoke all on function public.get_offer_pass_scan_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_offer_pass_scan_context(uuid, uuid)
  to service_role;

-- 4. Redeem ---------------------------------------------------------------------
-- The only mutation in the pass flow, and the only place offer_redemptions is
-- written. Consumes exactly one scan token, records both attestations, and
-- LEAVES THE ENTITLEMENT ALONE.
create or replace function public.redeem_offer_pass(
  p_scan_token uuid,
  p_merchant_id uuid,
  p_id_check_attested boolean,
  p_no_stacking_attested boolean,
  p_actor_user_id uuid default null
)
returns table (
  redemption_id uuid,
  discount_percent integer,
  membership_id uuid
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_token record;
  v_pass record;
  v_today date := public.uk_business_date(now());
  v_availability text;
  v_id_checked boolean := coalesce(p_id_check_attested, false);
  v_consumed integer;
begin
  select *
  into v_token
  from public.offer_pass_scan_tokens
  where id = p_scan_token
  for update;

  if v_token.id is null then
    raise insufficient_privilege using
      message = 'Offer pass scan token not found';
  end if;

  if v_token.merchant_id <> p_merchant_id then
    raise insufficient_privilege using
      message = 'Offer pass belongs to a different merchant';
  end if;

  if v_token.expires_at <= now() then
    raise exception 'Offer pass scan token expired';
  end if;

  if v_token.consumed_at is not null then
    raise exception 'Offer pass scan token already used';
  end if;

  -- Always asked, always recorded. The CHECK on offer_redemptions says the same
  -- thing; this raise exists so staff get a sentence rather than a violation.
  if coalesce(p_no_stacking_attested, false) is not true then
    raise exception
      'Confirm the pass is not being combined with another reward or offer';
  end if;

  select
    e.id,
    e.campaign_id,
    e.customer_id,
    e.membership_id,
    e.status,
    e.discount_percent,
    e.requires_id_check,
    e.valid_from,
    e.valid_to,
    m.status as merchant_status,
    m.requires_billing,
    bc.status as billing_status,
    exists (
      select 1 from public.loyalty_cards lc
      where lc.merchant_id = e.merchant_id and lc.is_active
    ) as card_active
  into v_pass
  from public.offer_discount_entitlements e
  join public.merchants m on m.id = e.merchant_id
  left join public.billing_customers bc on bc.merchant_id = e.merchant_id
  where e.id = v_token.entitlement_id
  for update of e;

  if v_pass.id is null then
    raise insufficient_privilege using message = 'Offer pass not found';
  end if;

  if v_pass.status <> 'active' then
    raise exception 'This pass is no longer active';
  end if;

  if v_today < v_pass.valid_from or v_today > v_pass.valid_to then
    raise exception 'This pass is outside its valid dates';
  end if;

  v_availability := public.loyalty_availability_reason(
    v_pass.merchant_status,
    v_pass.card_active,
    v_pass.billing_status,
    v_pass.requires_billing
  );

  if v_availability is not null then
    raise exception 'This loyalty programme is unavailable right now';
  end if;

  -- Required if and only if the campaign snapshot on the pass says so.
  if v_pass.requires_id_check and not v_id_checked then
    raise exception 'This offer requires an ID check';
  end if;

  insert into public.offer_redemptions (
    entitlement_id,
    campaign_id,
    merchant_id,
    customer_id,
    membership_id,
    scan_token_id,
    discount_percent,
    id_check_attested,
    no_stacking_attested,
    redeemed_by_user_id
  )
  values (
    v_pass.id,
    v_pass.campaign_id,
    p_merchant_id,
    v_pass.customer_id,
    v_pass.membership_id,
    v_token.id,
    v_pass.discount_percent,
    v_id_checked,
    true,
    p_actor_user_id
  )
  returning id into redemption_id;

  update public.offer_pass_scan_tokens
  set consumed_at = now(),
      consumed_by_merchant_id = p_merchant_id
  where id = p_scan_token
    and consumed_at is null;

  get diagnostics v_consumed = row_count;

  -- Belt and braces alongside the row lock and the UNIQUE scan_token_id: if the
  -- token was consumed by a racing transaction, refuse rather than leave a
  -- redemption row whose token still reads as unused.
  if v_consumed <> 1 then
    raise exception 'Offer pass scan token already used';
  end if;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id,
    actor_type, actor_id, metadata
  ) values (
    'offer_pass_redeemed', p_merchant_id, v_pass.customer_id, v_pass.membership_id,
    'merchant', coalesce(p_actor_user_id::text, 'merchant'),
    jsonb_build_object(
      'campaign_id', v_pass.campaign_id,
      'entitlement_id', v_pass.id,
      'discount_percent', v_pass.discount_percent,
      'id_check_attested', v_id_checked,
      'no_stacking_attested', true
    )
  );

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id,
    target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_actor_user_id::text, 'merchant'), p_merchant_id,
    v_pass.customer_id, 'offer_redemptions', redemption_id,
    'offer_pass_redeemed',
    jsonb_build_object(
      'entitlement_id', v_pass.id,
      'scan_token_id', v_token.id,
      'discount_percent', v_pass.discount_percent,
      'id_check_attested', v_id_checked
    )
  );

  discount_percent := v_pass.discount_percent;
  membership_id := v_pass.membership_id;
  return next;
end;
$function$;

revoke all on function public.redeem_offer_pass(uuid, uuid, boolean, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.redeem_offer_pass(uuid, uuid, boolean, boolean, uuid)
  to service_role;

notify pgrst, 'reload schema';
