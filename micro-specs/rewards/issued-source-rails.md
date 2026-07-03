---
spec_id: MS-rewards-issued-source-rails
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-03
allowed_blast_radius:
  - supabase/migrations/20260704090000_issued_rewards_schema.sql
  - supabase/migrations/20260704091000_issued_reward_source_gates.sql
  - supabase/migrations/20260704094000_export_issued_reward_fields.sql
  - lib/customer/rewards.ts
  - lib/customer/issued-reward-display.ts
  - components/customer/reward-list-cards.tsx
  - app/home/(authed)/rewards/page.tsx
  - lib/notifications/delivery-worker.ts
  - lib/analytics/events.ts
  - lib/merchant/activity.ts
  - app/dev/home-harness/**
  - micro-specs/rewards/**
  - tests/db/issued-rewards-redemption.test.mjs
  - tests/db/issued-rewards-gate-parity.test.mjs
  - tests/db/issued-rewards-schema.test.mjs
  - tests/unit/issued-reward-display.test.mjs
  - tests/micro-specs/issued-reward-source-rails.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/e2e/customer-issued-rewards.spec.ts
  - tests/visual/**
implementation_surfaces:
  - supabase/migrations/20260704090000_issued_rewards_schema.sql
  - supabase/migrations/20260704091000_issued_reward_source_gates.sql
  - supabase/migrations/20260704094000_export_issued_reward_fields.sql
  - lib/customer/rewards.ts
  - lib/customer/issued-reward-display.ts
  - components/customer/reward-list-cards.tsx
  - app/home/(authed)/rewards/page.tsx
  - lib/notifications/delivery-worker.ts
  - lib/analytics/events.ts
  - lib/merchant/activity.ts
  - app/dev/home-harness/layout.tsx
  - app/dev/home-harness/rewards/page.tsx
  - app/dev/home-harness/fixtures.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/redeem.md
  - micro-specs/merchant/reward-scan.md
related_tests:
  - tests/db/issued-rewards-redemption.test.mjs
  - tests/db/issued-rewards-gate-parity.test.mjs
  - tests/db/issued-rewards-schema.test.mjs
  - tests/unit/issued-reward-display.test.mjs
  - tests/micro-specs/issued-reward-source-rails.test.mjs
  - tests/e2e/customer-issued-rewards.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates and related tests.
  - Live-DB proof that issued rewards redeem without touching the stamp cycle
    while every other trust gate still fires.
approved_exceptions: []
---

# MS-rewards-issued-source-rails — Shared source rails for issued rewards

## Intent

Rewards today are exclusively **earned**: a stamp card fills, a `reward_events`
row unlocks, and a merchant scan redeems it. This spec adds a **`source`** to the
existing ledger so a reward can also be **issued** — a birthday treat
(`birthday_month`) or a merchant-sent gift (`merchant_direct`) — while sharing the
exact same redemption flow, screens, expiry machinery, and trust gates as earned
rewards. This is the **rails** phase: it lands the schema, scopes the stamp
threshold to earned rewards, branches the redemption side-effects by source, and
surfaces the new sources on the customer wallet. It does **not** issue any
birthday or direct reward yet (those are the follow-up specs); the only new writes
here are schema, the birthday-config RPC, and display.

## Scope (in)

- `reward_events.source` (`stamp_cycle` | `birthday_month` | `merchant_direct`,
  default `stamp_cycle`) + `birthday_year`, their coherence + uniqueness
  constraints, and supporting indexes.
- The four scan/redeem functions made source-aware: `create_reward_scan_token`,
  `redeem_self_service_reward`, `get_reward_scan_context`,
  `collect_reward_scan_token`. The stamp-count gate applies to `stamp_cycle`
  only; the redemption side-effects branch by source; the missing 18+ gate is
  added to the read path for parity.
- `loyalty_cards` birthday-reward config columns + the
  `save_loyalty_card_birthday_reward` RPC (rails for the birthday spec; no UI
  here).
- `notification_events` accepting `birthday_reward_issued` +
  `merchant_reward_received` as `marketing` events (ledger twin only; app catalog
  + enqueue land in the birthday/direct specs).
- Customer wallet: source badge + expiry note on `/home/rewards`; the reward-ready
  push producer scoped to earned rewards.
- Analytics + activity registration of `reward_issued`, `reward_sent`,
  `reward_invite_sent` (names only; the RPCs that emit them land in later specs).
- `admin_export_customer_data` carrying `source` + `birthday_year`.

## Scope (out)

- Automatic birthday issuance, the birthday config UI, the DOB prompt — owned by
  [MS-rewards-customer-birthday].
- Merchant direct send + pending invites — owned by [MS-rewards-merchant-sent].
- Any change to stamp issuance, cycle reconciliation, or the earned-reward
  unlock path.

## Decisions already made

- `reward_events` has no unique index today; `cycle_number` is nullable and
  load-bearing (the reconcile anti-join at `20260630127000` relies on NULL never
  matching). Issued rewards therefore carry `cycle_number = null` and never brick
  a catch-up earned reward.
- The stamp-count threshold (`current_stamp_count < stamps_required`) is the
  ONLY gate that must not apply to issued rewards. Every other gate — profile
  completeness, 18+, merchant active, billing fail-closed, expiry, single-use
  scan token, geofence — stays identical for all sources (D5).
- Redemption side-effects are the landmine: an earned redemption does
  `stamps -= stamps_required`, `cycle += 1`, `redeemed += 1`. An issued
  redemption does `redeemed += 1` only, leaving stamps + cycle untouched.
- The three gate functions replicate their profile/stamp checks inline (none
  calls another), so each is reproduced verbatim with the source delta — matching
  the repo's reproduce-verbatim convention (see `20260703120000`).
- The read path (`get_reward_scan_context`) is currently missing the 18+ gate the
  mint/redeem paths already enforce — a known parity bug fixed here.

## EARS requirements

- **R-1 (source column):** THE `reward_events` table SHALL carry a non-null
  `source` constrained to `stamp_cycle`, `birthday_month`, or `merchant_direct`,
  defaulting to `stamp_cycle`, with `birthday_year` present IF AND ONLY IF
  `source = 'birthday_month'`.
- **R-2 (birthday uniqueness):** THE system SHALL allow at most one
  `birthday_month` reward per (`merchant_id`, `customer_id`, `birthday_year`)
  across all statuses.
- **R-3 (stamp gate scoped):** WHEN evaluating collectability in
  `create_reward_scan_token`, `redeem_self_service_reward`, and
  `get_reward_scan_context`, THE system SHALL apply the stamp-count threshold
  ONLY to `stamp_cycle` rewards; an issued reward SHALL be collectable below the
  stamp threshold.
- **R-4 (redemption side-effects by source):** WHEN a `stamp_cycle` reward is
  redeemed, THE system SHALL decrement `current_stamp_count` by `stamps_required`
  and advance `active_cycle_number`; WHEN an issued reward is redeemed, THE
  system SHALL increment `total_rewards_redeemed` only and leave
  `current_stamp_count` and `active_cycle_number` unchanged.
- **R-5 (trust gates preserved):** THE profile-completeness, 18+, merchant-active,
  billing, expiry, and single-use-scan gates SHALL fire for issued rewards
  identically to earned rewards.
- **R-6 (read-path 18+ parity):** IF the customer is under 18, THEN
  `get_reward_scan_context` SHALL return `blocked` with an "18 or over" reason,
  matching the mint/redeem gates.
- **R-7 (collect notification by source):** WHEN a `stamp_cycle` reward is
  collected, THE system SHALL enqueue `reward_collected_cycle_started`; WHEN an
  issued reward is collected, THE system SHALL NOT enqueue it (no new cycle
  began).
- **R-8 (reward-ready producer scoped):** THE `reward_ready` push producer SHALL
  enqueue only `stamp_cycle` rewards; the expiry reminders
  (`reward_expiring_soon`, `reward_expired`) SHALL remain for every source.
- **R-9 (customer display):** THE `/home/rewards` screen SHALL show a source
  badge ("Birthday treat" / "Sent by {venue}") and an expiry note for issued
  rewards, and SHALL continue to render earned rewards unchanged.
- **R-10 (analytics + activity registration):** `reward_issued`, `reward_sent`,
  and `reward_invite_sent` SHALL be registered product-event names and SHALL
  render in the merchant activity feed under the `reward` category with
  source-aware headlines.
- **R-11 (birthday config schema + RPC):** THE `loyalty_cards` table SHALL carry
  `birthday_reward_enabled`/`birthday_reward_name`/`birthday_reward_terms` with
  bounds (name 1–100, terms 12–500) and enabled ⇒ both present; the card owner
  SHALL be able to persist them via `save_loyalty_card_birthday_reward`, and a
  non-owner or an enable-without-terms request SHALL be rejected.
- **R-12 (notification ledger types):** THE `notification_events` CHECK and
  `notification_event_category` SHALL accept `birthday_reward_issued` and
  `merchant_reward_received` as `marketing` events.
- **R-13 (GDPR export completeness):** `admin_export_customer_data` SHALL include
  `source` and `birthday_year` for each exported reward event.

## Verification method

Live-Supabase tier (primary): manufacture issued + earned rewards inside
rolled-back transactions and assert — a below-threshold issued reward mints and
redeems while a below-threshold earned reward is refused (R-3); an issued
redemption bumps `total_rewards_redeemed` only, leaving stamps + cycle intact,
while an earned redemption still decrements + advances (R-4); profile/18+/billing
gates still fire for issued sources (R-5); the read path blocks under-18 (R-6);
collecting an issued reward skips `reward_collected_cycle_started` while an earned
collect enqueues it (R-7); the birthday CHECK + `save_loyalty_card_birthday_reward`
owner-auth (R-11); the notification category twin (R-12); the export fields (R-13).
Unit tier proves the pure display module (R-9). Micro-spec source-scan proves the
loader selects `source`, the producer is scoped (R-8), and the event names are
registered (R-10). DB-free `/dev/home-harness/rewards` + a Playwright spec prove
the badge/expiry render (R-9).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:coverage`
· `pnpm test:db` · `pnpm test:e2e`.

## Verification log — 2026-07-03

Red → Green → Refactor followed test-first. All new tests were proven red before
implementation (17 DB tests failed on the absent `source` column / gate logic; 6
micro-spec + the unit tests failed on the missing module/contracts), then driven
green.

- `pnpm test:db` — **54/54 green** (the 17 new invariants across
  `issued-rewards-redemption`, `issued-rewards-gate-parity`,
  `issued-rewards-schema` plus all 37 pre-existing DB tests). Proves R-1…R-7,
  R-11, R-12, R-13 against the real security-definer RPCs in rolled-back
  transactions.
- `pnpm test` — micro-specs (245) + unit (207) green (R-1, R-8, R-9, R-10).
- `pnpm test:coverage` — `lib/**` at 92.9% lines / 83.9% branches / 90.4%
  functions, above the 80/70/80 floor.
- `pnpm test:e2e` — `customer-issued-rewards.spec.ts` green on `mobile-safari`
  against `/dev/home-harness/rewards` (R-9 badge + expiry render).
- `pnpm typecheck`, `pnpm governance:check`, `pnpm tokens:check`,
  `pnpm claims:check`, `pnpm jsonld:check`, `pnpm bundle:check` — green.
- Production build verified via `next build --webpack` (the default Turbopack
  build only rejected a local `node_modules` symlink used for worktree
  verification; unrelated to this change).

Known pre-existing (out of scope, untouched here): `pnpm lint` reports 2 errors
in `components/motion/wet-ink.tsx` from the earlier `Motion` commit.

Verdict: **IMPLEMENTED** — rails landed; birthday issuance + merchant send +
invites are the follow-up specs.
