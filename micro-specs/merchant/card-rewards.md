---
spec_id: MS-merchant-card-rewards
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/app/card/**
  - components/merchant/reward-collection-form.tsx
  - components/merchant/launch/rewards-panel.tsx
  - micro-specs/merchant/**
  - supabase/migrations/20260630131000_guard_reward_pool_minimum.sql
  - supabase/migrations/20260606142000_initial_schema_rls.sql
  - tests/db/merchant-card-rewards*.test.mjs
implementation_surfaces:
  - app/app/card/page.tsx
  - app/app/card/actions.ts
  - supabase/migrations/20260630131000_guard_reward_pool_minimum.sql
  - supabase/migrations/20260606142000_initial_schema_rls.sql
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/launch.md
  - micro-specs/merchant/qr-poster.md
related_tests:
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/unit/launch-readiness-core.test.mjs
  - app/dev/app-harness/launch/page.tsx
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-merchant-card-rewards — Loyalty card + mystery reward pool, ≥3-active guard

## Intent

A merchant defines one loyalty card (name + stamps required) and a pool of
**mystery** rewards. The reward shown to a customer is a surprise drawn from the
weighted pool, so a single named reward is never exposed. The product's
mystery-reward promise is protected by a database guard: while the join QR is
live, the active reward pool can never drop below three — deactivating or
deleting below that floor is rejected inside the RPC.

## Scope (in)

- `/app/card` (which redirects into `/app/launch?tab=card`) and the actions in
  `app/app/card/actions.ts`: `saveLoyaltyCardAction`, `saveRewardPoolItemAction`,
  `toggleRewardPoolItemActiveAction`, `deleteRewardPoolItemAction`.
- The RPCs `save_loyalty_card`, `upsert_reward_pool_item`,
  `delete_reward_pool_item`, and the `assert_reward_pool_launch_ready` guard.
- Default-pool seeding on first card creation.

## Scope (out)

- Launch readiness that consumes the pool count (owned by [MS-merchant-launch]);
  QR activation (owned by [MS-merchant-qr-poster]); how the customer draws a
  reward (owned by [MS-customer-card-stamp] / redeem). No schema/RLS change here.

## Decisions already made

- Card: name 2–80 chars, stamps required 3..`MAX_STAMPS_REQUIRED`, reward terms
  12–500 chars; the customer-facing reward name is the mystery placeholder
  ("Surprise reward").
- Reward pool item: name 1–100, terms 12–500, weight 1–1000, display order.
- `assert_reward_pool_launch_ready` raises **"Keep at least 3 active rewards
  before launch QR stays live"** when the join QR is active and active rewards
  would fall below `LAUNCH_MIN_ACTIVE_REWARDS` (3).
- `delete_reward_pool_item` **archives** (sets `is_active=false`) an item that has
  `reward_events`, and hard-deletes one that does not.
- Creating the first card seeds a default reward pool if the pool is empty.

## EARS requirements

- **CR-1 (save card):** WHEN a merchant saves a valid card, THE system SHALL
  persist it via `save_loyalty_card`, and on first creation SHALL seed a default
  reward pool if the pool is empty.
- **CR-2 (upsert reward):** WHEN a merchant saves a valid reward pool item, THE
  system SHALL upsert it via `upsert_reward_pool_item`.
- **CR-3 (≥3 guard, deactivate):** IF the join QR is active and deactivating a
  reward would leave fewer than three active rewards, THEN THE system SHALL reject
  the change with the at-least-3 message and leave the pool unchanged.
- **CR-4 (≥3 guard, delete):** IF the join QR is active and deleting/archiving a
  reward would leave fewer than three active rewards, THEN THE system SHALL reject
  it.
- **CR-5 (delete vs archive):** WHEN a reward with redemption history is removed,
  THE system SHALL archive it (`is_active=false`) rather than hard-delete; a
  reward with no history MAY be hard-deleted.
- **CR-6 (mystery):** THE customer-facing reward name SHALL remain the mystery
  placeholder; individual pool reward names SHALL NOT be exposed to customers.

## Verification method

Live-DB tier (`tests/db/merchant-card-rewards*.test.mjs`, to add): with an active
join QR and exactly three active rewards, assert that deactivating
(`toggle`/`upsert is_active=false`) or deleting a fourth-down-to-third reward is
rejected by `assert_reward_pool_launch_ready` (CR-3/CR-4), and that a reward with
`reward_events` is archived not deleted (CR-5) — all inside a rolled-back
transaction. The reward-gate-on-QR is also covered by
`tests/micro-specs/launch-qr-readiness.test.mjs`; the readiness threshold by
`tests/unit/launch-readiness-core.test.mjs`.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.
