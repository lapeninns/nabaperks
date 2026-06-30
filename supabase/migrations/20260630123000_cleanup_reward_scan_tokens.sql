create index if not exists reward_scan_tokens_reusable_idx
  on public.reward_scan_tokens (reward_event_id, customer_id, expires_at desc)
  where consumed_at is null;

create or replace function public.purge_expired_reward_scan_tokens(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  purged_count integer;
begin
  delete from public.reward_scan_tokens
  where expires_at <= p_now;

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

create or replace function public.create_reward_scan_token(
  p_reward_event_id uuid,
  p_customer_id uuid
)
returns table (
  scan_token uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  reward_record record;
  availability_reason text;
  reusable_token record;
begin
  if p_customer_id is null then
    raise insufficient_privilege using message = 'Verified customer required';
  end if;

  perform public.purge_expired_reward_scan_tokens(now());

  select
    reward_events.id,
    reward_events.status,
    reward_events.merchant_id,
    reward_events.customer_id,
    reward_events.membership_id,
    reward_events.reward_name,
    reward_events.redeemable_from,
    customer_memberships.current_stamp_count,
    customers.full_name as customer_full_name,
    customers.date_of_birth as customer_date_of_birth,
    customers.email as customer_email,
    customers.email_verified_at as customer_email_verified_at,
    loyalty_cards.stamps_required,
    loyalty_cards.is_active as card_is_active,
    merchants.status as merchant_status,
    merchants.requires_billing,
    billing_customers.status as billing_status
  into reward_record
  from public.reward_events
  join public.customer_memberships
    on customer_memberships.id = reward_events.membership_id
  join public.customers
    on customers.id = reward_events.customer_id
  join public.loyalty_cards
    on loyalty_cards.id = reward_events.loyalty_card_id
  join public.merchants
    on merchants.id = reward_events.merchant_id
  left join public.billing_customers
    on billing_customers.merchant_id = reward_events.merchant_id
  where reward_events.id = p_reward_event_id
  for update of reward_events;

  if reward_record.id is null then
    raise insufficient_privilege using message = 'Reward not found';
  end if;

  if reward_record.customer_id <> p_customer_id then
    raise insufficient_privilege using message = 'Reward ownership required';
  end if;

  if reward_record.status = 'redeemed' then
    raise exception 'Reward already redeemed';
  end if;

  if reward_record.status <> 'unlocked' then
    raise exception 'Reward is not ready to collect';
  end if;

  if reward_record.redeemable_from is not null
    and reward_record.redeemable_from > public.uk_business_date(now()) then
    raise exception 'Reward is not redeemable until the next UK business day';
  end if;

  availability_reason := public.loyalty_availability_reason(
    reward_record.merchant_status,
    reward_record.card_is_active,
    reward_record.billing_status,
    reward_record.requires_billing
  );

  if availability_reason is not null then
    raise exception 'This loyalty programme is unavailable right now';
  end if;

  if reward_record.current_stamp_count < reward_record.stamps_required then
    raise exception 'Reward is not ready to redeem';
  end if;

  if reward_record.customer_full_name is null
    or btrim(reward_record.customer_full_name) = ''
    or reward_record.customer_date_of_birth is null
    or (reward_record.customer_email is not null
        and reward_record.customer_email_verified_at is null) then
    raise exception 'Complete your profile before redeeming';
  end if;

  select
    reward_scan_tokens.id,
    reward_scan_tokens.expires_at
  into reusable_token
  from public.reward_scan_tokens
  where reward_scan_tokens.reward_event_id = reward_record.id
    and reward_scan_tokens.customer_id = reward_record.customer_id
    and reward_scan_tokens.consumed_at is null
    and reward_scan_tokens.expires_at > now() + interval '5 minutes'
  order by reward_scan_tokens.expires_at desc
  limit 1;

  if reusable_token.id is not null then
    scan_token := reusable_token.id;
    expires_at := reusable_token.expires_at;
    return next;
    return;
  end if;

  insert into public.reward_scan_tokens (
    reward_event_id,
    merchant_id,
    customer_id,
    membership_id
  )
  values (
    reward_record.id,
    reward_record.merchant_id,
    reward_record.customer_id,
    reward_record.membership_id
  )
  returning id, reward_scan_tokens.expires_at
  into scan_token, expires_at;

  return next;
end;
$$;

revoke all on function public.purge_expired_reward_scan_tokens(timestamptz) from public;
revoke all on function public.create_reward_scan_token(uuid, uuid) from public;

grant execute on function public.purge_expired_reward_scan_tokens(timestamptz) to service_role;
grant execute on function public.create_reward_scan_token(uuid, uuid) to service_role;
