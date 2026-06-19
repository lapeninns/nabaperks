-- Demo helper: every membership reaches full stamps with an unlocked reward
-- redeemable from today's UK business date. Idempotent — safe to re-run.

update public.customer_memberships cm
set
  current_stamp_count = lc.stamps_required,
  total_stamps_earned = greatest(cm.total_stamps_earned, lc.stamps_required),
  last_visit_at = coalesce(cm.last_visit_at, now()),
  updated_at = now()
from public.loyalty_cards lc
where lc.merchant_id = cm.merchant_id
  and lc.is_active;

update public.reward_events
set
  redeemable_from = public.uk_business_date(now()),
  updated_at = now()
where status = 'unlocked';

insert into public.reward_events (
  merchant_id,
  customer_id,
  membership_id,
  loyalty_card_id,
  reward_pool_item_id,
  reward_name,
  reward_terms,
  min_spend_pence,
  redeemable_from,
  status,
  cycle_number,
  metadata
)
select
  cm.merchant_id,
  cm.customer_id,
  cm.id,
  lc.id,
  rpi.id,
  rpi.reward_name,
  rpi.reward_terms,
  rpi.min_spend_pence,
  public.uk_business_date(now()),
  'unlocked',
  cm.active_cycle_number,
  jsonb_build_object(
    'source', 'seed_rewards_ready_today',
    'selection_mode',
    case
      when cm.active_cycle_number = 1 then 'first_cycle_default'
      else 'weighted_random'
    end
  )
from public.customer_memberships cm
join public.loyalty_cards lc
  on lc.merchant_id = cm.merchant_id
 and lc.is_active
join lateral (
  select reward_pool_items.*
  from public.reward_pool_items
  where reward_pool_items.merchant_id = cm.merchant_id
    and reward_pool_items.location_id = lc.location_id
    and reward_pool_items.loyalty_card_id = lc.id
    and reward_pool_items.is_active
  order by
  case when cm.active_cycle_number = 1 then reward_pool_items.display_order end asc nulls last,
  reward_pool_items.created_at asc,
  reward_pool_items.id asc
  limit 1
) rpi on true
where cm.current_stamp_count >= lc.stamps_required
  and not exists (
    select 1
    from public.reward_events re
    where re.membership_id = cm.id
      and re.status = 'unlocked'
  );
