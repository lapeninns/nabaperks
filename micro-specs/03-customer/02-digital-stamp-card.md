# Micro-Spec: Digital Stamp Card

## Exact Goal and User-Visible Outcomes

A customer can open their mobile digital stamp card, see 3-visit mystery progress, start a staff-approved stamp claim, and only see the exact reward after it has been assigned on the final visit.

## Blast Radius

In scope:

- `/card/[membership_id]`
- Customer membership, stamp count, reward status reads.
- Customer-facing card UI and empty/error states.
- Stamp claim entry point that leads into the staff PIN workflow.

Out of scope:

- Customer wallet across many merchants.
- Push notifications.
- Automated reminders.
- Customer editing profile preferences except consent links required by compliance specs.

## Strict Constraints and Assumptions

- The customer card is mobile-first with a max-width customer layout from `DESIGN.md`.
- The card must clearly show merchant name, card name, current stamp count, target visits, locked reward teaser, and mystery terms before unlock.
- After unlock, the card must show the assigned reward name, terms, minimum spend, and redeemable date from `reward_events`.
- Customers can only view their own memberships.
- Stamp count must be derived from trusted server-side state, not client-only state.
- The card must handle inactive merchant/card/subscription states gracefully.

## Decisions Already Made

- Route is `/card/{membership_id}`.
- Empty slots use dashed borders.
- Earned stamps use Honey Amber solid circular marks.
- Progress/success uses Mint/Fresh Green.

## Behavioral Requirements

- WHEN a customer opens their card before unlock, THE app SHALL show their current stamp count, target, and locked surprise reward teaser.
- WHEN a reward has been unlocked, THE app SHALL show the assigned reward details from `reward_events`, not mutable `loyalty_cards` fields.
- WHEN the customer is not authorized for the membership, THE app SHALL deny access.
- WHEN the card is active and stamp claiming is available, THE app SHALL show a clear claim-stamp action.
- WHEN the card is inactive, cancelled, or suspended, THE app SHALL explain that the loyalty card is unavailable without deleting history.
- WHEN the membership has enough stamps for a reward but `redeemable_from` is in the future, THE app SHALL show a come-back message instead of a redeem button.
- WHEN the membership has enough stamps for a reward and `redeemable_from` has arrived, THE app SHALL show the reward as ready to redeem.
- WHEN a reward has already been redeemed, THE app SHALL not show it as redeemable again.

## Verification Criteria

Acceptance criteria:

- Customer sees accurate progress after join.
- Card reflects stamp events after staff approval.
- Reward-ready state appears at the required stamp count.
- Unauthorized customers cannot view another customer's card.

Manual QA:

- View card at 0 stamps, partial progress, reward-ready, and redeemed states.
- Confirm mobile layout fits without overlapping text.
- Confirm card reloads with persisted server state.

Task breakdown:

- Implement card data loader.
- Implement mobile card UI states.
- Connect claim-stamp action to staff PIN flow.
- Verify authorization and state transitions.
