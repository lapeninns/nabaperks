-- Merchant Offers and Campaign QR — the feature becomes ordinary.
--
-- 20260803100000 shipped Offers behind two gates: a default-off environment
-- feature flag and a per-venue allowlist column, merchants.offer_campaigns_enabled.
-- The product decision is that Offers is a normal merchant feature, on for every
-- venue, with no pilot list and no kill switch. This migration removes the
-- database half of that gating outright rather than leaving a column nothing
-- reads.
--
-- What is removed:
--   * the allowlist test inside every RPC that carried one — create_offer_campaign_draft,
--     get_offer_claim_context, claim_offer_campaign and record_offer_campaign_open;
--   * admin_set_merchant_offer_campaigns, the admin toggle, whose only caller
--     (the Offers pilot control on /admin/merchants) is gone;
--   * the merchants.offer_campaigns_enabled column itself.
--
-- What is deliberately NOT touched: every other guard each function carries.
-- Draft and ended links stay private, the campaign window still decides
-- expired / paused / not-started, the row lock still serialises claims, the
-- membership, card-length, billing-availability and phone-verification refusals
-- all stand, and issued terms are still snapshotted. Each function below is its
-- previous body with the allowlist condition — and the merchants join that
-- existed only to read it — deleted, and nothing else.
--
-- Dropping the column is safe without a data-preservation step: it was added by
-- 20260803100000 in this same unmerged change, so it has never existed outside
-- local development and holds no production state.
--
-- Every function is re-stated with its full ACL (`revoke all ... from public,
-- anon, authenticated` then `grant execute ... to service_role`) so replacing a
-- body can never silently widen who may call it.

-- 1. Draft creation ------------------------------------------------------------
-- Signature, return type and defaults are unchanged from 20260803100600, so this
-- replaces in place. A venue with no active loyalty card is still refused; that
-- is now the first thing an unknown merchant id meets.
create or replace function public.create_offer_campaign_draft(
  p_merchant_id uuid,
  p_created_by uuid,
  p_bonus_stamp_count integer,
  p_discount_percent integer,
  p_starts_on date,
  p_ends_on date,
  p_requires_id_check boolean,
  p_extra_terms text,
  p_claim_token_hash text,
  p_claim_token_ciphertext text,
  p_name text default null,
  p_customer_description text default null
)
returns table (campaign_id uuid, status text, stamps_required integer)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_card record;
  v_campaign_id uuid;
  v_terms text := nullif(btrim(coalesce(p_extra_terms, '')), '');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_description text := nullif(btrim(coalesce(p_customer_description, '')), '');
begin
  if p_starts_on is null or p_ends_on is null then
    raise exception 'A start date and an end date are required';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'The end date cannot be before the start date';
  end if;
  if p_ends_on > p_starts_on + 365 then
    raise exception 'A campaign can run for at most 366 days';
  end if;
  if p_ends_on < public.uk_business_date(now()) then
    raise exception 'The campaign window has already passed';
  end if;
  if p_bonus_stamp_count is null and p_discount_percent is null then
    raise exception 'Choose at least one benefit for this offer';
  end if;
  if char_length(coalesce(v_terms, '')) > 500 then
    raise exception 'Additional terms must be 500 characters or fewer';
  end if;
  if char_length(coalesce(v_name, '')) > 60 then
    raise exception 'A campaign name must be 60 characters or fewer';
  end if;
  if char_length(coalesce(v_description, '')) > 160 then
    raise exception 'A campaign description must be 160 characters or fewer';
  end if;

  -- The bonus grant must never complete a card on its own, so the ceiling is
  -- the venue's active card length minus one. stamps_required can change after
  -- publication, which is why claim_offer_campaign re-checks this at claim time
  -- rather than trusting the value frozen here.
  select lc.id, lc.stamps_required
  into v_card
  from public.loyalty_cards lc
  where lc.merchant_id = p_merchant_id and lc.is_active
  order by lc.created_at asc
  limit 1;

  if v_card.id is null then
    raise exception 'This venue has no active loyalty card';
  end if;
  if p_bonus_stamp_count is not null
    and p_bonus_stamp_count > coalesce(v_card.stamps_required, 0) - 1
  then
    raise exception 'Bonus stamps must be fewer than the % needed for a reward',
      v_card.stamps_required;
  end if;

  -- Serialise campaign creation per venue so the one-non-terminal rule holds
  -- under concurrency instead of surfacing a unique-index violation.
  perform pg_advisory_xact_lock(
    hashtextextended('offer-campaign:' || p_merchant_id::text, 0)
  );

  if exists (
    select 1 from public.offer_campaigns c
    where c.merchant_id = p_merchant_id
      and c.status in ('scheduled', 'live', 'paused')
  ) then
    raise exception 'This venue already has an offer running';
  end if;

  -- Re-drafting supersedes the previous draft; a draft has never been published
  -- so nothing has been promised to a customer and nothing can have been
  -- claimed against it.
  delete from public.offer_campaigns c
  where c.merchant_id = p_merchant_id and c.status = 'draft';

  insert into public.offer_campaigns (
    merchant_id, created_by_user_id, status,
    name, customer_description,
    bonus_stamp_count, discount_percent,
    starts_on, ends_on, requires_id_check, extra_terms,
    claim_token_hash, claim_token_ciphertext
  ) values (
    p_merchant_id, p_created_by, 'draft',
    v_name, v_description,
    p_bonus_stamp_count, p_discount_percent,
    p_starts_on, p_ends_on, coalesce(p_requires_id_check, false), v_terms,
    p_claim_token_hash, p_claim_token_ciphertext
  )
  returning id into v_campaign_id;

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, target_table, target_id, action, metadata
  ) values (
    'merchant', coalesce(p_created_by::text, 'merchant'), p_merchant_id,
    'offer_campaigns', v_campaign_id, 'offer_campaign_drafted',
    jsonb_build_object(
      'name', v_name,
      'bonus_stamp_count', p_bonus_stamp_count,
      'discount_percent', p_discount_percent,
      'starts_on', p_starts_on,
      'ends_on', p_ends_on,
      'requires_id_check', coalesce(p_requires_id_check, false)
    )
  );

  campaign_id := v_campaign_id;
  status := 'draft';
  stamps_required := v_card.stamps_required;
  return next;
end;
$function$;

revoke all on function public.create_offer_campaign_draft(
  uuid, uuid, integer, integer, date, date, boolean, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_offer_campaign_draft(
  uuid, uuid, integer, integer, date, date, boolean, text, text, text, text, text
) to service_role;

-- 2. Customer claim context ----------------------------------------------------
-- Return type is identical to 20260803100600, so no drop is needed. The
-- merchants join stays: business_name and business_slug are still read from it.
create or replace function public.get_offer_claim_context(
  p_claim_token_hash text
)
returns table (
  claim_status text,
  business_name text,
  business_slug text,
  campaign_name text,
  customer_description text,
  bonus_stamp_count integer,
  discount_percent integer,
  requires_id_check boolean,
  extra_terms text,
  starts_on date,
  ends_on date
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v record;
  v_today date := public.uk_business_date(now());
begin
  claim_status := 'unavailable';

  if p_claim_token_hash is null or btrim(p_claim_token_hash) = '' then
    return next; return;
  end if;

  select c.id, c.status, c.starts_on, c.ends_on,
         c.name, c.customer_description,
         c.bonus_stamp_count, c.discount_percent,
         c.requires_id_check, c.extra_terms,
         m.business_name, m.business_slug
  into v
  from public.offer_campaigns c
  join public.merchants m on m.id = c.merchant_id
  where c.claim_token_hash = p_claim_token_hash
  for update of c;

  -- A draft link is not a public link, and an ended campaign is gone for good.
  if v.id is null or v.status in ('draft', 'ended') then
    return next; return;
  end if;

  business_name := v.business_name;
  business_slug := v.business_slug;
  starts_on := v.starts_on;
  ends_on := v.ends_on;

  if v_today > v.ends_on then
    claim_status := 'expired';
    return next; return;
  end if;
  if v.status = 'paused' then
    claim_status := 'paused';
    return next; return;
  end if;
  -- Before the start date the customer is told when it opens, never that it
  -- expired.
  if v_today < v.starts_on then
    claim_status := 'not_started';
    return next; return;
  end if;

  if v.status = 'scheduled' then
    update public.offer_campaigns set status = 'live' where id = v.id;
  end if;

  claim_status := 'available';
  -- The name and the description are only released once the offer is claimable.
  -- A recovery state names the venue and the dates and nothing else, so a
  -- guessed or leaked link reveals no unopened campaign's copy.
  campaign_name := v.name;
  customer_description := v.customer_description;
  bonus_stamp_count := v.bonus_stamp_count;
  discount_percent := v.discount_percent;
  requires_id_check := v.requires_id_check;
  extra_terms := v.extra_terms;
  return next;
end;
$function$;

revoke all on function public.get_offer_claim_context(text)
  from public, anon, authenticated;
grant execute on function public.get_offer_claim_context(text)
  to service_role;

-- 3. The claim transaction -----------------------------------------------------
-- The merchants join in the opening lock statement existed only to read the
-- allowlist column, so it goes with it; `for update of c` locks the campaign row
-- exactly as before, which is still the one idempotency mechanism. The venue's
-- card, status and billing state are resolved further down as they always were.
create or replace function public.claim_offer_campaign(
  p_customer_id uuid,
  p_claim_token_hash text,
  p_policy_version text,
  p_marketing_opt_in boolean
)
returns table (
  status text,
  membership_id uuid,
  stamps_awarded integer,
  entitlement_id uuid
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_campaign record;
  v_customer record;
  v_existing record;
  v_merchant record;
  v_campaign_status text;
  v_availability text;
  v_membership_id uuid;
  v_created boolean;
  v_cycle integer;
  v_claim_id uuid;
  v_bonus integer := 0;
  v_today date := public.uk_business_date(now());
begin
  status := 'invalid';
  membership_id := null;
  stamps_awarded := 0;
  entitlement_id := null;

  if p_customer_id is null
    or p_claim_token_hash is null
    or btrim(p_claim_token_hash) = ''
  then
    return next; return;
  end if;

  -- The one idempotency mechanism: every claim against this campaign is
  -- serialised behind this lock for the rest of the transaction.
  select c.id, c.merchant_id, c.status, c.starts_on, c.ends_on,
         c.bonus_stamp_count, c.discount_percent,
         c.requires_id_check, c.extra_terms
  into v_campaign
  from public.offer_campaigns c
  where c.claim_token_hash = p_claim_token_hash
  for update of c;

  -- Unknown, rotated, or ended (ending scrubs the hash). Indistinguishable on
  -- purpose: a stale poster must not confirm that a campaign ever existed.
  if v_campaign.id is null then
    return next; return;
  end if;

  -- A draft link is not a public link.
  if v_campaign.status in ('draft', 'ended') then
    status := 'unavailable';
    return next; return;
  end if;

  -- Past the end date, paused, and before the start date are three different
  -- answers. Reporting a not-yet-open campaign as expired would tell the
  -- customer they had missed something that has not started.
  if v_today > v_campaign.ends_on then
    status := 'expired';
    return next; return;
  end if;
  if v_campaign.status = 'paused' then
    status := 'paused';
    return next; return;
  end if;
  if v_today < v_campaign.starts_on then
    status := 'not_started';
    return next; return;
  end if;

  v_campaign_status := v_campaign.status;
  if v_campaign_status = 'scheduled' then
    update public.offer_campaigns c
    set status = 'live'
    where c.id = v_campaign.id;
    v_campaign_status := 'live';
  end if;
  if v_campaign_status <> 'live' then
    status := 'unavailable';
    return next; return;
  end if;

  -- The claim journey is phone-verified end to end; a caller that has not been
  -- through it gets nothing.
  select cu.id, cu.phone_hmac, cu.phone_verified_at
  into v_customer
  from public.customers cu
  where cu.id = p_customer_id;

  if v_customer.id is null
    or v_customer.phone_hmac is null
    or v_customer.phone_verified_at is null
  then
    return next; return;
  end if;

  -- Already claimed: award nothing, and hand back the membership and pass they
  -- already hold so the landing page can open them.
  select cl.id as claim_id, cl.membership_id as claim_membership_id,
         e.id as claim_entitlement_id
  into v_existing
  from public.offer_campaign_claims cl
  left join public.offer_discount_entitlements e on e.claim_id = cl.id
  where cl.campaign_id = v_campaign.id
    and cl.customer_id = p_customer_id;

  if v_existing.claim_id is not null then
    status := 'already_claimed';
    membership_id := v_existing.claim_membership_id;
    entitlement_id := v_existing.claim_entitlement_id;
    return next; return;
  end if;

  -- This offer is a joining incentive, so an existing member is refused before
  -- anything is written.
  select cm.id into v_membership_id
  from public.customer_memberships cm
  where cm.merchant_id = v_campaign.merchant_id
    and cm.customer_id = p_customer_id;

  if v_membership_id is not null then
    status := 'already_member';
    membership_id := v_membership_id;
    return next; return;
  end if;

  -- Resolve the active card and billing state exactly as the ordinary join
  -- does, so a lapsed or paused venue cannot issue benefits.
  select m.id as merchant_id, m.business_slug, m.status as merchant_status,
         m.requires_billing, lc.id as loyalty_card_id, lc.location_id,
         lc.is_active as card_active, lc.stamps_required,
         bc.status as billing_status
  into v_merchant
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  left join public.billing_customers bc on bc.merchant_id = m.id
  where m.id = v_campaign.merchant_id
  order by lc.created_at asc
  limit 1;

  if v_merchant.merchant_id is null or v_merchant.loyalty_card_id is null then
    status := 'unavailable';
    return next; return;
  end if;

  v_availability := public.loyalty_availability_reason(
    v_merchant.merchant_status, v_merchant.card_active,
    v_merchant.billing_status, v_merchant.requires_billing
  );
  if v_availability is not null then
    status := 'unavailable';
    return next; return;
  end if;

  -- Re-validated here, not merely at draft time: the venue can shorten its card
  -- after publishing, and a grant that completes a card on its own would hand
  -- out a free reward.
  v_bonus := coalesce(v_campaign.bonus_stamp_count, 0);
  if v_bonus > 0 and v_bonus >= coalesce(v_merchant.stamps_required, 0) then
    status := 'card_too_short';
    return next; return;
  end if;

  -- Membership + immutable loyalty-terms evidence (+ optional marketing
  -- consent) in one place, shared with every other join path.
  select jcm.membership_id, jcm.created_membership
  into v_membership_id, v_created
  from public.join_customer_membership(
    p_customer_id, v_merchant.business_slug, null,
    coalesce(p_marketing_opt_in, false), p_policy_version
  ) jcm;

  if v_membership_id is null then
    status := 'unavailable';
    return next; return;
  end if;
  if not v_created then
    status := 'already_member';
    membership_id := v_membership_id;
    return next; return;
  end if;

  -- offer_campaign_claims_once is the ledger-level backstop behind the row lock
  -- above; if it ever fires, nothing is awarded.
  begin
    insert into public.offer_campaign_claims (
      campaign_id, merchant_id, customer_id, membership_id, bonus_stamps_awarded
    ) values (
      v_campaign.id, v_merchant.merchant_id, p_customer_id, v_membership_id,
      v_bonus
    )
    returning id into v_claim_id;
  exception
    when unique_violation then
      status := 'already_claimed';
      membership_id := v_membership_id;
      return next; return;
  end;

  if v_bonus > 0 then
    select cm.active_cycle_number into v_cycle
    from public.customer_memberships cm
    where cm.id = v_membership_id;

    -- One immutable row per bonus stamp, business date NULL so the grant is
    -- cap/QR/geofence exempt and leaves the customer's earned day free.
    insert into public.stamp_events (
      merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, earned_business_date, cycle_number, metadata
    )
    select v_merchant.merchant_id, p_customer_id, v_membership_id,
           v_merchant.loyalty_card_id, v_merchant.location_id,
           'earned', 1, null, v_cycle,
           jsonb_build_object(
             'source', 'offer_campaign',
             'campaign_id', v_campaign.id,
             'claim_id', v_claim_id,
             'bonus_stamp_index', gs.i
           )
    from generate_series(1, v_bonus) as gs(i);

    update public.customer_memberships cm
    set current_stamp_count = cm.current_stamp_count + v_bonus,
        total_stamps_earned = cm.total_stamps_earned + v_bonus
    where cm.id = v_membership_id;
  end if;

  -- The pass, with its terms frozen at this moment. valid_from is today rather
  -- than the campaign start because the pass begins working when it is issued.
  if v_campaign.discount_percent is not null then
    insert into public.offer_discount_entitlements (
      claim_id, campaign_id, merchant_id, customer_id, membership_id,
      discount_percent, requires_id_check, extra_terms, valid_from, valid_to
    ) values (
      v_claim_id, v_campaign.id, v_merchant.merchant_id, p_customer_id,
      v_membership_id, v_campaign.discount_percent,
      coalesce(v_campaign.requires_id_check, false), v_campaign.extra_terms,
      v_today, v_campaign.ends_on
    )
    returning id into entitlement_id;
  end if;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id,
    actor_type, actor_id, metadata
  ) values (
    'offer_campaign_claimed', v_merchant.merchant_id, p_customer_id,
    v_membership_id, 'customer', p_customer_id::text,
    jsonb_build_object(
      'campaign_id', v_campaign.id,
      'claim_id', v_claim_id,
      'stamps_awarded', v_bonus,
      'discount_percent', v_campaign.discount_percent,
      'entitlement_id', entitlement_id
    )
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id,
    target_table, target_id, action, metadata
  ) values (
    'system', 'system', v_merchant.merchant_id, p_customer_id,
    'offer_campaign_claims', v_claim_id, 'offer_campaign_claimed',
    jsonb_build_object(
      'campaign_id', v_campaign.id,
      'membership_id', v_membership_id,
      'stamps_awarded', v_bonus,
      'entitlement_id', entitlement_id
    )
  );

  status := 'claimed';
  membership_id := v_membership_id;
  stamps_awarded := v_bonus;
  return next;
end;
$function$;

revoke all on function public.claim_offer_campaign(uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_offer_campaign(uuid, text, text, boolean)
  to service_role;

-- 4. The recorded landing-page open --------------------------------------------
-- Still decides claimability for itself rather than trusting the caller, still
-- takes no lock on offer_campaigns, and still counts only a load made while the
-- offer was genuinely claimable. Only the allowlist term of that condition — and
-- the merchants join it needed — is gone.
create or replace function public.record_offer_campaign_open(
  p_claim_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v record;
  v_today date := public.uk_business_date(now());
begin
  if p_claim_token_hash is null or btrim(p_claim_token_hash) = '' then
    return false;
  end if;

  select c.id, c.merchant_id, c.status, c.starts_on, c.ends_on
  into v
  from public.offer_campaigns c
  where c.claim_token_hash = p_claim_token_hash;

  -- Exactly the condition get_offer_claim_context reports as 'available'.
  -- 'scheduled' is included because a scheduled campaign whose start date has
  -- arrived IS claimable; the context RPC promotes it to 'live' under its own
  -- lock, and this must not depend on which transaction commits first.
  if v.id is null
    or v.status not in ('scheduled', 'live')
    or v_today < v.starts_on
    or v_today > v.ends_on
  then
    return false;
  end if;

  insert into public.offer_campaign_open_counts as counts (
    campaign_id, merchant_id, opened_on, open_count
  ) values (
    v.id, v.merchant_id, v_today, 1
  )
  on conflict (campaign_id, opened_on) do update
  set open_count = counts.open_count + 1,
      last_opened_at = transaction_timestamp();

  return true;
end;
$function$;

revoke all on function public.record_offer_campaign_open(text)
  from public, anon, authenticated;
grant execute on function public.record_offer_campaign_open(text)
  to service_role;

-- 5. The admin toggle, and the column it wrote ---------------------------------
-- admin_set_merchant_offer_campaigns was the only writer of the allowlist and
-- the only offer function ever granted to `authenticated`. Both it and the
-- column go; there is no replacement control, because there is no longer
-- anything to control.
drop function if exists public.admin_set_merchant_offer_campaigns(uuid, boolean);

alter table public.merchants
  drop column if exists offer_campaigns_enabled;

notify pgrst, 'reload schema';
