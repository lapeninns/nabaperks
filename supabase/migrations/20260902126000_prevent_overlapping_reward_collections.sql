-- Keep one live merchant scan capability per reward and distinguish the caller
-- that performs the reward transition from a stale overlapping presentation.

alter table public.reward_scan_tokens
  add column if not exists superseded_at timestamptz;

-- Reconcile any overlap before adding the invariant. The newest token remains
-- live; older ephemeral capabilities are retired without pretending that a
-- merchant collected the reward.
with ranked as (
  select id,
         row_number() over (
           partition by reward_event_id
           order by expires_at desc, created_at desc, id desc
         ) as position
  from public.reward_scan_tokens
  where consumed_at is null
    and superseded_at is null
)
update public.reward_scan_tokens tokens
set superseded_at = now(),
    expires_at = '-infinity'::timestamptz
from ranked
where ranked.id = tokens.id
  and ranked.position > 1;

create unique index if not exists reward_scan_tokens_one_live_per_reward_idx
  on public.reward_scan_tokens (reward_event_id)
  where consumed_at is null and superseded_at is null;

create or replace function public.retire_previous_reward_scan_tokens()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('reward-scan-token:' || new.reward_event_id::text, 0)
  );

  update public.reward_scan_tokens
  set superseded_at = clock_timestamp(),
      expires_at = '-infinity'::timestamptz
  where reward_event_id = new.reward_event_id
    and consumed_at is null
    and superseded_at is null;

  return new;
end;
$function$;

drop trigger if exists reward_scan_tokens_retire_previous
  on public.reward_scan_tokens;
create trigger reward_scan_tokens_retire_previous
  before insert on public.reward_scan_tokens
  for each row execute function public.retire_previous_reward_scan_tokens();

revoke all on function public.retire_previous_reward_scan_tokens()
  from public, anon, authenticated;
grant execute on function public.retire_previous_reward_scan_tokens()
  to service_role;

create or replace function public.collect_current_reward_scan_token(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table (
  reward_event_id uuid,
  reward_name text,
  membership_id uuid,
  new_stamp_count integer
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_token record;
begin
  select tokens.id,
         tokens.merchant_id,
         tokens.consumed_at,
         tokens.superseded_at,
         tokens.expires_at,
         rewards.status as reward_status
  into v_token
  from public.reward_scan_tokens tokens
  join public.reward_events rewards on rewards.id = tokens.reward_event_id
  where tokens.id = p_scan_token
  for update of tokens, rewards;

  if v_token.id is null then
    raise insufficient_privilege using message = 'Reward scan token not found';
  end if;
  if v_token.merchant_id <> p_merchant_id then
    raise insufficient_privilege using message = 'Reward scan token belongs to a different merchant';
  end if;
  if v_token.superseded_at is not null then
    raise exception 'Reward scan token superseded';
  end if;
  if v_token.expires_at <= now() then
    raise exception 'Reward scan token expired';
  end if;
  if v_token.consumed_at is not null then
    raise exception 'Reward scan token already used';
  end if;
  if v_token.reward_status = 'redeemed' then
    raise exception 'Reward already collected';
  end if;

  return query
  select * from public.collect_reward_scan_token(p_scan_token, p_merchant_id);
end;
$function$;

revoke all on function public.collect_current_reward_scan_token(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.collect_current_reward_scan_token(uuid, uuid)
  to service_role;

-- Readback must describe the presented capability, not merely the reward. A
-- superseded form never becomes the form that collected the reward, even when
-- another token (or the customer's self-service path) later redeems it.
create or replace function public.get_reward_scan_context(
  p_scan_token uuid,
  p_merchant_id uuid
)
returns table(
  scan_status text,
  reward_event_id uuid,
  reward_name text,
  reward_terms text,
  membership_id uuid,
  current_stamp_count integer,
  customer_email text,
  customer_phone_last4 text,
  blocked_reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  scan_record record;
  availability_reason text;
begin
  select
    reward_scan_tokens.id as token_id,
    reward_scan_tokens.merchant_id as token_merchant_id,
    reward_scan_tokens.expires_at,
    reward_scan_tokens.consumed_at,
    reward_scan_tokens.superseded_at,
    reward_events.id as event_id,
    reward_events.status as event_status,
    reward_events.source as reward_source,
    reward_events.reward_name as assigned_reward_name,
    reward_events.reward_terms as assigned_reward_terms,
    reward_events.redeemable_from,
    customer_memberships.id as card_membership_id,
    customer_memberships.current_stamp_count as card_stamp_count,
    customers.email as safe_customer_email,
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
  customer_phone_last4 := scan_record.safe_customer_phone_last4;

  if scan_record.superseded_at is not null then
    scan_status := 'expired';
    return next;
    return;
  end if;

  if scan_record.consumed_at is not null then
    scan_status := 'redeemed';
    return next;
    return;
  end if;

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

revoke all on function public.get_reward_scan_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_reward_scan_context(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
