-- Reward invite attach must fail closed on billing-gated merchants.
--
-- The public join/redeem paths should keep throwing user-facing billing errors.
-- The background attach path is best-effort: when an invite matches a customer
-- but the merchant is billing_required/billing_blocked, it returns zero rows and
-- leaves the invite matched so it can attach later if the venue becomes eligible.

create or replace function public.attach_matched_reward_invites(
  p_customer_id uuid,
  p_phone_hmac text default null,
  p_email_hmac text default null,
  p_claim_token_hash text default null
)
returns table (
  attached_reward_event_id uuid,
  merchant_id uuid,
  membership_id uuid,
  reward_name text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_invite record;
  v_now timestamptz := now();
  v_membership record;
  v_merchant record;
  v_card_id uuid;
  v_reward_id uuid;
  v_business_date date;
  v_membership_today integer;
  v_merchant_today integer;
  v_billing_status text;
  v_has_active_card boolean;
  v_availability_reason text;
begin
  if p_customer_id is null then return; end if;

  for v_invite in
    select * from public.pending_reward_invites
    where status in ('pending', 'matched')
      and (
        (p_phone_hmac is not null and phone_hmac = p_phone_hmac)
        or (p_email_hmac is not null and email_hmac = p_email_hmac)
        or (p_claim_token_hash is not null and claim_token_hash = p_claim_token_hash)
        or matched_customer_id = p_customer_id
      )
    for update
  loop
    if v_invite.invite_expires_at <= v_now then
      update public.pending_reward_invites
      set status = 'expired', email_hmac = null, phone_hmac = null, email_masked = null,
          phone_last4 = null, claim_token_hash = 'scrubbed:' || v_invite.id::text, updated_at = v_now
      where id = v_invite.id;
      continue;
    end if;

    if v_invite.matched_customer_id is not null and v_invite.matched_customer_id <> p_customer_id then
      continue;
    end if;

    if v_invite.status = 'pending' then
      update public.pending_reward_invites
      set status = 'matched', matched_customer_id = p_customer_id, updated_at = v_now
      where id = v_invite.id;
    end if;

    select cm.id into v_membership
    from public.customer_memberships cm
    where cm.customer_id = p_customer_id and cm.merchant_id = v_invite.merchant_id
    limit 1
    for update;
    if v_membership.id is null then continue; end if;

    select m.id, m.status, m.requires_billing, m.business_name into v_merchant
    from public.merchants m where m.id = v_invite.merchant_id
    for update;

    select billing_customers.status
    into v_billing_status
    from public.billing_customers
    where billing_customers.merchant_id = v_invite.merchant_id;

    select exists (
      select 1 from public.loyalty_cards
      where loyalty_cards.merchant_id = v_invite.merchant_id and loyalty_cards.is_active
    )
    into v_has_active_card;

    v_availability_reason := public.loyalty_availability_reason(
      v_merchant.status,
      v_has_active_card,
      v_billing_status,
      v_merchant.requires_billing
    );

    -- Unlike user-facing join/redeem RPCs, attach is best-effort and must not
    -- raise billing copy into signup/profile hooks. The matched invite remains
    -- eligible for a future attach attempt.
    if v_availability_reason in ('billing_required', 'billing_blocked') then
      continue;
    elsif v_availability_reason is not null then
      continue;
    end if;

    select loyalty_cards.id into v_card_id from public.loyalty_cards
    where loyalty_cards.merchant_id = v_invite.merchant_id and loyalty_cards.is_active
    order by loyalty_cards.created_at asc limit 1;
    if v_card_id is null then continue; end if;

    v_business_date := public.uk_business_date(v_now);

    select count(*) into v_membership_today
    from public.reward_events
    where reward_events.membership_id = v_membership.id
      and reward_events.source = 'merchant_direct'
      and public.uk_business_date(reward_events.created_at) = v_business_date;
    if v_membership_today >= 1 then continue; end if;

    select count(*) into v_merchant_today
    from public.reward_events
    where reward_events.merchant_id = v_invite.merchant_id
      and reward_events.source = 'merchant_direct'
      and public.uk_business_date(reward_events.created_at) = v_business_date;
    if v_merchant_today >= 100 then continue; end if;

    v_reward_id := public.internal_issue_merchant_direct_reward(
      v_invite.merchant_id, v_membership.id, p_customer_id, v_card_id,
      v_invite.reward_name, v_invite.reward_terms, v_invite.reward_expires_after_days,
      v_invite.personal_message, coalesce(v_invite.created_by_user_id::text, 'invite'),
      v_merchant.business_name
    );

    update public.pending_reward_invites
    set status = 'attached', attached_customer_id = p_customer_id, attached_membership_id = v_membership.id,
        attached_reward_event_id = v_reward_id, attached_at = v_now,
        email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
        claim_token_hash = 'scrubbed:' || v_invite.id::text, matched_customer_id = p_customer_id, updated_at = v_now
    where id = v_invite.id;

    attached_reward_event_id := v_reward_id;
    merchant_id := v_invite.merchant_id;
    membership_id := v_membership.id;
    reward_name := v_invite.reward_name;
    return next;
  end loop;
end;
$$;

revoke all on function public.attach_matched_reward_invites(uuid, text, text, text) from public;
grant execute on function public.attach_matched_reward_invites(uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
