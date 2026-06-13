# Micro-Spec: Loyalty Card Builder

## Exact Goal and User-Visible Outcomes

A merchant can create and edit one Mystery Visit Card and a custom reward pool. Customers see locked “Surprise reward” copy until visit 3, while the merchant controls the possible rewards, terms, weights, active state, and display order.

## Blast Radius

In scope:

- `/app/card`
- Loyalty card creation and update actions.
- Reward pool create, edit, disable, delete-if-unused, archive-if-used, ordering, and weighting.
- `loyalty_cards` and `reward_pool_items` reads/writes.
- Validation for reward configuration and customer-facing terms.
- Preview UI using `DESIGN.md` stamp-card conventions.

Out of scope:

- Multiple active cards per location.
- Points-based loyalty.
- Referral rewards.
- Automated reward expiry rules unless represented as display-only terms.
- POS spend verification.

## Strict Constraints and Assumptions

- MVP default is 3 visits unlock a surprise reward.
- A merchant may have one active loyalty card in MVP.
- Required card fields: card name, visits to reveal, mystery terms.
- Required reward pool fields: reward name, reward terms, integer weight, active state, display order.
- Optional reward pool field: minimum spend in pence.
- Exact reward odds are not shown to customers in MVP.
- Customer-facing text must be clear enough to support promotions compliance review.
- Inactive cards must not issue new stamps.

## Decisions Already Made

- `loyalty_cards` belongs to merchant and location.
- `stamps_required` is an integer.
- `is_active` controls whether a card can be used.
- `loyalty_cards.reward_name` stores the locked-state teaser and defaults to `Surprise reward`.
- The customer UI displays empty and earned visit stamps as tactile circular marks.

## Behavioral Requirements

- WHEN a merchant opens `/app/card` without a card, THE app SHALL present a default 3-visit Mystery Visit Card setup.
- WHEN a merchant saves a valid card, THE system SHALL persist the card against their merchant and MVP location.
- WHEN a merchant saves a valid reward pool item, THE system SHALL persist it against the same merchant, location, and loyalty card.
- WHEN a merchant tries to save invalid values, THE system SHALL reject the save and explain the invalid fields.
- WHEN a merchant already has one active MVP card, THE system SHALL not create a second active card.
- WHEN a reward pool item has already been assigned to a customer reward, THE system SHALL archive it instead of hard-deleting the historical reward reference.
- WHEN a card is inactive, THE QR resolver and stamp issuing flows SHALL not permit new stamp claims for that card.
- WHEN a card is created or changed, THE system SHALL write an audit log and a `loyalty_card_created` or equivalent product event.

## Verification Criteria

Acceptance criteria:

- Merchant can create a 3-visit mystery card.
- Merchant can edit card name, visit count, mystery terms, and active state.
- Merchant can create, edit, disable, delete/archive, reorder, and weight reward pool items.
- Customer preview reflects locked reward copy and active reward count.
- The system enforces one active card per MVP location.

Manual QA:

- Save default card.
- Try stamps required values below 1 and unreasonably high values.
- Confirm another merchant cannot read or edit the card.
- Confirm audit/product event readback after create/update.

Task breakdown:

- Implement card builder UI.
- Implement validation and persistence.
- Implement active-card guard.
- Verify preview, tenant isolation, and events.
