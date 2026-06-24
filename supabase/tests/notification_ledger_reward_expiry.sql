begin;

select 'notification_ledger_reward_expiry_fixture';

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '76000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'notification-owner@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Notification Owner"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '76000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'notification-customer@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Notification Customer"}'::jsonb,
    false
  );

insert into public.merchants (
  id,
  owner_user_id,
  business_name,
  business_slug,
  business_type,
  email,
  status
)
values (
  '77000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  'Notification Ledger Venue',
  'notification-ledger-venue',
  'pub',
  'owner@nabaperks.test',
  'trial'
);

insert into public.merchant_locations (
  id,
  merchant_id,
  name,
  address
)
values (
  '77000000-0000-0000-0000-000000000002',
  '77000000-0000-0000-0000-000000000001',
  'Till',
  '1 Test Street'
);

insert into public.loyalty_cards (
  id,
  merchant_id,
  location_id,
  card_name,
  stamps_required,
  reward_name,
  reward_terms,
  reward_expires_after_days,
  is_active
)
values (
  '77000000-0000-0000-0000-000000000003',
  '77000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000002',
  'Ledger Card',
  3,
  'Ledger Reward',
  'Valid against one qualifying purchase.',
  null,
  true
);

insert into public.reward_pool_items (
  id,
  merchant_id,
  location_id,
  loyalty_card_id,
  reward_name,
  reward_terms,
  reward_expires_after_days,
  display_order
)
values (
  '77000000-0000-0000-0000-000000000004',
  '77000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000002',
  '77000000-0000-0000-0000-000000000003',
  'Ledger Reward',
  'Valid against one qualifying purchase.',
  7,
  1
);

insert into public.customers (
  id,
  auth_user_id,
  phone_hmac,
  phone_last4,
  phone_country,
  full_name,
  date_of_birth
)
values (
  '78000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000002',
  'notification-ledger-test-hmac',
  '2001',
  'GB',
  'Notification Customer',
  '1990-01-01'
);

insert into public.customer_memberships (
  id,
  merchant_id,
  customer_id,
  current_stamp_count,
  active_cycle_number
)
values (
  '79000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  3,
  1
);

select 'duplicate enqueue reuses one event';
do $$
declare
  first_event uuid;
  second_event uuid;
  event_count integer;
begin
  first_event := public.enqueue_notification_event(
    'reward_ready',
    '78000000-0000-0000-0000-000000000001',
    '77000000-0000-0000-0000-000000000001',
    '79000000-0000-0000-0000-000000000001',
    null,
    1,
    public.uk_business_date(now()),
    now(),
    'test:reward-ready:dedupe',
    '{"title":"Reward ready","url":"/home/rewards"}'::jsonb,
    '{"fixture":true}'::jsonb
  );
  second_event := public.enqueue_notification_event(
    'reward_ready',
    '78000000-0000-0000-0000-000000000001',
    '77000000-0000-0000-0000-000000000001',
    '79000000-0000-0000-0000-000000000001',
    null,
    1,
    public.uk_business_date(now()),
    now(),
    'test:reward-ready:dedupe',
    '{"title":"Reward ready","url":"/home/rewards"}'::jsonb,
    '{"fixture":true}'::jsonb
  );

  select count(*) into event_count
  from public.notification_events
  where dedupe_key = 'test:reward-ready:dedupe';

  if first_event <> second_event or event_count <> 1 then
    raise exception 'duplicate enqueue reuses one event failed';
  end if;
end $$;

select 'delivery attempts are append-only';
do $$
declare
  event_id uuid;
  delivery_id uuid;
begin
  select id into event_id
  from public.notification_events
  where dedupe_key = 'test:reward-ready:dedupe';

  delivery_id := public.record_notification_delivery(
    event_id,
    null,
    '78000000-0000-0000-0000-000000000001',
    'sent',
    1,
    201,
    null,
    '{"fixture":true}'::jsonb
  );

  begin
    update public.notification_deliveries
    set status = 'retryable_failure'
    where id = delivery_id;
    raise exception 'delivery attempts are append-only update unexpectedly succeeded';
  exception
    when others then
      null;
  end;
end $$;

select 'reward without configured expiry stays null';
insert into public.reward_events (
  id,
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  reward_name,
  reward_terms,
  redeemable_from,
  status,
  cycle_number
)
values (
  '7a000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  '79000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000003',
  'No Expiry Reward',
  'Valid against one qualifying purchase.',
  null,
  public.uk_business_date(now()),
  'unlocked',
  1
);

do $$
declare
  assigned_expires_at timestamptz;
begin
  select expires_at into assigned_expires_at
  from public.reward_events
  where id = '7a000000-0000-0000-0000-000000000001';

  if assigned_expires_at is not null then
    raise exception 'reward without configured expiry stays null failed';
  end if;
end $$;

select 'future assigned expiry remains redeemable';
insert into public.reward_events (
  id,
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  reward_pool_item_id,
  reward_name,
  reward_terms,
  redeemable_from,
  status,
  cycle_number
)
values (
  '7a000000-0000-0000-0000-000000000002',
  '77000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  '79000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000003',
  '77000000-0000-0000-0000-000000000004',
  'Future Expiry Reward',
  'Valid against one qualifying purchase.',
  null,
  public.uk_business_date(now()),
  'unlocked',
  1
);

update public.reward_events
set status = 'redeemed', redeemed_at = now()
where id = '7a000000-0000-0000-0000-000000000002';

select 'reward pool edits do not move assigned expiry';
do $$
declare
  before_edit timestamptz;
  after_edit timestamptz;
begin
  select expires_at into before_edit
  from public.reward_events
  where id = '7a000000-0000-0000-0000-000000000002';

  update public.reward_pool_items
  set reward_expires_after_days = 30
  where id = '77000000-0000-0000-0000-000000000004';

  select expires_at into after_edit
  from public.reward_events
  where id = '7a000000-0000-0000-0000-000000000002';

  if before_edit is null or before_edit <> after_edit then
    raise exception 'reward pool edits do not move assigned expiry failed';
  end if;
end $$;

select 'expired assigned reward cannot be redeemed';
insert into public.reward_events (
  id,
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  reward_name,
  reward_terms,
  redeemable_from,
  status,
  cycle_number,
  expires_at
)
values (
  '7a000000-0000-0000-0000-000000000003',
  '77000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  '79000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000003',
  'Expired Reward',
  'Valid against one qualifying purchase.',
  null,
  public.uk_business_date(now()),
  'unlocked',
  1,
  now() - interval '1 minute'
);

do $$
begin
  begin
    update public.reward_events
    set status = 'redeemed', redeemed_at = now()
    where id = '7a000000-0000-0000-0000-000000000003';
    raise exception 'expired assigned reward cannot be redeemed unexpectedly succeeded';
  exception
    when others then
      null;
  end;
end $$;

select 'scan-token expiry is not reward expiry';
insert into public.reward_scan_tokens (
  reward_event_id,
  merchant_id,
  customer_id,
  membership_id
)
values (
  '7a000000-0000-0000-0000-000000000001',
  '77000000-0000-0000-0000-000000000001',
  '78000000-0000-0000-0000-000000000001',
  '79000000-0000-0000-0000-000000000001'
);

do $$
declare
  assigned_expires_at timestamptz;
  scan_expires_at timestamptz;
begin
  select expires_at into assigned_expires_at
  from public.reward_events
  where id = '7a000000-0000-0000-0000-000000000001';

  select expires_at into scan_expires_at
  from public.reward_scan_tokens
  where reward_event_id = '7a000000-0000-0000-0000-000000000001';

  if assigned_expires_at is not null or scan_expires_at is null then
    raise exception 'scan-token expiry is not reward expiry failed';
  end if;
end $$;

select 'notification ledger reward expiry ok';

rollback;
