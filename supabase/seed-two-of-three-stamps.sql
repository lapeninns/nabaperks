-- Demo helper: billed memberships sit at 2/3 stamps with no stamp earned today
-- and no unlocked reward waiting. Idempotent — safe to re-run.
--
-- Stamp inserts are gated by loyalty_billing_entitlement, so this must not
-- touch merchants whose billing is missing, paused, or past due (for example
-- leftover architecture-moat fixtures). Those rows would raise
-- "This loyalty programme is unavailable while billing is inactive".

begin;

update public.reward_events re
set
  status = 'cancelled',
  cancelled_reason = coalesce(re.cancelled_reason, 'seed_two_of_three_stamps'),
  updated_at = now()
from public.merchants m
left join public.billing_customers bc on bc.merchant_id = m.id
where m.id = re.merchant_id
  and re.status = 'unlocked'
  and public.loyalty_billing_entitled(m.requires_billing, bc.status);

delete from public.stamp_events se
using public.customer_memberships cm
join public.merchants m on m.id = cm.merchant_id
left join public.billing_customers bc on bc.merchant_id = m.id
where se.membership_id = cm.id
  and se.event_type = 'earned'
  and public.loyalty_billing_entitled(m.requires_billing, bc.status);

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
join public.merchants m on m.id = cm.merchant_id
left join public.billing_customers bc on bc.merchant_id = m.id
cross join lateral generate_series(1, 2) as stamp_index(stamp_no)
where public.loyalty_billing_entitled(m.requires_billing, bc.status);

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
join public.merchants m on m.id = lc.merchant_id
left join public.billing_customers bc on bc.merchant_id = m.id
where lc.merchant_id = cm.merchant_id
  and lc.is_active
  and public.loyalty_billing_entitled(m.requires_billing, bc.status);

commit;
