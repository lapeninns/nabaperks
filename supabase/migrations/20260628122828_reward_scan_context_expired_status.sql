-- Expired reward scan tokens get a stable, distinct scan_status='expired'
-- instead of collapsing to 'not_found' (which the page rendered as a 404).
--
-- This mirrors the collect path (collect_reward_scan_token), which already
-- raises 'Reward scan token expired' for the same expires_at <= now() case, so
-- the read and collect paths now agree on expiry via a stable status rather
-- than the read side silently degrading an expired token to not_found.
--
-- The TS loader (lib/merchant/reward-collection.ts) and the scan page already
-- map scan_status='expired' to a dedicated "Reward expired" banner; until this
-- migration is applied the RPC still returns 'not_found' and the page keeps its
-- current 404 behaviour, so the change is backward-compatible.
--
-- The function body is replicated verbatim from
-- 20260626090000_require_merchant_billing.sql with ONLY the expiry branch
-- changed (scan_status := 'not_found' -> 'expired'). The return signature is
-- preserved exactly — Postgres refuses to change a function's return type, and
-- this repo re-applies non-initial migrations on each run, so the signature
-- (including the vestigial min_spend_pence column) must stay identical.

-- Replay guard (MS-db-dead-field-cleanup): the final chain shape drops
-- min_spend_pence, so replays must drop before recreating this older shape.
drop function if exists public.get_reward_scan_context(uuid, uuid);
create or replace function public.get_reward_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  scan_status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  -- Retained in the return signature to match the earlier backend_hardening
  -- definition; CI re-applies that migration and Postgres refuses to change a
  -- function's return type. Left unassigned (null); no caller reads it.
  min_spend_pence integer,
  membership_id uuid,
  current_stamp_count integer,
  customer_email text,
  customer_phone text,
  customer_phone_last4 text,
  blocked_reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
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

  if scan_record.card_stamp_count < scan_record.stamps_required then
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

  scan_status := 'ready';
  return next;
end;
$$;

-- `create or replace` preserves existing privileges, but re-issue the lockdown
-- defensively so the function is not relying on grants set by an earlier
-- migration (idempotent on re-apply).
revoke all on function public.get_reward_scan_context(uuid, uuid) from public;
grant execute on function public.get_reward_scan_context(uuid, uuid) to service_role;
