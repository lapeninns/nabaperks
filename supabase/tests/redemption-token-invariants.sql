begin;

insert into public.reward_events (
  id,
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  reward_name,
  reward_terms,
  min_spend_pence,
  status,
  redeemable_from
)
values (
  '38000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000001',
  '16000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  'Merchant scan test reward',
  'One per completed card.',
  0,
  'unlocked',
  public.uk_business_date(now())
)
on conflict (id) do update
set status = 'unlocked',
    redeemed_at = null,
    redeemed_by_user_id = null,
    redeemable_from = public.uk_business_date(now());

update public.customer_memberships
set current_stamp_count = 3,
    total_rewards_redeemed = 0
where id = '16000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  reward_id uuid := '38000000-0000-0000-0000-000000000001';
  customer_id uuid := '15000000-0000-0000-0000-000000000001';
  merchant_a uuid := '10000000-0000-0000-0000-000000000001';
  merchant_b uuid := '10000000-0000-0000-0000-000000000002';
  token_value text;
  lookup_status text;
  consume_status text;
  status_value text;
  stamp_count integer;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000301',
    true
  );

  select token.public_token
  into token_value
  from public.create_redemption_token(reward_id, customer_id) as token;

  if token_value is null or length(token_value) <> 12 then
    raise exception 'customer token issue returned invalid token %', token_value;
  end if;

  select token_status.status
  into status_value
  from public.get_redemption_token_status(reward_id, customer_id) as token_status;

  if status_value <> 'pending' then
    raise exception 'customer token status %, expected pending', status_value;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000102',
    true
  );

  select lookup.status
  into lookup_status
  from public.lookup_redemption_token_for_merchant(token_value, merchant_b) as lookup;

  if lookup_status <> 'not_found' then
    raise exception 'wrong merchant lookup status %, expected not_found', lookup_status;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000101',
    true
  );

  select lookup.status
  into lookup_status
  from public.lookup_redemption_token_for_merchant(token_value, merchant_a) as lookup;

  if lookup_status <> 'ready' then
    raise exception 'owning merchant lookup status %, expected ready', lookup_status;
  end if;

  select consumed.status, consumed.new_stamp_count
  into consume_status, stamp_count
  from public.consume_redemption_token(token_value, merchant_a) as consumed;

  if consume_status <> 'redeemed' or stamp_count <> 0 then
    raise exception 'consume returned status %, stamp count %, expected redeemed/0',
      consume_status,
      stamp_count;
  end if;

  select consumed.status, consumed.new_stamp_count
  into consume_status, stamp_count
  from public.consume_redemption_token(token_value, merchant_a) as consumed;

  if consume_status <> 'redeemed' or stamp_count <> 0 then
    raise exception 'duplicate consume returned status %, stamp count %, expected redeemed/0',
      consume_status,
      stamp_count;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000301',
    true
  );

  select token_status.status
  into status_value
  from public.get_redemption_token_status(reward_id, customer_id) as token_status;

  if status_value <> 'consumed' then
    raise exception 'customer final token status %, expected consumed', status_value;
  end if;
end $$;

rollback;
