# Micro-Spec: Reward Unlock and Redemption

## Exact Goal and User-Visible Outcomes

When a customer earns the required visit stamp, a surprise reward is assigned
and revealed. The customer can redeem it once from the next UK business day by
opening the reward page and showing a short-lived QR at the venue counter.

## Blast Radius

In scope:

- Reward state logic tied to memberships and stamp events.
- `/reward/[reward_id]`
- `create_redemption_token`
- `get_redemption_token_status`
- Merchant scan redemption in `/app/redeem`
- `reward_events` writes and membership reward counters.
- Duplicate redemption prevention.

Out of scope:

- Stored value, gift cards, cash balance, or payment settlement.
- Automated reward expiry beyond displayed merchant terms.
- Reward marketplace.
- Same-day redemption after reveal.
- Complex reward tiers.

## Strict Constraints and Assumptions

- Rewards are earned by reaching `stamps_required`, default 3.
- Reward name, terms, minimum spend, and redeemable date must come from
  `reward_events`.
- Redemption must be server-side validated.
- A reward can be redeemed once only.
- Optional GPS review is a soft signal and never blocks redemption.
- The post-redemption stamp cycle must be understandable to customers and
  merchants.

## Decisions Already Made

- Reward statuses include unlocked, redeemed, cancelled, and expired.
- Reward screen route is `/reward/{reward_id}`.
- Redeemable customer rewards display a one-time QR at `/r/{public_token}`.
- Redemption is confirmed by a signed-in merchant from `/app/redeem`.

## Behavioral Requirements

- WHEN a membership reaches the required stamp count, THE system SHALL create
  exactly one reward event with assigned reward details.
- WHEN a customer opens an unlocked reward before `redeemable_from`, THE app
  SHALL show the assigned reward and a come-back message without a redeem
  action.
- WHEN a customer opens a redeemable reward, THE app SHALL show assigned reward
  name, terms, and short-lived QR redemption token.
- WHEN a merchant scans or pastes a valid reward QR, THE app SHALL preview the
  assigned reward and customer label before confirmation.
- WHEN the merchant edits the reward pool after assignment, THE existing
  customer reward SHALL keep its persisted details unchanged.
- WHEN the merchant confirms redemption and all server checks pass, THE system
  SHALL mark the reward as redeemed once.
- WHEN the same reward redemption is attempted again, THE system SHALL reject or
  replay the duplicate safely without creating another redemption.
- WHEN redemption succeeds, THE system SHALL update membership reward totals and
  start the next visible stamp cycle.
- WHEN reward redemption succeeds or fails for a security reason, THE system
  SHALL record audit/product events.

## Verification Criteria

Acceptance criteria:

- Reward unlocks exactly at required stamp count.
- Redemption before `redeemable_from` fails.
- Reward details remain unchanged after merchant edits the pool.
- Redeemed reward cannot be redeemed again.
- Customer card reflects post-redemption state.
- Merchant activity shows reward redemption.

Manual QA:

- Earn enough stamps to unlock a reward.
- Open the reward page and scan or paste the QR from the merchant console.
- Refresh reward page and confirm it is no longer redeemable.
- Attempt duplicate redemption from another browser session.
- Confirm reward event and audit readback.

Task breakdown:

- Define reward state transitions.
- Implement reward page and redemption-token display.
- Implement duplicate-safe merchant scan redemption mutation.
- Verify customer, merchant, audit, and product event states.
