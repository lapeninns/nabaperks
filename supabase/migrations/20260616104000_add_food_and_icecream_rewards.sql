-- Add two new active rewards for the seeded Old Crown Girton loyalty card.
-- Idempotent: each reward is inserted only if it does not already exist.

with target_card as (
  select
    loyalty_cards.id as loyalty_card_id,
    loyalty_cards.merchant_id,
    loyalty_cards.location_id,
    coalesce(max(reward_pool_items.display_order), 0) as base_display_order
  from public.loyalty_cards
  left join public.reward_pool_items
    on reward_pool_items.loyalty_card_id = loyalty_cards.id
  where loyalty_cards.id = '13000000-0000-0000-0000-000000000001'
  group by loyalty_cards.id, loyalty_cards.merchant_id, loyalty_cards.location_id
),
new_rewards as (
  select
    target_card.merchant_id,
    target_card.location_id,
    target_card.loyalty_card_id,
    '10% off Food'::text as reward_name,
    'Get 10% off food items. Valid from the next UK business day.'::text as reward_terms,
    null::integer as min_spend_pence,
    2::integer as weight,
    true as is_active,
    target_card.base_display_order + 1 as display_order
  from target_card
  union all
  select
    target_card.merchant_id,
    target_card.location_id,
    target_card.loyalty_card_id,
    'Free Honey Toffee IceCream'::text as reward_name,
    'One free Honey Toffee IceCream. Valid from the next UK business day.'::text as reward_terms,
    null::integer as min_spend_pence,
    2::integer as weight,
    true as is_active,
    target_card.base_display_order + 2 as display_order
  from target_card
)
insert into public.reward_pool_items (
  merchant_id,
  location_id,
  loyalty_card_id,
  reward_name,
  reward_terms,
  min_spend_pence,
  weight,
  is_active,
  display_order
)
select
  nr.merchant_id,
  nr.location_id,
  nr.loyalty_card_id,
  nr.reward_name,
  nr.reward_terms,
  nr.min_spend_pence,
  nr.weight,
  nr.is_active,
  nr.display_order
from new_rewards nr
where not exists (
  select 1
  from public.reward_pool_items existing
  where existing.loyalty_card_id = nr.loyalty_card_id
    and lower(existing.reward_name) = lower(nr.reward_name)
);
