---
spec_id: MS-merchant-launch-order-copy
status: active
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/merchant/**
  - micro-specs/evidence/MS-merchant-launch-order-copy.json
  - lib/merchant/launch-readiness-core.ts
  - lib/merchant/launch-readiness-contract.ts
  - lib/merchant/launch-header-copy.ts
  - lib/marketing/facts.ts
  - app/(auth)/signup/page.tsx
  - components/marketing/landing/final-cta.tsx
  - app/demo/page.tsx
  - components/merchant/onboarding-journey-orientation.tsx
  - tests/unit/launch-readiness-core.test.mjs
  - tests/unit/launch-header-copy.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-launch-setup.spec.ts
  - tests/e2e/merchant-launch-header.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/merchant/launch-order-copy.md
  - micro-specs/evidence/MS-merchant-launch-order-copy.json
  - lib/merchant/launch-readiness-core.ts
  - lib/merchant/launch-readiness-contract.ts
  - lib/merchant/launch-header-copy.ts
  - lib/marketing/facts.ts
  - app/(auth)/signup/page.tsx
  - components/marketing/landing/final-cta.tsx
  - app/demo/page.tsx
  - components/merchant/onboarding-journey-orientation.tsx
  - tests/unit/launch-readiness-core.test.mjs
  - tests/unit/launch-header-copy.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-launch-setup.spec.ts
  - tests/e2e/merchant-launch-header.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
related_tests:
  - tests/unit/launch-readiness-core.test.mjs
  - tests/unit/launch-header-copy.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-launch-setup.spec.ts
  - tests/e2e/merchant-launch-header.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-merchant-ux-launch-follow-through"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:design-review
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Mobile and desktop browser proof that launch navigation and continue actions follow venue, card, rewards, billing, then venue QR.
  - Browser proof that signup, demo, onboarding, launch header, and final conversion copy consistently place billing before QR.
  - Axe and approved Wet Ink visual-baseline output for changed launch surfaces.
approved_exceptions: []
---

# MS-merchant-launch-order-copy — Launch order and copy: billing before venue QR

## 1. Exact Goal and User-Visible Outcomes

A merchant configures venue, card, and rewards, activates billing, and only then
reaches the venue QR step. Every launch, onboarding, signup, demo, and marketing
message tells that same sequence without implying that a poster is available
before payment activation.

## 2. Blast Radius

In scope: the shared checklist and launch-tab order, rewards continuation,
merchant setup-step descriptions, launch-header state copy, shared marketing
facts, signup/demo/final-CTA/onboarding orientation copy, focused source/unit
and browser contracts, visual baselines, this spec, and its evidence ledger.

Out of scope: QR provisioning or enablement, Stripe return behavior, billing
navigation, database/schema/RPC changes, customer stamping, a new checklist
step, analytics, and production data changes. Those QR entitlement and landing
behaviors belong to `MS-merchant-qr-billing-gate`.

## 3. Strict Constraints and Assumptions

- Server-derived launch readiness remains authoritative; this slice changes
  ordering and truthful presentation only.
- `isVenueOperational` and `isLaunchSetupCompleteWithoutQr` remain
  order-independent and unchanged.
- The checklist is null-safe when billing data is absent: setup steps are
  followed directly by QR only for a model that has no billing checklist row.
- Checkout return stays on `tab=billing`; `billing-nav.ts` is unchanged.
- Wet Ink tokens, primitives, British voice, semantic headings, 44px actions,
  reduced motion, and no-horizontal-overflow contracts remain intact.
- Existing visual baselines are updated only where this sequence legitimately
  changes rendered content.

## 4. Decisions Already Made

- Canonical order is `venue -> card -> rewards -> billing -> qr` in both the
  checklist and `LAUNCH_HUB_TABS`.
- `resolveRewardsContinueHref` sends a rewards-complete merchant to billing
  before QR; QR is next only after billing is launch-ready.
- Billing setup copy says the free trial unlocks the venue QR. QR setup copy
  says it becomes available once billing is active.
- The launch header shows a billing CTA when venue/card/rewards are complete
  but billing is not ready; it shows a QR CTA only when billing is ready and QR
  remains incomplete.
- The value-before-payment promise ends after venue, card, and rewards. The
  poster/QR moment moves after confirmed billing.
- `SETUP.line` remains unchanged because it is still truthful.

## 5. Behavioral Requirements (EARS)

- **LO-1:** THE launch checklist SHALL order venue, card, rewards, billing,
  and venue QR, while preserving a null-safe setup-then-QR order when no billing
  checklist item exists.
- **LO-2:** THE launch hub tabs and merchant setup-step contract SHALL expose
  venue, card, rewards, billing, and QR in that order with billing-unlocks-QR
  descriptions.
- **LO-3:** WHEN rewards are complete and billing is not launch-ready, THE
  rewards continue action SHALL route to billing even if a QR does not exist.
- **LO-4:** WHEN rewards and billing are complete but QR remains incomplete,
  THE rewards continue action and launch header SHALL route to venue QR.
- **LO-5:** WHILE venue/card/rewards are complete and billing is pending, THE
  launch header SHALL present billing as the remaining launch action rather
  than claiming the merchant is one QR step from live.
- **LO-6:** WHERE public signup, demo, final conversion, setup facts, and
  merchant onboarding orientation describe launch, THE copy SHALL place
  billing before venue QR and SHALL NOT promise QR availability pre-billing.
- **LO-7:** THE changed launch surfaces SHALL remain accessible, responsive,
  and visually consistent with the Wet Ink design system at mobile and desktop
  widths.

## 6. Verification Criteria and Task Breakdown

1. Red unit/source contracts prove the current QR-before-billing checklist,
   continuation, header fixtures, and copy are obsolete.
2. Green the shared order and continuation model, then prove next-step totals
   and header actions for billing-pending and QR-pending merchants.
3. Green the setup facts and all named public/merchant copy surfaces without
   changing billing or QR mutation behavior.
4. Tag and run the focused browser story on Chromium and Mobile Safari; verify
   the sequence, copy, axe result, no horizontal overflow, and Wet Ink visuals.
5. Record all declared gates with
   `governance:run-gates --spec MS-merchant-launch-order-copy --record`, then
   advance the lifecycle with `governance:advance`.
