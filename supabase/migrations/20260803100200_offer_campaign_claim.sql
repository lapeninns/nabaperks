-- Merchant Offers and Campaign QR — the customer claim transaction.
--
-- One atomic function. A customer scans the printed campaign QR, verifies their
-- mobile through the existing phone journey, accepts the loyalty and offer terms
-- and lands here exactly once. Everything the claim produces — membership, terms
-- evidence, bonus stamps, the discount pass, the product and audit records —
-- either commits together or not at all.
--
-- Idempotency is the row lock on the campaign, and nothing else. Two scans of
-- the same poster arriving at the same instant queue behind
-- `select ... for update`, so the second sees the first's committed claim rather
-- than racing it to a second award.
--
-- Deliberate rules encoded below:
--   * An existing member of the venue is REFUSED ('already_member', zero
--     awards). This is a deliberate divergence from claim_loyalty_invite, which
--     shows an existing member their card: an offer is a joining incentive, so
--     giving it to somebody who already joined would pay twice for the same
--     member. The landing page sends them to the card they already hold.
--   * A repeat claim of the same campaign returns 'already_claimed' with zero
--     awards and hands back the membership and pass the customer already has,
--     so a re-scan opens their card and pass instead of granting anything.
--   * Bonus stamps carry `earned_business_date = null`. A non-null date would
--     collide on stamp_events_one_earned_per_business_day_idx across the grant
--     and would consume the customer's one earned day, so the venue's normal
--     QR could not add a visit stamp the same day.
--   * `metadata->>'source' = 'offer_campaign'` marks the grant as promotional.
--     20260803100400 adds that source to qualify_referral_on_stamp's exclusion
--     list so these stamps can never settle a referral bonus.
--   * `stamps_required` can be changed by the venue AFTER publication, so the
--     "a bonus grant must never complete a card on its own" rule is re-checked
--     here against the live card, not trusted from draft time.
--   * The benefit is SNAPSHOTTED onto the claim and the entitlement. Later
--     campaign edits, pauses or endings can never rewrite terms already issued.
--
-- 'scheduled' is a first-class status (see 20260803100000): a campaign whose
-- start date has arrived is promoted to 'live' under this same lock, so
-- activation is correct even if the retention sweep has not run.

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
         c.requires_id_check, c.extra_terms,
         m.offer_campaigns_enabled
  into v_campaign
  from public.offer_campaigns c
  join public.merchants m on m.id = c.merchant_id
  where c.claim_token_hash = p_claim_token_hash
  for update of c;

  -- Unknown, rotated, or ended (ending scrubs the hash). Indistinguishable on
  -- purpose: a stale poster must not confirm that a campaign ever existed.
  if v_campaign.id is null then
    return next; return;
  end if;

  -- A draft link is not a public link, and the per-venue allowlist doubles as
  -- the kill switch.
  if v_campaign.status in ('draft', 'ended')
    or coalesce(v_campaign.offer_campaigns_enabled, false) = false
  then
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

notify pgrst, 'reload schema';
