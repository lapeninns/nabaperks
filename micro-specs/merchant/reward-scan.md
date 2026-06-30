---
spec_id: MS-merchant-scan-pos
status: implemented
risk_class: rls-rpc-ledger
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/app/scan/**
  - app/app/rewards/scan/**
  - lib/merchant/reward-collection.ts
  - micro-specs/merchant/**
  - tests/e2e/merchant-reward-scan*.spec.ts
implementation_surfaces:
  - app/app/scan/page.tsx
  - app/app/rewards/scan/[scanToken]/page.tsx
  - app/app/rewards/scan/[scanToken]/actions.ts
  - lib/merchant/reward-collection.ts
  - supabase/migrations/20260630123000_cleanup_reward_scan_tokens.sql
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/redeem.md
related_tests:
  - tests/db/reward-scan-single-use.test.mjs
  - tests/db/architecture-moat.test.mjs
  - tests/e2e/merchant-reward-scan.spec.ts
  - tests/micro-specs/reward-collection-route-contract.test.mjs
  - app/dev/app-harness/reward-scan/page.tsx
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-chromium
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-merchant-scan-pos — Merchant reward collection via single-use scan token

## Intent

A merchant scans the customer's reward QR. The token resolves at
`/app/rewards/scan/[scanToken]`, showing the masked member, the reward name, and
the current state. Confirming collection **consumes the single-use token once**
and marks the reward redeemed; a token that is already used, expired, or belongs
to another merchant is shown a clear non-collectable state and cannot be
collected. This is the merchant counterpart to [MS-customer-redeem].

## Reconciliation note

The plan inferred a **staff-PIN** POS (`issue_stamp_with_staff_pin`,
`redeem_reward_with_staff_pin`). Those RPCs are **legacy**: the shared-PIN
surfaces were removed by `20260613130000_remove_shared_pin_surfaces.sql`, the
functions are not deployed, and nothing in `app/`/`lib/` calls them. The live
merchant collection flow is **scan-token based** (`get_reward_scan_context` +
`collect_reward_scan_token`). This spec documents the as-built token flow.

## Scope (in)

- The scan entry page `/app/scan` and the token resolution page
  `/app/rewards/scan/[scanToken]` (param `scanToken`, uuid).
- `loadMerchantRewardScanContext` → `get_reward_scan_context(p_scan_token,
  p_merchant_id)` and `confirmMerchantRewardCollectionAction` →
  `collect_reward_scan_token`.
- The non-collectable states: `ready`, `redeemed`, `blocked`, `expired`,
  `unauthorized`, `not_found`.

## Scope (out)

- Minting the token / the customer reward page (owned by [MS-customer-redeem]).
- The deleted `[rewardId]` route variant (confirmed removed —
  `reward-collection-route-contract.test.mjs` guards this).
- Camera/QR-decode internals, staff management, dashboards. No schema/RLS change.

## Decisions already made

- The route param is `scanToken` (uuid), validated by regex; the old
  `[rewardId]` page is deleted.
- `collect_reward_scan_token` sets `consumed_at` + `consumed_by_merchant_id`
  exactly once; a second confirm on the same token resolves to a non-collectable
  state. Cross-merchant tokens resolve `unauthorized`; past-`expires_at` resolve
  `expired`.
- The member label shown to staff is masked (email/phone) — no raw customer PII.

## EARS requirements

- **MS-1 (resolve ready):** WHEN a merchant opens `/app/rewards/scan/[scanToken]`
  for a live, unconsumed token belonging to their merchant, THE system SHALL
  show a collectable `ready` state with the reward name and a masked member
  label.
- **MS-2 (collect once):** WHEN the merchant confirms collection of a `ready`
  token, THE system SHALL consume the token (`consumed_at` set) and mark the
  reward redeemed.
- **MS-3 (single-use):** IF a token has already been consumed, THEN THE system
  SHALL present a non-collectable state and SHALL NOT consume or redeem again.
- **MS-4 (expired):** IF a token's `expires_at` has passed, THEN THE system SHALL
  present an `expired` state and SHALL NOT allow collection.
- **MS-5 (tenant isolation):** IF a token belongs to a different merchant than
  the signed-in one, THEN THE system SHALL present `unauthorized` and SHALL NOT
  reveal the member or reward, nor allow collection.
- **MS-6 (not found):** IF the scan token does not exist, THEN THE system SHALL
  present `not_found`.
- **MS-7 (PII minimisation):** THE collection surface SHALL only ever show a
  masked member label, never raw phone/email.

## Verification method

Live-Supabase tier: mint a token (via [MS-customer-redeem] path), assert
`get_reward_scan_context` returns `ready`; `collect_reward_scan_token` once →
assert `consumed_at` set + reward `redeemed`; collect again → assert
non-collectable and no second consumption (MS-3); a token past `expires_at` →
`expired` (MS-4); a token from another merchant → `unauthorized` (MS-5).
DB-free harness tier: `/dev/app-harness/reward-scan` renders the ready / expired /
collected states.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:e2e` ·
`pnpm test:db`.

## Verification log — 2026-06-30

Live-DB tier green via `pnpm test:db`:
`tests/db/reward-scan-single-use.test.mjs` drives `collect_reward_scan_token` and
proves **MS-2** (first collect consumes the token and marks the reward
`redeemed`) and **MS-3** (a second collect does not re-consume).
`tests/db/architecture-moat.test.mjs` proves the concurrent double-scan resolves
to a single collection. The route contract (`scanToken`, not the deleted
`rewardId`) is guarded by `tests/micro-specs/reward-collection-route-contract.
test.mjs`. DB-free UI states render in `tests/e2e/merchant-reward-scan.spec.ts`
against `/dev/app-harness/reward-scan`. Reconciliation confirmed: the staff-PIN
RPCs are legacy (removed by `20260613130000_remove_shared_pin_surfaces.sql`,
called nowhere). Verdict: **READY** for MS-2/MS-3; MS-4/MS-5/MS-6 authored.
