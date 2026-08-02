-- Follow-ups from review of the remediation branch.
--
-- 1. Unsubscribe stopped working once the reward was claimed. attach scrubs
--    email_hmac, and suppress_reward_invite_email_by_token returned false when
--    it was null — so a recipient who claimed could no longer opt out. The
--    attached customer's own HMAC is the correct fallback: same address, still
--    keyed, and it respects the invite-row scrub.
--
-- 2. Legacy claim links must keep unsubscribing. Every direct-reward email
--    already in an inbox carries /claim/<claimToken>?unsubscribe=1. The finding
--    was that this granted GLOBAL suppression, not that a claim token could
--    unsubscribe at all — so honour those links, scoped to the issuing venue.
--    New emails use the separate unsubscribe token and route.
--
-- 3. A re-consent after an opt-out was being swallowed. The partial unique
--    index made the second opted_in row a no-op, so the newest row stayed
--    opted_out and the customer's fresh consent was lost. Replay protection now
--    lives in the function, which skips only when the CURRENT effective state
--    is already opted in.
--
-- 4. In-flight checkout attempts bound before 20260802110000 carry a null
--    trial_policy, which reads as "not eligible" and would silently drop the
--    trial from a session the merchant already started.

-- ---------------------------------------------------------------------------
-- 1 + 2. Unsubscribe resolution
-- ---------------------------------------------------------------------------
create or replace function public.suppress_reward_invite_email_by_token(
  p_unsubscribe_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_email_hmac text;
begin
  if p_unsubscribe_token_hash is null or btrim(p_unsubscribe_token_hash) = '' then
    return false;
  end if;

  -- Resolve by the dedicated unsubscribe token, or by the legacy claim token
  -- that older emails still carry. Either way the suppression is venue-scoped,
  -- which is what the finding was actually about.
  select merchant_id, email_hmac, attached_customer_id
  into v_invite
  from public.pending_reward_invites
  where unsubscribe_token_hash = p_unsubscribe_token_hash
     or claim_token_hash = p_unsubscribe_token_hash;

  if v_invite is null then
    return false;
  end if;

  v_email_hmac := v_invite.email_hmac;

  -- Claiming scrubs the invite's contact hashes, so fall back to the customer
  -- the reward was attached to; otherwise opting out silently stopped working
  -- for exactly the people who engaged with the invitation.
  if v_email_hmac is null and v_invite.attached_customer_id is not null then
    select email_hmac
    into v_email_hmac
    from public.customers
    where id = v_invite.attached_customer_id;
  end if;

  if v_email_hmac is null then
    return false;
  end if;

  perform public.suppress_reward_invite_email(
    v_invite.merchant_id, v_email_hmac, 'unsubscribed');

  return true;
end;
$$;

revoke all on function public.suppress_reward_invite_email_by_token(text)
  from public, anon, authenticated;
grant execute on function public.suppress_reward_invite_email_by_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Re-consent after an opt-out must be recordable
-- ---------------------------------------------------------------------------
-- The index cannot express "unless a later withdrawal exists", so the guard
-- moves into the function and the index is dropped. Replay is still bounded:
-- the insert is skipped whenever the current effective state is already opted
-- in, and direct caller writes remain revoked with a trigger backstop.
drop index if exists public.consent_records_customer_join_once_idx;

create or replace function public.join_consent_already_granted(
  p_merchant_id uuid,
  p_customer_id uuid,
  p_channel text,
  p_policy_version text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Deterministic on ties. Ordering by (created_at, id) is not: consent rows
  -- written inside one transaction share now(), and `id` is a random uuid, so
  -- "the latest row" would be decided by uuid sort order. Instead take every
  -- row at the newest timestamp and treat the key as granted only if they ALL
  -- say opted_in — so an ambiguous tie records the customer's explicit
  -- re-consent rather than silently discarding it.
  select coalesce(
    (
      select bool_and(latest.consent_status = 'opted_in')
      from public.consent_records latest
      where latest.merchant_id = p_merchant_id
        and latest.customer_id = p_customer_id
        and latest.channel = p_channel
        and latest.policy_version = p_policy_version
        and latest.created_at = (
          select max(peak.created_at)
          from public.consent_records peak
          where peak.merchant_id = p_merchant_id
            and peak.customer_id = p_customer_id
            and peak.channel = p_channel
            and peak.policy_version = p_policy_version
        )
    ),
    false
  );
$$;

revoke all on function public.join_consent_already_granted(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.join_consent_already_granted(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Backfill in-flight checkout attempts
-- ---------------------------------------------------------------------------
-- Bound before the trial ledger existed, so they were built when every session
-- carried a trial. Marking them introductory_28_day keeps the request body a
-- retry rebuilds byte-identical to the one Stripe already accepted.
update public.billing_checkout_attempts
set trial_policy = 'introductory_28_day'
where checkout_offer_bound
  and trial_policy is null;

-- Reproduced verbatim from 20260801160000 except the consent guard.
CREATE OR REPLACE FUNCTION public.join_customer_membership(p_customer_id uuid, p_merchant_slug text, p_qr_id text, p_marketing_opt_in boolean, p_policy_version text)
 RETURNS TABLE(membership_id uuid, created_membership boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  customer_record record;
  v_merchant_id uuid;
  v_loyalty_card_id uuid;
  v_qr_code_uuid uuid;
  v_merchant_status text;
  v_card_active boolean;
  v_billing_status text;
  v_requires_billing boolean;
  v_availability_reason text;
  v_merchant_name text;
  v_card_name text;
  v_reward_terms text;
  v_stamps_required integer;
  v_terms_json jsonb;
  v_terms_snapshot text;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;
  if p_policy_version is null or btrim(p_policy_version) = '' then
    raise exception 'Loyalty terms version required';
  end if;

  select customers.id, customers.auth_user_id, customers.email,
         customers.email_hmac, customers.email_verified_at,
         customers.phone_hmac, customers.phone_verified_at
  into customer_record
  from public.customers
  where customers.id = p_customer_id;

  if customer_record.id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('customer-identity:' || p_customer_id::text, 0)
  );

  select customers.id, customers.auth_user_id, customers.email,
         customers.email_hmac, customers.email_verified_at,
         customers.phone_hmac, customers.phone_verified_at
  into customer_record
  from public.customers
  where customers.id = p_customer_id;

  if customer_record.id is null or not (
    (customer_record.phone_hmac is not null and customer_record.phone_verified_at is not null)
    or
    (customer_record.email is not null and customer_record.email_verified_at is not null)
  ) then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  if not public.is_service_role_request() then
    if current_user_id is null
      or customer_record.auth_user_id is null
      or customer_record.auth_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Customer ownership required';
    end if;
  end if;

  if p_qr_id is not null and p_qr_id <> '' then
    select
      qr_codes.id,
      qr_codes.merchant_id,
      qr_codes.loyalty_card_id,
      merchants.status,
      loyalty_cards.is_active,
      billing_customers.status,
      merchants.requires_billing,
      merchants.business_name,
      loyalty_cards.card_name,
      loyalty_cards.reward_terms,
      loyalty_cards.stamps_required
    into
      v_qr_code_uuid,
      v_merchant_id,
      v_loyalty_card_id,
      v_merchant_status,
      v_card_active,
      v_billing_status,
      v_requires_billing,
      v_merchant_name,
      v_card_name,
      v_reward_terms,
      v_stamps_required
    from public.qr_codes
    join public.merchants on merchants.id = qr_codes.merchant_id
    join public.loyalty_cards on loyalty_cards.id = qr_codes.loyalty_card_id
    left join public.billing_customers on billing_customers.merchant_id = qr_codes.merchant_id
    where qr_codes.qr_id = p_qr_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
      and loyalty_cards.is_active
      and merchants.business_slug = p_merchant_slug;
  else
    select
      merchants.id,
      loyalty_cards.id,
      merchants.status,
      loyalty_cards.is_active,
      billing_customers.status,
      merchants.requires_billing,
      merchants.business_name,
      loyalty_cards.card_name,
      loyalty_cards.reward_terms,
      loyalty_cards.stamps_required
    into
      v_merchant_id,
      v_loyalty_card_id,
      v_merchant_status,
      v_card_active,
      v_billing_status,
      v_requires_billing,
      v_merchant_name,
      v_card_name,
      v_reward_terms,
      v_stamps_required
    from public.merchants
    join public.loyalty_cards on loyalty_cards.merchant_id = merchants.id
    left join public.billing_customers on billing_customers.merchant_id = merchants.id
    where merchants.business_slug = p_merchant_slug
      and loyalty_cards.is_active
    order by loyalty_cards.created_at asc
    limit 1;
  end if;

  if v_merchant_id is null or v_loyalty_card_id is null then
    raise exception 'This loyalty card is unavailable';
  end if;

  v_availability_reason := public.loyalty_availability_reason(
    v_merchant_status,
    v_card_active,
    v_billing_status,
    v_requires_billing
  );
  if v_availability_reason = 'billing_required' then
    raise exception 'This merchant loyalty programme is not active yet';
  elsif v_availability_reason in ('merchant_inactive', 'billing_blocked') then
    raise exception 'This merchant loyalty programme is not active';
  elsif v_availability_reason is not null then
    raise exception 'This loyalty card is unavailable';
  end if;

  insert into public.customer_memberships (merchant_id, customer_id)
  values (v_merchant_id, p_customer_id)
  on conflict (merchant_id, customer_id) do nothing
  returning id into membership_id;

  created_membership := membership_id is not null;
  if membership_id is null then
    select memberships.id
    into membership_id
    from public.customer_memberships memberships
    where memberships.merchant_id = v_merchant_id
      and memberships.customer_id = p_customer_id;
  end if;

  v_terms_json := jsonb_build_object(
    'merchant_name', v_merchant_name,
    'card_name', v_card_name,
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'reward',
        'body', 'A mystery reward is assigned from the venue reward pool when the customer earns the final visit stamp.'
      ),
      jsonb_build_object(
        'id', 'earning-rule',
        'body', format('Collect %s visit stamps from the venue QR. One stamp may be issued per UK date.', v_stamps_required)
      ),
      jsonb_build_object('id', 'stamps-needed', 'body', format('%s stamps', v_stamps_required)),
      jsonb_build_object(
        'id', 'redemption',
        'body', 'The assigned reward can be redeemed from the next UK business day after it is revealed. Show your reward QR at the counter and the venue team scans it.'
      ),
      jsonb_build_object(
        'id', 'exclusions',
        'body', coalesce(nullif(btrim(v_reward_terms), ''), 'No additional exclusions configured.')
      ),
      jsonb_build_object(
        'id', 'fraud-and-abuse',
        'body', 'The merchant may refuse, cancel, or adjust stamps and rewards where abuse, duplicate claims, QR misuse, or location anomalies are suspected. Location checks are non-blocking: stamps still save if location is denied, unavailable, timed out, or inaccurate.'
      ),
      jsonb_build_object('id', 'merchant-contact', 'body', 'Ask the venue team')
    )
  );
  v_terms_snapshot := v_terms_json::text;

  insert into public.customer_loyalty_terms_acceptances (
    membership_id,
    customer_id,
    merchant_id,
    loyalty_card_id,
    qr_code_id,
    policy_version,
    terms_snapshot,
    terms_sha256
  ) values (
    membership_id,
    p_customer_id,
    v_merchant_id,
    v_loyalty_card_id,
    v_qr_code_uuid,
    btrim(p_policy_version),
    v_terms_json,
    encode(extensions.digest(v_terms_snapshot, 'sha256'), 'hex')
  )
  on conflict on constraint customer_terms_membership_policy_unique do nothing;

  if p_marketing_opt_in then
    insert into public.consent_records (
      merchant_id, customer_id, channel, consent_status, source, policy_version, metadata
    )
    select
      v_merchant_id,
      p_customer_id,
      case when customer_record.email is not null then 'email' else 'sms' end,
      'opted_in',
      'customer_join',
      btrim(p_policy_version),
      jsonb_build_object('qr_code_id', v_qr_code_uuid)
    where not public.join_consent_already_granted(
      v_merchant_id,
      p_customer_id,
      case when customer_record.email is not null then 'email' else 'sms' end,
      btrim(p_policy_version)
    );
  end if;

  if created_membership then
    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, qr_code_id,
      actor_type, actor_id, metadata
    ) values (
      'customer_joined',
      v_merchant_id,
      p_customer_id,
      membership_id,
      v_qr_code_uuid,
      'customer',
      coalesce(current_user_id::text, p_customer_id::text),
      jsonb_build_object('marketing_opt_in', p_marketing_opt_in)
    );
  end if;

  return next;
end;
$function$;

revoke all on function public.join_customer_membership(uuid, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.join_customer_membership(uuid, text, text, boolean, text)
  to service_role;

notify pgrst, 'reload schema';
