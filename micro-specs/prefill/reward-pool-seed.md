---
spec_id: MS-prefill-reward-pool-seed
status: active
risk_class: rls-rpc-ledger
owner: claude
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/prefill/**
  - app/app/card/actions.ts
  - components/merchant/launch/rewards-panel.tsx
  - lib/merchant/seed-default-reward-pool.ts
  - lib/merchant/default-reward-pool.ts
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
implementation_surfaces:
  - app/app/card/actions.ts
  - components/merchant/launch/rewards-panel.tsx
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
related_tests:
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
  - tests/e2e/merchant-reward-presets-flow.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "@reward-presets"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Node micro-spec output proving the card action and rewards panel no longer reference the reward-pool auto-seed.
  - pnpm test:db output proving the reward-pool RPC and RLS invariants are unchanged.
  - Playwright @reward-presets output proving the preset prefill path still fills the editor.
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-prefill-reward-pool-seed — Remove reward-pool auto-seed for true prefill

## 1. Exact Goal and User-Visible Outcomes

A new loyalty card's reward pool starts empty. Nabaperks no longer writes three
default "starter" rewards to the database on the merchant's behalf when a card is
created or the rewards tab is opened. Instead the merchant adds each reward
explicitly, prefilled with one tap from the existing business-typed reward-preset
chips, and a reward reaches the database only when they press Add. This removes the
"template content saved without a save" behaviour and stops pub-flavoured starter
rewards from being written for cafes, barbers, and other non-pub venues.

## 2. Blast Radius

In scope:

- `app/app/card/actions.ts` — remove the on-create seed call; a newly created card
  lands on the rewards tab without seeding.
- `components/merchant/launch/rewards-panel.tsx` — remove the on-render seed and
  the now-dead `seeded` banner branch.
- Delete `lib/merchant/seed-default-reward-pool.ts` and
  `lib/merchant/default-reward-pool.ts` (only the seed used them).
- Update the two micro-spec tests that asserted the seed.

Out of scope: the `upsert_reward_pool_item` RPC and reward-pool RLS (unchanged),
the reward-preset chips and the `RewardPoolForm` editor (already the prefill path),
the 3-active-reward launch gate, and any schema or migration change.

## 3. Strict Constraints and Assumptions

- No reward-pool row may be written except through the merchant's explicit
  Add/Save reward action. This is the program invariant, and this spec is the one
  place that violated it.
- No change to the `upsert_reward_pool_item` RPC, reward-pool RLS, or the loyalty
  ledger; this is an app-layer removal of an auto-write, proven by DB regression.
- Removing the seed deliberately changes the launch funnel: the pool is empty until
  the merchant activates at least three rewards (the existing gate is unchanged).
- No new dependencies.

## 4. Decisions Already Made

- Owner decision: no-persist true prefill (the pool starts empty; the preset chips
  are the prefill, and templates save only on an explicit Add).
- Card creation redirects to the rewards tab with no "saved" banner (nothing was
  saved yet); the empty-pool prompt and preset chips guide the next step.
- The reward-preset prefill UX already exists and is reused unchanged.

## 5. Behavioral Requirements (EARS)

- THE reward pool SHALL NOT be auto-seeded; a newly created card's pool starts
  empty.
- WHEN a merchant creates their first card, THE app SHALL land them on the rewards
  tab without writing any reward-pool row to the database.
- THE merchant SHALL add each reward explicitly; a reward-pool row is written only
  by the existing Add/Save reward action.
- WHERE the merchant taps a reward preset, THE reward editor SHALL prefill from that
  preset and persist only on the explicit Add (unchanged behaviour).
- THE `upsert_reward_pool_item` RPC and reward-pool RLS invariants SHALL remain
  unchanged.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify:

- The card action and the rewards panel contain no reference to the reward-pool
  auto-seed, and the seed modules are gone (micro-spec source tests).
- The reward-pool RPC/RLS behavioural tests still pass (pnpm test:db regression).
- In the DB-free harness, tapping a reward preset still prefills the reward editor
  (pnpm test:e2e @reward-presets).

Tasks:

1. Remove the seed call from the card action and the rewards panel; delete the seed
   modules.
2. Remove the dead `seeded` param and banner branch.
3. Invert the two micro-spec tests to assert no auto-seed.
4. Run the declared gates (including test:db), record evidence, and advance.
