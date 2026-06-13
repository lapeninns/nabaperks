# Micro-Spec: Staff PIN Stamp Issuing

## Exact Goal and User-Visible Outcomes

Staff can approve one customer visit stamp per UK date in seconds by entering a merchant staff PIN. The customer sees their stamp count update, and the final visit atomically reveals one assigned mystery reward.

## Blast Radius

In scope:

- Customer claim-stamp action from `/card/[membership_id]`.
- Staff PIN prompt or `/staff/stamp` where appropriate.
- Server-side stamp issuing action.
- Staff PIN validation, failed-attempt rate limits, cooldown checks, audit logs, and product events.
- `stamp_events` and `customer_memberships` updates.

Out of scope:

- Full staff account login.
- Staff scheduling or permissions management UI.
- POS transaction verification.
- Self-service customer stamp issuing without staff approval.

## Strict Constraints and Assumptions

- MVP stamp approval uses staff PIN.
- The server validates active QR/card, billing access, rate limits, cooldown, and customer membership.
- A customer cannot receive more than one earned stamp per membership/location/UK date.
- A final stamp cannot be issued unless at least one active reward pool item exists.
- Failed staff PIN attempts are rate-limited.
- Stamp mutation must be atomic: event creation and membership count update cannot drift.

## Decisions Already Made

- Staff workflow starts when customer taps "Claim stamp."
- Staff enters merchant PIN.
- Event type for normal stamp is `earned`.
- Dashboard metrics derive from stamp events and membership totals.

## Behavioral Requirements

- WHEN a customer starts a stamp claim, THE app SHALL require staff approval before issuing a stamp.
- WHEN staff enters a valid PIN and all server checks pass, THE system SHALL create a `stamp_events` record and increment membership progress.
- WHEN staff enters an invalid PIN, THE system SHALL reject the stamp and count the failed attempt for rate limiting.
- WHEN the customer has already received a stamp for the membership/location/UK date, THE system SHALL reject the duplicate attempt.
- WHEN the stamp would complete the visit target, THE system SHALL select one active reward pool item using integer weights and persist its details into `reward_events`.
- WHEN the merchant billing state is cancelled or suspended, THE system SHALL block new stamp issuance according to billing rules.
- WHEN a stamp is issued, THE system SHALL write `stamp_issued` to product events and an audit entry with non-sensitive metadata.

## Verification Criteria

Acceptance criteria:

- Valid staff PIN issues one stamp.
- Invalid staff PIN does not change stamp count.
- UK-date gating prevents duplicate visit stamps.
- Final stamp creates exactly one assigned reward event.
- Stamp event and membership count stay consistent.
- Customer UI updates after success.

Manual QA:

- Issue first stamp after customer joins.
- Try three invalid PIN attempts and confirm rate-limit behaviour.
- Attempt a second stamp inside cooldown.
- Confirm event and audit readback.
- Confirm another merchant's PIN cannot approve this customer's stamp.

Task breakdown:

- Implement PIN validation model.
- Implement atomic stamp issuing action.
- Add cooldown and failed-attempt controls.
- Verify UI success/failure states and readback.
