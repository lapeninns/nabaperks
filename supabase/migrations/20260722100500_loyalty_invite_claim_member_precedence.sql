-- Bulk Two-Stamp Loyalty Invitations — fix: an existing member is shown their
-- card, never an email conflict.
--
-- claim_loyalty_invite evaluated the identity-binding / email-conflict guard
-- BEFORE confirming existing membership, so a member whose verified email
-- differs from the invited address was returned 'email_conflict' instead of
-- 'already_member' (proved by tests/db/loyalty-invites.test.mjs). A member never
-- binds an email or joins, so that guard — which only protects a fresh bind +
-- join — must not pre-empt the membership check. This moves the existing-member
-- check ahead of the guard, keyed by the invitation's own merchant. No award or
-- bind outcome changes; only the status returned to an already-member.
--
-- Forward-only and idempotent (create or replace); grants unchanged.

create or replace function public.claim_loyalty_invite(
  p_customer_id uuid,
  p_claim_token_hash text,
  p_policy_version text,
  p_marketing_opt_in boolean,
  p_verified_email text,
  p_verified_email_hmac text
)
returns table (status text, membership_id uuid, stamps_awarded integer)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_recipient record;
  v_campaign record;
  v_customer record;
  v_merchant record;
  v_availability text;
  v_membership_id uuid;
  v_created boolean;
  v_cycle integer;
  v_bind boolean := false;
begin
  status := 'invalid';
  membership_id := null;
  stamps_awarded := 0;

  if p_customer_id is null or p_claim_token_hash is null then
    return next; return;
  end if;

  -- Lock the invitation for the duration (idempotency + single-consumer).
  select r.id, r.campaign_id, r.merchant_id, r.email_hmac, r.status,
         r.claimed_customer_id, r.claimed_membership_id
  into v_recipient
  from public.loyalty_invite_recipients r
  where r.claim_token_hash = p_claim_token_hash
  for update;

  if v_recipient.id is null then
    -- Already consumed/scrubbed, cancelled, or never existed.
    return next; return;
  end if;

  if v_recipient.status = 'joined' then
    if v_recipient.claimed_customer_id = p_customer_id then
      status := 'already_member';
      membership_id := v_recipient.claimed_membership_id;
    end if;
    return next; return;
  end if;

  if v_recipient.status in ('cancelled', 'failed', 'expired', 'unsubscribed') then
    return next; return;
  end if;

  select c.status, c.link_expires_at
  into v_campaign
  from public.loyalty_invite_campaigns c
  where c.id = v_recipient.campaign_id
  for update;

  if v_campaign.status = 'cancelled' then
    return next; return;
  end if;

  if v_campaign.link_expires_at is not null and v_campaign.link_expires_at < now() then
    update public.loyalty_invite_recipients
    set status = 'expired', expired_at = now(),
        email_ciphertext = null, email_masked = null,
        claim_token_hash = null, unsubscribe_token_hash = null
    where id = v_recipient.id;
    status := 'expired';
    return next; return;
  end if;

  -- The invited customer must be a verified-phone account.
  select cu.id, cu.email, cu.email_hmac, cu.email_verified_at,
         cu.phone_hmac, cu.phone_verified_at
  into v_customer
  from public.customers cu
  where cu.id = p_customer_id;

  if v_customer.id is null
     or v_customer.phone_hmac is null
     or v_customer.phone_verified_at is null then
    return next; return;
  end if;

  -- An existing member is shown their existing card and awarded nothing. This
  -- runs BEFORE the identity-binding guard below: a member never binds an email
  -- or joins, so an invitation addressed to a different verified email must not
  -- surface to them as a conflict. Keyed by the invitation's own merchant (the
  -- active card is resolved further down, only for the join path).
  select cm.id into v_membership_id
  from public.customer_memberships cm
  where cm.merchant_id = v_recipient.merchant_id and cm.customer_id = p_customer_id;
  if v_membership_id is not null then
    status := 'already_member';
    membership_id := v_membership_id;
    return next; return;
  end if;

  -- Identity binding rule: bind only when the account has no verified email, or
  -- already uses the same one. Never overwrite/merge a conflicting identity.
  if v_customer.email_verified_at is not null and v_customer.email_hmac is not null then
    if v_customer.email_hmac <> p_verified_email_hmac then
      status := 'email_conflict';
      return next; return;
    end if;
  else
    if exists (
      select 1 from public.customers other
      where other.email_hmac = p_verified_email_hmac
        and other.email_verified_at is not null
        and other.id <> p_customer_id
    ) then
      status := 'email_conflict';
      return next; return;
    end if;
    v_bind := true;
  end if;

  -- Resolve the active card + billing (mirrors join_customer_membership).
  select m.id as merchant_id, m.business_slug, m.status as merchant_status,
         m.requires_billing, lc.id as loyalty_card_id, lc.location_id,
         lc.is_active as card_active, lc.stamps_required, bc.status as billing_status
  into v_merchant
  from public.merchants m
  join public.loyalty_cards lc on lc.merchant_id = m.id and lc.is_active
  left join public.billing_customers bc on bc.merchant_id = m.id
  where m.id = v_recipient.merchant_id
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

  -- A card requiring fewer than three stamps would be completed by the welcome
  -- grant; refuse rather than hand out a free reward.
  if coalesce(v_merchant.stamps_required, 0) < 3 then
    status := 'card_too_short';
    return next; return;
  end if;

  -- Bind the invited email as verified without a second email code.
  if v_bind then
    update public.customers
    set email = p_verified_email,
        email_hmac = p_verified_email_hmac,
        email_verified_at = now()
    where id = p_customer_id;
  end if;

  -- Membership + immutable terms acceptance (+ optional marketing consent).
  select jcm.membership_id, jcm.created_membership
  into v_membership_id, v_created
  from public.join_customer_membership(
    p_customer_id, v_merchant.business_slug, null, coalesce(p_marketing_opt_in, false), p_policy_version
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

  select active_cycle_number into v_cycle
  from public.customer_memberships where id = v_membership_id;

  -- Two independent promotional stamps, business date NULL (cap/QR/geofence
  -- exempt), so the two rows never collide on the one-per-UK-day unique index.
  insert into public.stamp_events (
    merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
    event_type, stamps_delta, earned_business_date, cycle_number, metadata
  )
  select v_merchant.merchant_id, p_customer_id, v_membership_id,
         v_merchant.loyalty_card_id, v_merchant.location_id,
         'earned', 1, null, v_cycle,
         jsonb_build_object(
           'source', 'loyalty_invite',
           'campaign_id', v_recipient.campaign_id,
           'recipient_id', v_recipient.id,
           'welcome_stamp_index', gs.i
         )
  from generate_series(1, 2) as gs(i);

  update public.customer_memberships
  set current_stamp_count = current_stamp_count + 2,
      total_stamps_earned = total_stamps_earned + 2
  where id = v_membership_id;

  -- Consume the invitation: mark joined, link membership, scrub contact + tokens.
  update public.loyalty_invite_recipients
  set status = 'joined', joined_at = now(),
      claimed_customer_id = p_customer_id, claimed_membership_id = v_membership_id,
      email_ciphertext = null, email_masked = null,
      claim_token_hash = null, unsubscribe_token_hash = null,
      lease_expires_at = null
  where id = v_recipient.id;

  insert into public.product_events (
    event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
  ) values (
    'loyalty_invite_claimed', v_merchant.merchant_id, p_customer_id, v_membership_id,
    'customer', p_customer_id::text,
    jsonb_build_object('campaign_id', v_recipient.campaign_id, 'stamps_awarded', 2)
  );
  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  ) values (
    'system', 'system', v_merchant.merchant_id, p_customer_id,
    'loyalty_invite_recipients', v_recipient.id, 'loyalty_invite_claimed',
    jsonb_build_object('membership_id', v_membership_id, 'campaign_id', v_recipient.campaign_id)
  );

  status := 'claimed';
  membership_id := v_membership_id;
  stamps_awarded := 2;
  return next;
end;
$$;

revoke all on function public.claim_loyalty_invite(uuid, text, text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_loyalty_invite(uuid, text, text, boolean, text, text)
  to service_role;

notify pgrst, 'reload schema';
