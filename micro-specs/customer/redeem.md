---
spec_id: MS-customer-redeem
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/reward/**
  - lib/customer/**
  - micro-specs/customer/**
  - tests/e2e/customer-redeem*.spec.ts
implementation_surfaces:
  - app/reward/[rewardId]/page.tsx
  - app/reward/[rewardId]/status/route.ts
  - lib/customer/reward-qr.ts
  - supabase/migrations/20260615130000_reward_redemption_cycles.sql
  - supabase/migrations/20260617110000_backend_hardening.sql
  - supabase/migrations/20260630123000_cleanup_reward_scan_tokens.sql
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/reward-scan.md
related_tests:
  - tests/db/reward-scan-single-use.test.mjs
  - tests/db/architecture-moat.test.mjs
  - tests/micro-specs/reward-scan-token-retention.test.mjs
  - tests/micro-specs/customer-home-rewards.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-customer-redeem — Reward QR, single-use scan token, status poll

## Intent

When a member's card fills, they hold a redeemable reward at
`/reward/[rewardId]`. The page shows a QR backed by a **single-use scan token**
that the merchant scans to hand over the reward; the customer's page polls a
status endpoint and flips to "redeemed" once the merchant collects it. A token
is short-lived (10 minutes) and reusable only while unexpired and unconsumed;
once consumed it cannot mint a fresh collection, and redemption itself is
idempotent — a redeemed reward never decrements stock twice.

## Scope (in)

- The reward page `/reward/[rewardId]`, its profile gate, and the status poll
  `/reward/[rewardId]/status`.
- The token lifecycle: `create_reward_scan_token` (mint / reuse-while-unexpired /
  purge expired) and the `reward_scan_tokens` table (`expires_at`,
  `consumed_at`, `consumed_by_merchant_id`).
- The `redeem_self_service_reward` RPC and its idempotency.

## Scope (out)

- The merchant side that consumes the token (`get_reward_scan_context`,
  `collect_reward_scan_token`) — owned by [MS-merchant-scan-pos].
- Stamp issuance / cycle mechanics — owned by [MS-customer-card-stamp].
- Reward-pool authoring, rewards history list — separate specs. No schema/RLS
  change.

## Decisions already made

- `reward_scan_tokens` (def `20260617110000_backend_hardening.sql`): `expires_at`
  defaults to `now() + 10 minutes`; `consumed_at` + `consumed_by_merchant_id`
  mark a single consumption.
- `create_reward_scan_token(p_reward_event_id, p_customer_id)` first purges
  expired tokens, then **reuses** an existing unconsumed token that still has
  more than 5 minutes of life, else inserts a new one (newest def:
  `20260630123000_cleanup_reward_scan_tokens.sql`).
- `redeem_self_service_reward(p_reward_event_id, p_customer_id, …)` returns the
  already-redeemed state without a second decrement when `status = 'redeemed'`
  (def `20260615130000_reward_redemption_cycles.sql`).
- The status route is GET-only, `force-dynamic`, `no-store`, and returns
  `{ redeemed, status, redeemedAt }` for the authenticated customer only.

## EARS requirements

- **R-1 (token mint):** WHEN a member opens a redeemable reward, THE system SHALL
  make available a scan token for that reward with an `expires_at` in the future
  and `consumed_at` null.
- **R-2 (token reuse window):** WHEN the reward page is re-opened while an
  unconsumed token still has more than five minutes of life, THE system SHALL
  reuse that token rather than minting a second live token.
- **R-3 (token expiry):** IF a token's `expires_at` has passed, THEN it SHALL NOT
  be usable and expired tokens SHALL be purged on the next mint.
- **R-4 (single-use):** THE system SHALL allow a token to be consumed at most
  once; once `consumed_at` is set the token SHALL NOT authorise a second
  collection.
- **R-5 (idempotent redemption):** IF a reward is already `redeemed`, THEN
  `redeem_self_service_reward` SHALL return the redeemed state without issuing a
  second redemption or altering stamp count.
- **R-6 (status poll):** WHILE a reward is unredeemed, THE status endpoint SHALL
  report `redeemed = false`; WHEN the merchant collects it, THE endpoint SHALL
  report `redeemed = true` with a `redeemedAt`.
- **R-7 (profile gate):** IF the customer's required profile fields are
  incomplete, THEN THE reward page SHALL present the profile gate before exposing
  a collectable token.
- **R-8 (no cross-customer):** THE status endpoint and token SHALL only ever
  reflect the authenticated customer's own reward.

## Verification method

Live-Supabase tier: mint a token via the RPC and assert one live
`reward_scan_tokens` row (R-1); call again and assert the same id is returned
(R-2); expire it and assert it is purged/unusable (R-3); mark consumed and assert
a second collection is refused (R-4); call `redeem_self_service_reward` twice and
assert a single redemption + unchanged count (R-5). DB-free harness tier proves
the reward page + profile gate render and the status route shape.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:e2e` ·
`pnpm test:db`.

## Verification log — 2026-06-30

Live-DB tier green via `pnpm test:db`:
`tests/db/reward-scan-single-use.test.mjs` manufactures a genuinely-ready reward
(full card + completed profile gate) inside a rolled-back transaction, then
proves **R-1** (mint yields a live unconsumed token with a future `expires_at`),
**R-4** (a consumed token cannot be collected again), and the redemption side of
**MS-2**. The concurrency race in `tests/db/architecture-moat.test.mjs` ("two
reward collection scans race for one token → only one collection advances the
cycle") covers single-use atomicity. Token reuse/expiry (R-2/R-3) is also
guarded by the existing `tests/micro-specs/reward-scan-token-retention.test.mjs`.
Verdict: **READY** for R-1/R-4; R-2/R-3/R-5/R-7 authored, partially covered.
