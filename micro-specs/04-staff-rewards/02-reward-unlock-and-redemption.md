---
spec_id: MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION
status: active
risk_class: rls-rpc-ledger
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/app/rewards/**
  - app/reward/**
  - lib/customer/reward.ts
  - lib/merchant/reward-collection.ts
  - micro-specs/04-staff-rewards/02-reward-unlock-and-redemption.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
  - supabase/tests/**
implementation_surfaces:
  - app/reward/**
  - app/app/rewards/**
  - lib/customer/reward.ts
  - lib/merchant/reward-collection.ts
  - supabase/migrations/**
  - supabase/tests/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/merchant-scanned-reward.test.ts
  - tests/micro-specs/reward-redemption-cycles.test.ts
  - tests/micro-specs/reward-profile-gate.test.ts
  - supabase/tests/reward_redemption_cycles.sql
  - supabase/tests/profile_completion_gate.sql
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm security:verify
approved_exceptions: []
---

# Micro-Spec: Reward Unlock and Redemption

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

When a customer earns the required visit stamp, a surprise reward is assigned
and revealed. The customer can redeem it once from the next UK business day by
tapping the reward page.

## Blast Radius

In scope:

- Reward state logic tied to memberships and stamp events.
- `/reward/[reward_id]`
- `redeem_self_service_reward`
- Optional soft geofence fraud flags.
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
- Redemption redirects back to the customer card after success.

## Behavioral Requirements

- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-001** WHEN a membership reaches the required stamp count, THE system SHALL create
  exactly one reward event with assigned reward details.
- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-002** WHEN a customer opens an unlocked reward before `redeemable_from`, THE app
  SHALL show the assigned reward and a come-back message without a redeem
  action.
- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-003** WHEN a customer opens a redeemable reward, THE app SHALL show assigned reward
  name, terms, and self-service redeem action.
- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-004** WHEN the merchant edits the reward pool after assignment, THE existing
  customer reward SHALL keep its persisted details unchanged.
- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-005** WHEN the customer taps redeem and all server checks pass, THE system SHALL
  mark the reward as redeemed once.
- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-006** WHEN the same reward redemption is attempted again, THE system SHALL reject or
  replay the duplicate safely without creating another redemption.
- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-007** WHEN redemption succeeds, THE system SHALL update membership reward totals and
  start the next visible stamp cycle.
- **MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION-008** WHEN reward redemption succeeds or fails for a security reason, THE system
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
- Redeem from the reward page.
- Refresh reward page and confirm it is no longer redeemable.
- Attempt duplicate redemption from another browser session.
- Confirm reward event and audit readback.

Task breakdown:

- Define reward state transitions.
- Implement reward page and self-service redemption action.
- Implement duplicate-safe redemption mutation.
- Verify customer, merchant, audit, and product event states.
