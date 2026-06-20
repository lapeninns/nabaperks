-- Demo helper: every membership sits at 2/3 stamps with no stamp earned today
-- and no unlocked reward waiting. Idempotent — safe to re-run.

begin;

update public.reward_events
set
  status = 'cancelled',
  cancelled_reason = coalesce(cancelled_reason, 'seed_two_of_three_stamps'),
  updated_at = now()
where status = 'unlocked';

delete from public.stamp_events
where event_type = 'earned'
  and earned_business_date = public.uk_business_date(now());

delete from public.stamp_events se
using public.customer_memberships cm
where se.membership_id = cm.id
  and se.event_type = 'earned';

insert into public.stamp_events (
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  location_id,
  event_type,
  stamps_delta,
  earned_business_date,
  cycle_number,
  created_at,
  metadata
)
select
  cm.merchant_id,
  cm.customer_id,
  cm.id,
  lc.id,
  lc.location_id,
  'earned',
  1,
  public.uk_business_date(
    now() - ((2 - stamp_index.stamp_no + 1)::text || ' days')::interval
  ),
  cm.active_cycle_number,
  now() - ((2 - stamp_index.stamp_no + 1)::text || ' days')::interval,
  jsonb_build_object('source', 'seed_two_of_three_stamps')
from public.customer_memberships cm
join public.loyalty_cards lc
  on lc.merchant_id = cm.merchant_id
 and lc.is_active
cross join lateral generate_series(1, 2) as stamp_index(stamp_no);

update public.customer_memberships cm
set
  current_stamp_count = 2,
  total_stamps_earned = greatest(
    cm.total_stamps_earned,
    cm.total_rewards_redeemed * lc.stamps_required + 2
  ),
  last_visit_at = now() - interval '1 day',
  updated_at = now()
from public.loyalty_cards lc
where lc.merchant_id = cm.merchant_id
  and lc.is_active;

commit;
