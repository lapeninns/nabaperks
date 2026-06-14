# Micro-Spec: Digital Stamp Card

## Exact Goal and User-Visible Outcomes

A customer can open their mobile digital stamp card, see mystery progress, scan
the venue QR to add one self-service stamp per UK business day, and only see
the exact reward after it has been assigned on the final visit.

## Blast Radius

In scope:

- `/card/[membership_id]`
- `/card/[membership_id]/stamp`
- Customer membership, stamp count, reward status, and venue QR context reads.
- Customer-facing card UI, self-service stamp confirmation, and empty/error
  states.

Out of scope:

- Customer wallet across many merchants.
- Push notifications.
- Automated reminders.
- Customer profile editing except consent links required by compliance specs.

## Strict Constraints and Assumptions

- The customer card is mobile-first with a max-width customer layout from
  `DESIGN.md`.
- The card must show merchant name, card name, current stamp count, target
  visits, locked reward teaser, and mystery terms before unlock.
- After unlock, the card must show assigned reward details from `reward_events`.
- Customers can only view their own memberships.
- The plain card page must not issue a stamp directly; stamping requires a fresh
  QR context.
- Stamp count must be derived from trusted server-side state.
- Optional GPS checks are soft anomaly signals only.

## Decisions Already Made

- Route is `/card/{membership_id}`.
- Stamp confirmation route is `/card/{membership_id}/stamp?qr={qr_id}`.
- Empty slots use dashed borders.
- Earned stamps use Honey Amber solid circular marks.
- Progress/success uses Mint/Fresh Green.

## Behavioral Requirements

- WHEN a customer opens their card before unlock, THE app SHALL show current
  stamp count, target, and locked surprise reward teaser.
- WHEN a reward has been unlocked, THE app SHALL show assigned reward details
  from `reward_events`, not mutable `loyalty_cards` fields.
- WHEN the customer is not authorized for the membership, THE app SHALL deny
  access.
- WHEN the customer opens the plain card page, THE app SHALL tell them to scan
  the venue code before adding a stamp.
- WHEN the customer opens the stamp route with a valid QR context, THE app SHALL
  show a self-service add-stamp action.
- WHEN GPS review is enabled, THE app SHALL request browser location before
  submit and continue without blocking if location is denied or unavailable.
- WHEN the membership has enough stamps for a reward but `redeemable_from` is in
  the future, THE app SHALL show a come-back message instead of a redeem button.
- WHEN a reward is ready, THE app SHALL show the reward as ready to redeem.
- WHEN a reward has already been redeemed, THE app SHALL not show it as
  redeemable again.

## Verification Criteria

Acceptance criteria:

- Customer sees accurate progress after join.
- Existing QR members route to stamp confirmation.
- Card reflects stamp events after self-service issue.
- Unauthorized customers cannot view another customer's card.
- Direct card-page stamping without QR context is blocked.

Manual QA:

- View card at 0 stamps, partial progress, reward-ready, and redeemed states.
- Scan QR as an existing member and confirm the stamp page opens.
- Deny location and confirm the stamp completes with a review flag.
- Confirm mobile layout fits without overlapping text.

Task breakdown:

- Implement card data loader.
- Implement mobile card UI states.
- Implement QR-context self-service stamp confirmation.
- Verify authorization and state transitions.
