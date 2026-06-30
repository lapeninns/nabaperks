---
spec_id: MS-merchant-launch
status: implemented
risk_class: product-analytics
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/app/launch/**
  - lib/merchant/launch-readiness*.ts
  - lib/merchant/launch-page-model.ts
  - lib/merchant/launch-search-params.ts
  - lib/merchant/launch-readiness-contract.ts
  - lib/merchant/launch-readiness-core.ts
  - micro-specs/merchant/**
implementation_surfaces:
  - app/app/launch/page.tsx
  - lib/merchant/launch-readiness.ts
  - lib/merchant/launch-readiness-contract.ts
  - lib/merchant/launch-readiness-core.ts
  - lib/merchant/launch-page-model.ts
  - lib/merchant/launch-search-params.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/qr-poster.md
  - micro-specs/billing.md
related_tests:
  - tests/unit/launch-readiness-core.test.mjs
  - tests/unit/launch-search-params.test.mjs
  - tests/micro-specs/launch-qr-readiness.test.mjs
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

# MS-merchant-launch — Launch-readiness gates: rewards ≥3, active QR, billing

## Intent

`/app/launch` walks a merchant through go-live. A deterministic readiness model
decides which setup steps are complete, what the single next step is, and
whether the merchant can launch. Go-live is gated on a reward pool of at least
`LAUNCH_MIN_ACTIVE_REWARDS` active rewards, an active join QR, and (when billing
is required) an active/trial billing status — with billing **failing closed** on
any null or unknown status. The readiness logic is pure and unit-tested; this
spec pins its observable contract.

## Scope (in)

- The launch-readiness contract/core/page-model (`lib/merchant/launch-readiness*`,
  `launch-page-model`, `launch-search-params`) and `/app/launch/page.tsx`.
- The step model: venue → card → rewards → qr → billing, the "first incomplete
  step", the active-tab resolution, and the rewards/qr continue hrefs.
- Join-QR provisioning eligibility (`isJoinQrProvisionEligible`).

## Scope (out)

- The reward-pool editor + the ≥3 enforcement at write time (owned by
  [MS-merchant-card-rewards]); the QR activation action (owned by
  [MS-merchant-qr-poster]); Stripe checkout/webhooks (owned by [MS-billing]).
  This spec consumes those states, it does not mutate them.

## Decisions already made

- The reward gate keys off `LAUNCH_MIN_ACTIVE_REWARDS` exactly (default 3).
- Venue readiness requires an address; coordinates are required only when the
  venue is geofenced.
- The billing checklist item appears only when billing is provided; the billing
  gate **fails closed** on null/unknown status and opens only on `active`/`trial`.
- QR readiness requires an active QR; once active, the QR step href flips to the
  poster path. Join-QR provisioning is eligible only when every other gate is
  met AND the QR is not already active.
- Active-tab resolution prefers a valid explicit request, else the next
  incomplete step, else `qr`.

## EARS requirements

- **L-1 (empty):** WHEN nothing is set up, THE readiness model SHALL report no
  steps complete and the first incomplete step SHALL be `venue`.
- **L-2 (reward gate):** THE system SHALL treat the reward pool as launch-ready
  only when it holds at least `LAUNCH_MIN_ACTIVE_REWARDS` active rewards.
- **L-3 (venue gate):** THE system SHALL require a venue address, and SHALL
  require coordinates only when the venue is geofenced.
- **L-4 (qr gate):** THE system SHALL treat QR setup as ready only when a join QR
  is active, and SHALL point the QR step at the poster path once it is.
- **L-5 (billing fail-closed):** IF billing is required and its status is null or
  unknown, THEN THE system SHALL treat billing as not ready; it SHALL open only
  on `active` or `trial`.
- **L-6 (single next step):** THE system SHALL surface exactly one next step at a
  time, advancing venue → card → rewards → qr → billing as each is satisfied.
- **L-7 (fully ready):** WHEN every required gate is satisfied, THE system SHALL
  report no next step and allow launch.
- **L-8 (QR-only gap):** WHERE the QR is the only remaining gap,
  `isLaunchSetupCompleteWithoutQr` SHALL be true and join-QR provisioning SHALL
  be eligible.

## Verification method

Pure-TS unit tier proves the readiness contract: `tests/unit/launch-readiness-
core.test.mjs` and `launch-search-params.test.mjs` cover L-1…L-8 (run on
`node --test` via the alias loader). DB-free harness `/dev/app-harness/launch`
proves the launch UI renders. The QR-active integration is also guarded by
`tests/micro-specs/launch-qr-readiness.test.mjs`.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.

## Verification log — 2026-06-30

Authored from the as-built readiness model and its existing unit suite
(`pnpm test:unit` green: "reward gating keys off LAUNCH_MIN_ACTIVE_REWARDS
exactly", "venue readiness: address required, coords only when geofenced", "qr
readiness requires an active QR", "qr step href flips to the poster path once
active", "billing gate fails closed on null/unknown status, opens on
active/trial", "fully ready (billing active) launches with no next step",
"isLaunchSetupCompleteWithoutQr: true only when the QR is the lone gap",
"isJoinQrProvisionEligible: all gates required, QR not already active",
"resolveLaunchActiveTab: valid request wins, else next step, else qr"). These
map directly onto L-1…L-8. Verdict: **READY** — the readiness contract is fully
unit-covered; `/app/launch` UI proven DB-free.