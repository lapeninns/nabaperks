-- Loyalty integrity — one active loyalty card per merchant, guaranteed by the database.
--
-- WHY THIS EXISTS
-- Four hot-path functions resolve "the venue's card" with the same query shape:
--
--   select ... from public.loyalty_cards
--   where merchant_id = ... and is_active
--   order by created_at asc limit 1
--
-- issue_self_service_stamp (20260626090000), claim_offer_campaign (20260804120000),
-- create_offer_pass_scan_token and get_offer_pass_scan_context (20260803100300) all
-- assume that query returns THE card. Nothing in the schema made that true. The only
-- uniqueness that existed was loyalty_cards_one_active_per_location_idx
-- (20260606142000:265), which is per LOCATION, so two active cards under one merchant
-- was a legal state.
--
-- In that state the behaviour is not merely ambiguous, it is broken in a specific and
-- silent way: the stamp wrapper validates the scanned QR with
-- `qr_codes.loyalty_card_id = <resolved card>`, and the resolved card is always the
-- OLDEST. A QR belonging to any newer active card therefore fails as
-- 'Valid venue QR scan proof required' — the customer is told their scan proof is
-- invalid when in fact the venue has two cards. Offers inherit the same defect: a
-- claim resolves benefits against the oldest card's stamps_required.
--
-- WHAT THIS DOES
--   1. Reconciles existing data to the invariant the code already assumes, by
--      deactivating every active card except the oldest per merchant. This is
--      deliberately the SAME rule the functions apply (`order by created_at asc`), so
--      reconciliation cannot change which card any of them would have chosen.
--   2. Adds the partial unique index that makes the state unrepresentable from here on.
--
-- WHAT THIS DOES NOT DO
-- It does not delete a card, does not touch stamp_events, reward_events, memberships or
-- any issued benefit, and does not widen or narrow any ACL. A deactivated duplicate
-- keeps all of its history and can be re-activated once the older card is retired.
--
-- MULTI-SITE NOTE
-- lib/marketing/facts.ts records that multi-site rollout is out of scope and each venue
-- holds its own subscription, so one merchant = one venue = one active card is the
-- product's actual shape. This migration writes that down in the schema instead of
-- leaving it as an unasserted assumption in four function bodies.
--
-- Forward-only and re-runnable.

-- 1. Reconcile ---------------------------------------------------------------
-- Ranked by the functions' own tie-break (created_at asc, then id asc so the order is
-- total and the outcome deterministic when timestamps collide).
with ranked as (
  select
    cards.id,
    row_number() over (
      partition by cards.merchant_id
      order by cards.created_at asc, cards.id asc
    ) as card_rank
  from public.loyalty_cards cards
  where cards.is_active
)
update public.loyalty_cards cards
set is_active = false,
    updated_at = now()
from ranked
where ranked.id = cards.id
  and ranked.card_rank > 1;

-- 2. Make the invariant unrepresentable --------------------------------------
create unique index if not exists loyalty_cards_one_active_per_merchant_idx
  on public.loyalty_cards (merchant_id)
  where is_active;

comment on index public.loyalty_cards_one_active_per_merchant_idx is
  'One active loyalty card per merchant. issue_self_service_stamp, claim_offer_campaign, create_offer_pass_scan_token and get_offer_pass_scan_context all resolve the card with `where merchant_id = ... and is_active order by created_at asc limit 1`; this index is what makes that limit 1 a fact rather than an assumption.';

notify pgrst, 'reload schema';
