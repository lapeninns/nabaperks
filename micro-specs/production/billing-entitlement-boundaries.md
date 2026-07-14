---
spec_id: MS-production-billing-entitlement-boundaries
status: verified
risk_class: migrations
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/production/**
  - supabase/migrations/20260713180000_enforce_reward_billing_entitlement.sql
  - tests/db/architecture-moat.test.mjs
  - lib/merchant/billing-status-copy.ts
  - tests/unit/billing-status-copy.test.mjs
  - micro-specs/production/billing-entitlement-boundaries.md
implementation_surfaces:
  - supabase/migrations/20260713180000_enforce_reward_billing_entitlement.sql
  - tests/db/architecture-moat.test.mjs
  - lib/merchant/billing-status-copy.ts
  - tests/unit/billing-status-copy.test.mjs
  - micro-specs/production/billing-entitlement-boundaries.md
related_tests:
  - tests/db/architecture-moat.test.mjs
  - tests/unit/billing-status-copy.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm governance:check
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-billing-entitlement-boundaries — Enforce billing entitlement across reward boundaries

## 1. Exact Goal and User-Visible Outcomes

When a billing-required merchant leaves `active` or `trialing`, every new stamp,
direct reward, and reward redemption pauses atomically while existing cards,
rewards, QR assets, and history remain visible for recovery.

## 2. Blast Radius

In scope: one forward-only trigger migration over reward transitions, DB
transition proof, merchant billing-state copy, focused unit proof, and this
record. Out of scope: Stripe products/prices/webhooks, existing reward history,
QR visibility, billing-provider configuration, and destructive schema rewrites.

## 3. Strict Constraints and Assumptions

- Server and database state remain authoritative; UI checks are not an
  entitlement boundary.
- `active` and `trialing` are the only billing statuses that allow loyalty value
  to be issued or redeemed when `requires_billing` is true.
- The migration is additive, replay-safe, service-role scoped, and leaves
  existing reward rows and scan tokens intact.
- A failed redemption must roll back token consumption and every reward/cycle
  mutation in the same transaction.
- Merchants that explicitly do not require billing retain current behaviour.

## 4. Decisions Already Made

- Enforce reward entitlement with table triggers so every current and future
  RPC crosses the same boundary instead of duplicating status checks.
- Guard newly unlocked reward inserts and transitions into `redeemed`; do not
  delete, cancel, or hide already-issued value when billing lapses.
- Keep the existing stamp trigger from the preceding production migration.
- Use one calm public error without provider details.

## 5. Behavioral Requirements (EARS)

- **BE-1:** WHILE billing is `active` or `trialing`, THE system SHALL preserve
  current reward issuance and redemption behaviour.
- **BE-2:** WHEN a billing-required merchant has no billing row or any other
  billing status, THE database SHALL reject a newly unlocked reward.
- **BE-3:** WHEN billing lapses after a scan token is minted, THE database SHALL
  reject redemption and SHALL leave the reward and token unconsumed.
- **BE-4:** WHEN billing does not apply to the merchant, THE database SHALL not
  introduce a reward entitlement block.
- **BE-5:** WHILE billing is inactive, THE merchant interface SHALL say that
  stamps and rewards are paused instead of claiming the card still works.

## 6. Verification Criteria and Task Breakdown

1. Reproduce direct reward issuance and pre-minted token redemption under
   `past_due` billing.
2. Add the forward migration and prove its trigger/ACL/replay contract.
3. Prove active/trialing success, past-due rejection, zero reward creation, and
   unchanged token/reward state after rejected collection.
4. Correct merchant copy and lock it with a focused unit assertion.
5. Run the declared gates and advance the governed lifecycle.
