-- Bearer proofs bound to a purpose and an identity.
--
-- Two distinct defects in the direct-reward invite family:
--
--   1. ONE 256-bit value served as both the claim capability and the
--      unsubscribe capability (the email's unsubscribe link was just
--      `/claim/<claimToken>?unsubscribe=1`), and the resulting suppression row
--      was keyed by email_hmac ALONE — no merchant column existed — so one
--      leaked claim URL silently suppressed direct-reward email for that
--      address across every venue on the platform.
--
--   2. attach_matched_reward_invites accepted a claim-token match as an
--      ALTERNATIVE to the verified-contact match, so any signed-in customer
--      holding a leaked claim URL could take the reward, or stickily reserve
--      the invite so the genuine recipient never could.
--
-- The loyalty-invite family already models this correctly (separate
-- unsubscribe_token_hash, venue-scoped suppression); this brings the reward
-- family into line.
--
-- Closes: claim-token-global-unsubscribe, direct-reward-token-contact-bypass.

-- ---------------------------------------------------------------------------
-- 1. A separate, purpose-bound unsubscribe capability
-- ---------------------------------------------------------------------------
alter table public.pending_reward_invites
  add column if not exists unsubscribe_token_hash text;

create unique index if not exists pending_reward_invites_unsubscribe_token_hash_idx
  on public.pending_reward_invites (unsubscribe_token_hash)
  where unsubscribe_token_hash is not null;

-- ---------------------------------------------------------------------------
-- 2. Suppression is venue-scoped
-- ---------------------------------------------------------------------------
-- merchant_id stays NULLABLE on purpose: rows written before this migration
-- carry no scope and must keep suppressing EVERYWHERE. Narrowing them would
-- silently resume mailing people who already opted out.
alter table public.reward_invite_email_suppressions
  add column if not exists merchant_id uuid references public.merchants(id) on delete cascade;

alter table public.reward_invite_email_suppressions
  drop constraint if exists reward_invite_email_suppressions_pkey;

-- NULLS NOT DISTINCT so the legacy global row stays unique per address.
create unique index if not exists reward_invite_email_suppressions_scope_idx
  on public.reward_invite_email_suppressions (merchant_id, email_hmac)
  nulls not distinct;

-- Send-time check: a venue is suppressed by its own opt-out or by a legacy
-- platform-wide one.
create or replace function public.reward_invite_email_suppressed(
  p_merchant_id uuid,
  p_email_hmac text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reward_invite_email_suppressions s
    where s.email_hmac = p_email_hmac
      and (s.merchant_id is null or s.merchant_id = p_merchant_id)
  );
$$;

revoke all on function public.reward_invite_email_suppressed(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reward_invite_email_suppressed(uuid, text) to service_role;

-- Venue-scoped write, used by bounce/complaint handling and by the
-- token-resolved unsubscribe below.
create or replace function public.suppress_reward_invite_email(
  p_merchant_id uuid,
  p_email_hmac text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email_hmac is null or btrim(p_email_hmac) = '' then
    return;
  end if;

  insert into public.reward_invite_email_suppressions (merchant_id, email_hmac, reason)
  values (
    p_merchant_id,
    p_email_hmac,
    case when p_reason in ('unsubscribed', 'bounced', 'complained')
         then p_reason else 'unsubscribed' end
  )
  on conflict (merchant_id, email_hmac) do nothing;
end;
$$;

revoke all on function public.suppress_reward_invite_email(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.suppress_reward_invite_email(uuid, text, text) to service_role;

-- The unsubscribe capability itself. It derives merchant and address from the
-- invite, so the caller cannot choose whose mail to suppress, and it resolves
-- ONLY unsubscribe_token_hash — a claim token is not accepted here.
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
begin
  if p_unsubscribe_token_hash is null or btrim(p_unsubscribe_token_hash) = '' then
    return false;
  end if;

  select merchant_id, email_hmac
  into v_invite
  from public.pending_reward_invites
  where unsubscribe_token_hash = p_unsubscribe_token_hash;

  if v_invite is null or v_invite.email_hmac is null then
    return false;
  end if;

  perform public.suppress_reward_invite_email(
    v_invite.merchant_id, v_invite.email_hmac, 'unsubscribed');

  return true;
end;
$$;

revoke all on function public.suppress_reward_invite_email_by_token(text)
  from public, anon, authenticated;
grant execute on function public.suppress_reward_invite_email_by_token(text) to service_role;

-- Retire the unscoped signature so no caller can write a platform-wide
-- suppression again. Its only caller (app/claim/[token]/actions.ts) moves to
-- the token-resolved capability in the same change.
drop function if exists public.suppress_reward_invite_email(text, text);

-- ---------------------------------------------------------------------------
-- 3. The claim token locates an invite; the verified contact authorises it
-- ---------------------------------------------------------------------------
-- Reproduced verbatim from the effective 20260710092000 definition, with only
-- the match predicate changed.
CREATE OR REPLACE FUNCTION public.attach_matched_reward_invites(p_customer_id uuid, p_phone_hmac text DEFAULT NULL::text, p_email_hmac text DEFAULT NULL::text, p_claim_token_hash text DEFAULT NULL::text)
 RETURNS TABLE(attached_reward_event_id uuid, merchant_id uuid, membership_id uuid, reward_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
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
        or matched_customer_id = p_customer_id
      )
      -- A claim token may only NARROW the search. Accepting it as an
      -- alternative to the contact match let any signed-in holder of a leaked
      -- claim URL take the reward, or stickily reserve the invite so the real
      -- recipient never could.
      and (
        p_claim_token_hash is null
        or claim_token_hash = p_claim_token_hash
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
$function$;

revoke all on function public.attach_matched_reward_invites(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.attach_matched_reward_invites(uuid, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. A push endpoint has one active owner
-- ---------------------------------------------------------------------------
-- Uniqueness and the registration lookup were both scoped by
-- (customer_id, endpoint), and signing out never retired the row. So after a
-- second customer signed in on the same browser, BOTH accounts kept an active
-- subscription for that one endpoint and the previous owner's notifications
-- carried on being delivered to a device someone else is now using.
--
-- Reconcile the existing duplicates before the index can be created: keep the
-- most recently updated owner, retire the rest with an auditable reason.
with ranked as (
  select id,
         row_number() over (
           partition by md5(endpoint)
           order by updated_at desc, created_at desc, id
         ) as rn
  from public.push_subscriptions
  where enabled and revoked_at is null
)
update public.push_subscriptions s
set enabled = false,
    revoked_at = now(),
    failure_reason = 'ownership_reconciled',
    updated_at = now()
from ranked
where ranked.id = s.id
  and ranked.rn > 1;

create unique index if not exists push_subscriptions_one_active_owner_idx
  on public.push_subscriptions (md5(endpoint))
  where enabled and revoked_at is null;

CREATE OR REPLACE FUNCTION public.register_push_subscription_for_customer(p_customer_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL::text, p_permission_state text DEFAULT 'granted'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  subscription_id uuid;
  normalized_permission text := lower(trim(coalesce(p_permission_state, 'granted')));
begin
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;

  if normalized_permission not in ('prompt', 'granted', 'denied', 'unsupported', 'unknown') then
    raise exception 'Unsupported push permission state';
  end if;

  if length(trim(coalesce(p_endpoint, ''))) < 20 then
    raise exception 'Push endpoint is required';
  end if;

  if length(trim(coalesce(p_p256dh, ''))) < 20 or length(trim(coalesce(p_auth, ''))) < 8 then
    raise exception 'Push subscription keys are required';
  end if;

  insert into public.notification_preferences (customer_id)
  values (p_customer_id)
  on conflict (customer_id) do nothing;

  -- A push endpoint identifies a BROWSER, not an account. Serialise on the
  -- endpoint and retire any active row still owned by a different customer,
  -- otherwise the previous signed-in user keeps receiving this device's
  -- notifications after someone else signs in on it.
  perform pg_advisory_xact_lock(hashtextextended(trim(p_endpoint), 0));

  update public.push_subscriptions
  set enabled = false,
      revoked_at = now(),
      failure_reason = 'ownership_transferred',
      updated_at = now()
  where endpoint = trim(p_endpoint)
    and customer_id <> p_customer_id
    and enabled
    and revoked_at is null;

  select id
  into subscription_id
  from public.push_subscriptions
  where customer_id = p_customer_id
    and endpoint = trim(p_endpoint);

  if subscription_id is null then
    insert into public.push_subscriptions (
      customer_id,
      endpoint,
      p256dh,
      auth,
      user_agent,
      permission_state,
      enabled,
      revoked_at,
      last_seen_at,
      failure_reason
    )
    values (
      p_customer_id,
      trim(p_endpoint),
      trim(p_p256dh),
      trim(p_auth),
      nullif(left(trim(coalesce(p_user_agent, '')), 240), ''),
      normalized_permission,
      normalized_permission = 'granted',
      case when normalized_permission = 'granted' then null else now() end,
      now(),
      null
    )
    returning id into subscription_id;
  else
    update public.push_subscriptions
    set
      p256dh = trim(p_p256dh),
      auth = trim(p_auth),
      user_agent = nullif(left(trim(coalesce(p_user_agent, '')), 240), ''),
      permission_state = normalized_permission,
      enabled = normalized_permission = 'granted',
      revoked_at = case when normalized_permission = 'granted' then null else coalesce(revoked_at, now()) end,
      last_seen_at = now(),
      failure_reason = null
    where id = subscription_id;
  end if;

  return subscription_id;
end;
$function$;

revoke all on function public.register_push_subscription_for_customer(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_push_subscription_for_customer(uuid, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Mint the unsubscribe capability alongside the claim capability
-- ---------------------------------------------------------------------------
-- New trailing parameter with a default, so the old 10-argument call shape
-- keeps working while the caller migrates in the same change. Reproduced
-- verbatim except the added parameter and the added insert column.
CREATE OR REPLACE FUNCTION public.create_merchant_reward_invite(p_merchant_id uuid, p_email_hmac text, p_phone_hmac text, p_email_masked text, p_phone_last4 text, p_reward_name text, p_reward_terms text, p_personal_message text, p_reward_expires_after_days integer, p_claim_token_hash text, p_unsubscribe_token_hash text DEFAULT NULL::text)
 RETURNS TABLE(invite_id uuid, deduped boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  v_merchant record;
  v_name text := btrim(coalesce(p_reward_name, ''));
  v_terms text := btrim(coalesce(p_reward_terms, ''));
  v_message text := nullif(btrim(coalesce(p_personal_message, '')), '');
  v_days integer := coalesce(p_reward_expires_after_days, 30);
  v_billing_status text;
  v_has_active_card boolean;
  v_availability_reason text;
  v_id uuid;
begin
  select merchants.id, merchants.status, merchants.owner_user_id, merchants.requires_billing
  into v_merchant from public.merchants where merchants.id = p_merchant_id for update;
  if v_merchant.id is null then raise insufficient_privilege using message = 'Merchant not found'; end if;
  if not public.is_service_role_request() then
    if current_user_id is null or v_merchant.owner_user_id <> current_user_id then
      raise insufficient_privilege using message = 'Merchant owner access required';
    end if;
  end if;

  if p_email_hmac is null and p_phone_hmac is null then raise exception 'A contact is required for an invite'; end if;
  if v_name = '' or char_length(v_name) > 100 then raise exception 'Reward name must be 1 to 100 characters'; end if;
  if char_length(v_terms) not between 12 and 500 then raise exception 'Reward terms must be between 12 and 500 characters'; end if;
  if v_message is not null and char_length(v_message) > 240 then raise exception 'Message must be 240 characters or fewer'; end if;
  if v_days not between 1 and 365 then raise exception 'Reward expiry must be between 1 and 365 days'; end if;
  if p_claim_token_hash is null or btrim(p_claim_token_hash) = '' then raise exception 'A claim token is required'; end if;

  select billing_customers.status
  into v_billing_status
  from public.billing_customers
  where billing_customers.merchant_id = p_merchant_id;

  select exists (
    select 1 from public.loyalty_cards
    where merchant_id = p_merchant_id and is_active
  )
  into v_has_active_card;

  v_availability_reason := public.loyalty_availability_reason(
    v_merchant.status,
    v_has_active_card,
    v_billing_status,
    v_merchant.requires_billing
  );

  if v_availability_reason = 'merchant_inactive' then
    raise exception 'This merchant loyalty programme is not active';
  elsif v_availability_reason = 'card_inactive' then
    raise exception 'This loyalty card is not active';
  elsif v_availability_reason = 'billing_required' then
    raise exception 'This merchant loyalty programme is not active yet';
  elsif v_availability_reason = 'billing_blocked' then
    raise exception 'This merchant loyalty programme is unavailable';
  end if;

  -- Dedupe: an existing ACTIVE invite for the same contact is returned; the
  -- caller then sends no second email.
  select id into v_id from public.pending_reward_invites
  where merchant_id = p_merchant_id and status in ('pending', 'matched')
    and (
      (p_email_hmac is not null and email_hmac = p_email_hmac)
      or (p_phone_hmac is not null and phone_hmac = p_phone_hmac)
    )
  order by created_at desc limit 1;
  if v_id is not null then
    invite_id := v_id; deduped := true; return next; return;
  end if;

  insert into public.pending_reward_invites (
    merchant_id, created_by_user_id, email_hmac, phone_hmac, email_masked, phone_last4,
    reward_name, reward_terms, personal_message, reward_expires_after_days, claim_token_hash,
    unsubscribe_token_hash
  )
  values (
    p_merchant_id, current_user_id, p_email_hmac, p_phone_hmac, p_email_masked, p_phone_last4,
    v_name, v_terms, v_message, v_days, p_claim_token_hash,
    p_unsubscribe_token_hash
  )
  returning id into v_id;

  insert into public.product_events (event_name, merchant_id, actor_type, actor_id, metadata)
  values ('reward_invite_sent', p_merchant_id, 'merchant', coalesce(current_user_id::text, p_merchant_id::text),
    jsonb_build_object('invite_id', v_id, 'reward_name', v_name));

  insert into public.audit_logs (actor_type, actor_id, merchant_id, target_table, target_id, action, metadata)
  values ('merchant', coalesce(current_user_id::text, p_merchant_id::text), p_merchant_id,
    'pending_reward_invites', v_id, 'reward_invite_created',
    jsonb_build_object('reward_name', v_name, 'has_email', p_email_hmac is not null, 'has_phone', p_phone_hmac is not null));

  invite_id := v_id; deduped := false; return next;
end;
$function$;

-- The 10-argument overload would otherwise linger and let a caller mint an
-- invite with no unsubscribe capability at all.
drop function if exists public.create_merchant_reward_invite(
  uuid, text, text, text, text, text, text, text, integer, text);

revoke all on function public.create_merchant_reward_invite(
  uuid, text, text, text, text, text, text, text, integer, text, text)
  from public, anon;
-- The merchant console calls this with a user JWT
-- (app/app/customers/send-reward/actions.ts), so `authenticated` keeps EXECUTE
-- exactly as the 10-argument overload had it; the function self-guards on
-- merchant ownership.
grant execute on function public.create_merchant_reward_invite(
  uuid, text, text, text, text, text, text, text, integer, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
