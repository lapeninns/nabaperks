# Micro-Spec: Reward Unlock and Redemption

## Exact Goal and User-Visible Outcomes

When a customer earns the third visit stamp, a surprise reward is assigned and revealed, but staff can only redeem it from the next UK business day. Redemption marks the persisted assigned reward used once and starts the customer's next 3-visit cycle.

## Blast Radius

In scope:

- Reward state logic tied to membership and stamp events.
- `/reward/[reward_id]`
- Staff confirmation for redemption through PIN or staff mode.
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
- Reward name, terms, minimum spend, and redeemable date must come from `reward_events`.
- Redemption must be server-side validated.
- A reward can be redeemed once only.
- Staff confirmation is required before marking a reward redeemed.
- The post-redemption stamp cycle must be understandable to customers and merchants.

## Decisions Already Made

- Reward statuses include unlocked, redeemed, cancelled, and expired.
- `redeemed_by` stores staff user or PIN reference.
- Reward screen route is `/reward/{reward_id}`.
- Staff redemption flow may use PIN or staff mode.

## Behavioral Requirements

- WHEN a membership reaches the required stamp count, THE system SHALL create exactly one reward event with assigned reward details.
- WHEN a customer opens an unlocked reward before `redeemable_from`, THE app SHALL show the assigned reward and a come-back message without the staff confirmation action.
- WHEN a customer opens a redeemable reward, THE app SHALL show the assigned reward name, terms, and staff confirmation action.
- WHEN the merchant edits the reward pool after assignment, THE existing customer reward SHALL keep its persisted details unchanged.
- WHEN staff confirms redemption with valid authority, THE system SHALL mark the reward as redeemed once.
- WHEN the same reward redemption is attempted again, THE system SHALL reject the duplicate attempt.
- WHEN redemption succeeds, THE system SHALL update membership reward totals and start the next visible stamp cycle.
- WHEN reward redemption succeeds or fails for a security reason, THE system SHALL record audit/product events.

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
- Redeem with valid staff PIN.
- Refresh reward page and confirm it is no longer redeemable.
- Attempt duplicate redemption from another browser session.
- Confirm reward event and audit readback.

Task breakdown:

- Define reward state transitions.
- Implement reward page and staff confirmation.
- Implement duplicate-safe redemption mutation.
- Verify customer, merchant, audit, and product event states.
