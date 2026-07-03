-- Push-marketing audience for Old Crown Girton so /app/announcements is testable locally.
-- Every current member gets push consent, marketing preference, and a seed subscription.
-- Safe to re-run.

begin;

delete from public.rate_limit_buckets
where bucket_key like 'venue-announcement:10000000-0000-0000-0000-000000000001:%';

insert into public.consent_records (
  id,
  merchant_id,
  customer_id,
  channel,
  consent_status,
  source,
  policy_version,
  created_at
)
select
  ('1c000000-0000-4000-8000-' || right(replace(cm.customer_id::text, '-', ''), 12))::uuid,
  cm.merchant_id,
  cm.customer_id,
  'push',
  'opted_in',
  'seed_announcement_audience',
  '2026-06-foundation',
  now()
from public.customer_memberships cm
where cm.merchant_id = '10000000-0000-0000-0000-000000000001'
on conflict (id) do update
set
  consent_status = excluded.consent_status,
  channel = excluded.channel,
  source = excluded.source;

insert into public.notification_preferences (customer_id, marketing_enabled)
select distinct cm.customer_id, true
from public.customer_memberships cm
where cm.merchant_id = '10000000-0000-0000-0000-000000000001'
on conflict (customer_id) do update
set
  marketing_enabled = true,
  updated_at = now();

insert into public.push_subscriptions (
  id,
  customer_id,
  endpoint,
  p256dh,
  auth,
  user_agent,
  permission_state,
  enabled,
  last_seen_at
)
select distinct on (cm.customer_id)
  ('1d000000-0000-4000-8000-' || right(replace(cm.customer_id::text, '-', ''), 12))::uuid,
  cm.customer_id,
  'https://fcm.googleapis.com/fcm/send/seed-' || replace(cm.customer_id::text, '-', ''),
  repeat('p', 32),
  repeat('a', 16),
  'seed-announcement-audience',
  'granted',
  true,
  now()
from public.customer_memberships cm
where cm.merchant_id = '10000000-0000-0000-0000-000000000001'
order by cm.customer_id
on conflict (id) do update
set
  enabled = true,
  revoked_at = null,
  permission_state = 'granted',
  last_seen_at = now();

commit;
