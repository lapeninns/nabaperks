---
spec_id: MS-merchant-ux-audit-closure
status: implemented
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/merchant/ux-audit-closure.md
  - micro-specs/evidence/MS-merchant-ux-audit-closure.json
  - lib/marketing/facts.ts
  - components/merchant/account/billing-activation-card.tsx
  - components/merchant/account/billing-checkout-form.tsx
  - components/merchant/account/billing-panel-view.tsx
  - components/merchant/launch/billing-activation-asset-preview.tsx
  - components/merchant/onboarding-journey-orientation.tsx
  - app/app/launch/page.tsx
  - app/dev/app-harness/launch/page.tsx
  - app/app/onboarding/page.tsx
  - app/dev/app-harness/onboarding/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-onboarding-continuity-flow.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/merchant/ux-audit-closure.md
  - micro-specs/evidence/MS-merchant-ux-audit-closure.json
  - lib/marketing/facts.ts
  - components/merchant/account/billing-activation-card.tsx
  - components/merchant/account/billing-checkout-form.tsx
  - components/merchant/account/billing-panel-view.tsx
  - components/merchant/launch/billing-activation-asset-preview.tsx
  - components/merchant/onboarding-journey-orientation.tsx
  - app/app/launch/page.tsx
  - app/dev/app-harness/launch/page.tsx
  - app/app/onboarding/page.tsx
  - app/dev/app-harness/onboarding/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-onboarding-continuity-flow.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
related_tests:
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-onboarding-continuity-flow.ts
  - tests/e2e/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-merchant-ux-audit-closure"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:design-review
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Mobile and desktop browser proof that the Growth Plan, exact risk reversal, and built card and QR continuity preview are visible at billing without horizontal overflow.
  - Mobile proof that the condensed onboarding orientation precedes the first form control while the detailed roadmap remains available after the form.
  - Browser proof that a zero-member dashboard replaces KPI zeros with encouragement and preserves the real counter QR action.
  - Axe and approved visual-baseline output for the changed billing, onboarding, and zero-member dashboard surfaces.
approved_exceptions: []
---

# MS-merchant-ux-audit-closure — Close residual merchant UX audit findings

## 1. Exact Goal and User-Visible Outcomes

A merchant reaches billing with the card and QR they just built still visible,
the plan consistently named Growth Plan, and the exact £0-today, cancel-anytime,
and First-Regular Guarantee reassurance at the decision point. On mobile, the
onboarding form explains the next four guided steps before the first field. A
brand-new dashboard replaces a wall of zeros with an encouraging QR-led next
action, with direct browser evidence for all three moments.

## 2. Blast Radius

In scope: the shared Growth Plan fact; first-run activation receipt; a compact
server-rendered billing asset preview composed from the launch model; shared
onboarding orientation copy; the existing zero-member dashboard harness branch;
focused source/browser/a11y/visual contracts; this spec and ledger.

Out of scope: billing eligibility or Stripe behavior, database reads or schema,
QR generation, onboarding persistence, dashboard metrics, marketing offer
renaming, account billing layout beyond shared plan-name literals, new analytics
events, support-system integrations, experiment assignment, and production or
linked Supabase writes.

## 3. Strict Constraints and Assumptions

- Server state stays authoritative. The billing preview consumes the existing
  `QrSetup` already loaded for `/app/launch`; it adds no request, mutation,
  browser storage, or client-component boundary.
- The real protected `/app/qr/image/[qrCodeId]` route supplies the thumbnail;
  no public QR URL or tenant identifier is introduced.
- The preview is truthful before activation: `Built · billing needed`, and no
  customer-scan availability claim until billing is active.
- `Growth Plan` names the product plan. `The 30-Day First-Regular Launch`
  remains the separate public offer name.
- The billing preview has no competing mutation or navigation CTA; the existing
  Stripe checkout remains the one primary action.
- The mobile summary is visible below the onboarding page introduction and
  before the first form control. The full roadmap remains after the form in
  mobile DOM order and in the right rail on desktop.
- Wet Ink primitives, current tokens, semantic headings, 44px actions, reduced
  motion, WCAG AA, and no-horizontal-overflow contracts remain intact.
- The existing dashboard zero-member implementation is treated as production
  code already complete; this slice adds proof, not a second empty state.

## 4. Decisions Already Made

- Add `PRODUCT.planName = "Growth Plan"`; activation and account billing consume
  it instead of forking the plan name. The public offer constant is unchanged.
- The activation receipt gains `Plan / Growth Plan` and its browser proof pins
  the full guarantee and Stripe cancellation sentence, not partial keywords.
  Its monthly and annual checkout actions stay stacked so neither plan label
  depends on platform-font width to remain readable.
- Carry the built asset into billing as a compact receipt using the real venue,
  a static card cadence, and protected QR thumbnail. It is server-rendered,
  introduces no transitive client motion boundary, and stays responsive, with
  the checkout card immediately adjacent on desktop and directly following on
  mobile.
- Shared onboarding components own both the condensed mobile sentence and the
  detailed roadmap so production and the DB-free harness cannot drift.
- Add visual baselines for the billing asset, mobile onboarding orientation,
  and zero-member dashboard. Existing audit baselines are not repinned unless
  the changed surface legitimately appears in them.
- The zero-member dashboard harness supplies an empty activity feed and omits
  populated follow-up fixtures, so its first-join reassurance cannot contradict
  the evidence rendered directly below it.
- Measurement-plan gaps are explicitly deferred to a separate privacy-reviewed
  analytics spec; this UI closure does not collect field values, abandonment,
  support tickets, or experiment assignments.

## 5. Behavioral Requirements (EARS)

- **UA-1:** WHERE first-run billing is offered, THE activation receipt SHALL
  name the Growth Plan and show 30 days, £0 due today, £49 a month, per-location
  billing, the exact cancel-anytime sentence, and the shared First-Regular
  Guarantee promise.
- **UA-2:** WHEN a merchant reaches the launch billing tab with an active card
  and join QR, THE page SHALL show a compact preview of that card cadence and
  protected QR with `Built · billing needed` before the existing checkout card.
- **UA-3:** IF the billing preview lacks an active card, QR, or venue, THEN it
  SHALL render nothing rather than inventing fixture data or a public asset.
- **UA-4:** WHERE onboarding renders below the desktop breakpoint, THE condensed
  next-steps sentence SHALL precede the first form control and name card,
  rewards, QR, and billing as guided steps.
- **UA-5:** WHEN onboarding renders at any breakpoint, THE detailed five-step
  roadmap SHALL remain available after the form in mobile DOM order and as the
  desktop right rail.
- **UA-6:** IF dashboard members equal zero, THEN the merchant harness SHALL
  prove the encouraging no-members state replaces the KPI/trend section while
  the real `Show full screen` counter-QR action remains visible, populated
  next-action fixtures are absent, and recent activity uses its empty state.
- **UA-7:** THE changed surfaces SHALL have no axe violations or horizontal
  overflow at 375×812 and 1280×800 and SHALL match approved Wet Ink baselines.
- **UA-8:** THE implementation SHALL add no data fetch, mutation, client bundle,
  analytics payload, provider call, or database change.

## 6. Verification Criteria and Task Breakdown

1. Red source contracts: no shared plan name, no shared onboarding orientation,
   and no server-rendered billing asset continuity component.
2. Red browser contracts: exact reassurance/plan text absent, onboarding mobile
   orientation absent above the form, billing asset preview absent, and the
   zero-member harness branch lacks direct assertions.
3. Green the shared facts and presentational components without changing server
   loaders, actions, schemas, or existing primary CTAs.
4. Run the tagged mobile/desktop browser set, focused axe checks, overflow checks,
   and update only the three new approved visual baselines.
5. Commit the implementation, then use one clean lifecycle advance for the full
   declared gate boundary; do not duplicate it with an identical pre-run.
