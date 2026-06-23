begin;

select 'browser_push_notifications_fixture';

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
    '74000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'push-customer-a@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Push Customer A"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '74000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'push-customer-b@nabaperks.test',
    extensions.crypt('NabaperksDemo1!', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Push Customer B"}'::jsonb,
    false
  );

insert into public.customers (id, auth_user_id, phone_hmac, phone_last4, phone_country)
values
  (
    '75000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000001',
    'browser-push-test-hmac-a',
    '1001',
    'GB'
  ),
  (
    '75000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000002',
    'browser-push-test-hmac-b',
    '1002',
    'GB'
  );

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '74000000-0000-0000-0000-000000000001';

select public.register_push_subscription(
  'https://push.example.test/customer-a/browser-subscription-endpoint',
  'browser-push-test-p256dh-key-customer-a',
  'browser-push-test-auth-key-a',
  'Vitest Browser Push Customer A',
  'granted'
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.push_subscriptions;

  if visible_count <> 1 then
    raise exception 'customer A expected 1 visible subscription, saw %', visible_count;
  end if;
end $$;

set local request.jwt.claim.sub = '74000000-0000-0000-0000-000000000002';

select 'customer A cannot read customer B subscription';
do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.push_subscriptions;

  if visible_count <> 0 then
    raise exception 'customer A cannot read customer B subscription: customer B saw % rows', visible_count;
  end if;
end $$;

select public.disable_push_subscription(
  'https://push.example.test/customer-a/browser-subscription-endpoint'
);

set local request.jwt.claim.sub = '74000000-0000-0000-0000-000000000001';

do $$
declare
  still_enabled_count integer;
begin
  select count(*) into still_enabled_count
  from public.push_subscriptions
  where enabled;

  if still_enabled_count <> 1 then
    raise exception 'customer B disabled customer A subscription unexpectedly';
  end if;
end $$;

select 'opt-out disables future sends';
select *
from public.update_notification_preferences(false, false, false);

do $$
declare
  active_count integer;
  transactional boolean;
  reminder boolean;
  marketing boolean;
begin
  select count(*) into active_count
  from public.push_subscriptions
  where enabled;

  if active_count <> 0 then
    raise exception 'opt-out disables future sends: expected 0 enabled subscriptions, got %', active_count;
  end if;

  select
    notification_preferences.transactional_enabled,
    notification_preferences.reminder_enabled,
    notification_preferences.marketing_enabled
  into transactional, reminder, marketing
  from public.notification_preferences;

  if transactional or reminder or marketing then
    raise exception 'opt-out disables future sends: preferences still enabled';
  end if;
end $$;

select 'browser push notifications ok';

rollback;
