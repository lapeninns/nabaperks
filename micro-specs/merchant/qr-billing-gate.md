---
spec_id: MS-merchant-qr-billing-gate
status: active
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/merchant/**
  - micro-specs/evidence/MS-merchant-qr-billing-gate.json
  - lib/merchant/launch-readiness-core.ts
  - lib/merchant/launch-readiness.ts
  - lib/merchant/ensure-join-qr.ts
  - lib/merchant/billing-checkout-return.ts
  - lib/customer/availability.ts
  - app/app/qr/actions.ts
  - supabase/migrations/20260713150000_pause_loyalty_when_billing_lapses.sql
  - components/merchant/account/billing-panel.tsx
  - components/merchant/account/billing-panel-view.tsx
  - components/merchant/launch/qr-panel.tsx
  - components/merchant/launch/qr-panel-live.tsx
  - app/dev/app-harness/launch/page.tsx
  - app/dev/app-harness/qr/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - tests/unit/launch-readiness-core.test.mjs
  - tests/unit/billing-checkout-return.test.mjs
  - tests/unit/customer-loyalty-availability.test.mjs
  - tests/db/**
  - tests/micro-specs/fresh-db-seed-parity.test.mjs
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.desktop.spec.ts
  - tests/e2e/merchant-launch-setup.spec.ts
  - tests/e2e/merchant-launch-header.desktop.spec.ts
  - tests/e2e/public-qr-router-live-db.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/**
  - tests/e2e/merchant-billing-recovery.visual.spec.ts-snapshots/**
  - tests/e2e/merchant-billing-recovery.visual.desktop.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/merchant/qr-billing-gate.md
  - micro-specs/evidence/MS-merchant-qr-billing-gate.json
  - lib/merchant/launch-readiness-core.ts
  - lib/merchant/launch-readiness.ts
  - lib/merchant/ensure-join-qr.ts
  - lib/merchant/billing-checkout-return.ts
  - lib/customer/availability.ts
  - app/app/qr/actions.ts
  - supabase/migrations/20260713150000_pause_loyalty_when_billing_lapses.sql
  - components/merchant/account/billing-panel.tsx
  - components/merchant/account/billing-panel-view.tsx
  - components/merchant/launch/qr-panel.tsx
  - components/merchant/launch/qr-panel-live.tsx
  - app/dev/app-harness/launch/page.tsx
  - app/dev/app-harness/qr/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - tests/unit/launch-readiness-core.test.mjs
  - tests/unit/billing-checkout-return.test.mjs
  - tests/unit/customer-loyalty-availability.test.mjs
  - tests/db/**
  - tests/micro-specs/fresh-db-seed-parity.test.mjs
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.desktop.spec.ts
  - tests/e2e/merchant-launch-setup.spec.ts
  - tests/e2e/merchant-launch-header.desktop.spec.ts
  - tests/e2e/public-qr-router-live-db.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/**
  - tests/e2e/merchant-billing-recovery.visual.spec.ts-snapshots/**
  - tests/e2e/merchant-billing-recovery.visual.desktop.spec.ts-snapshots/**
related_tests:
  - tests/unit/launch-readiness-core.test.mjs
  - tests/unit/billing-checkout-return.test.mjs
  - tests/unit/customer-loyalty-availability.test.mjs
  - tests/db/architecture-moat.test.mjs
  - tests/micro-specs/fresh-db-seed-parity.test.mjs
  - tests/micro-specs/launch-qr-readiness.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-ux-audit-closure.test.mjs
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.desktop.spec.ts
  - tests/e2e/merchant-launch-setup.spec.ts
  - tests/e2e/merchant-launch-header.desktop.spec.ts
  - tests/e2e/public-qr-router-live-db.spec.ts
  - tests/e2e/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-(merchant-ux-launch-follow-through|billing-checkout-recovery)"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:design-review
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Unit and source-contract proof that QR provision and enable fail closed before active or trialing billing and disable remains available after billing lapses.
  - Mobile and desktop browser proof for locked never-launched, paused lapsed, confirmed-billing reveal, and live till-guidance states.
  - Database gate output proving past-due joins and earned stamps fail closed without deleting the venue QR.
  - Axe and approved Wet Ink visual-baseline output for changed billing and QR surfaces.
approved_exceptions: []
---

# MS-merchant-qr-billing-gate — Billing-gated venue QR provision, recovery, and till guidance

## 1. Exact Goal and User-Visible Outcomes

A venue QR cannot be provisioned or enabled until billing is `active` or
`trialing`. Confirmed checkout and portal returns provision it automatically,
the billing panel offers a race-free route to the QR, and the QR tab clearly
distinguishes a never-launched locked venue from a previously launched venue
whose scans are paused by lapsed billing. A live merchant also receives clear
till placement and staff first-stamp guidance.

## 2. Blast Radius

In scope: QR provision eligibility, fresh billing loading for automatic
provision, merchant QR action guards, confirmed checkout/portal return
provisioning, billing outcome CTA, locked/lapsed/live QR presentation, till and
staff guidance, customer join availability, a database-wide earned-stamp
billing guard, launch/dashboard/QR harness state fixtures, focused unit/source/
DB/browser contracts, visual baselines, this spec, and its evidence ledger.

Out of scope: Stripe webhook-triggered provisioning, lazy QR provision on a
plain launch GET, billing navigation redirects, a first-stamp checklist or
analytics gate, POS integrations, and production data writes.

## 3. Strict Constraints and Assumptions

- Reuse `LAUNCH_READY_BILLING_STATUSES` and `isLaunchBillingReady`; do not fork
  billing status semantics.
- Server state is authoritative. Browser storage is not entitlement evidence.
- QR provision and enable fail closed unless billing is active/trialing.
- Disable remains available when billing lapses so a physical poster can be
  retired; share, print, and poster email remain visible for an existing QR.
- Checkout return remains on `tab=billing` because `catching_up` outcomes render
  there. `billing-nav.ts` remains untouched.
- Plain launch GET remains read-only except the existing explicit checkout/
  portal return write carve-out; there is no new lazy GET provisioning.
- Customer join availability and the earned-stamp ledger both use the same
  active/trialing allowlist, so a retained QR cannot accept scans after billing
  lapses even if a caller bypasses the public resolver.
- Production was empty on 2026-07-11; no legacy-row migration is required.
- Wet Ink tokens/primitives, British voice, semantic headings, 44px actions,
  reduced motion, WCAG AA, and no-horizontal-overflow contracts remain intact.

## 4. Decisions Already Made

- `EnsureJoinQrInput` gains `billingReady`, and provision eligibility requires
  setup completion plus launch-ready billing.
- `autoProvisionJoinQrFromSetup` loads the same fresh billing source as the
  launch page because `getQrSetupFresh` alone does not include billing.
- Generate QR and enable QR actions fail closed with a billing activation error;
  the disable path is intentionally ungated.
- On `confirmed`, checkout and portal return completion fresh-load setup and
  billing. Active/trialing returns provision the venue QR before launch
  surfaces are revalidated; non-ready returns refresh state without
  provisioning.
- Confirmed active/trialing billing exposes one primary `See your venue QR ->`
  action. Non-ready returns do not expose it, and there is no automatic redirect
  to the QR tab.
- When billing is not ready and no QR exists, the QR tab renders a locked panel
  without a QR image and links to `/app/launch?tab=billing`.
- When billing is not ready and a QR exists, the live panel remains visible with
  `scans paused`, a fix-billing action replacing Enable, and print/share/disable
  controls preserved.
- Public QR resolution, customer join, and earned stamp insertion all fail
  closed for every non-active/non-trialing billing status.
- The user approved this entitlement expansion on 2026-07-11. This spec
  supersedes the earlier denylist wording in `MS-billing`: customer loyalty
  availability and earned stamps now require the explicit `active`/`trialing`
  allowlist.
- Till guidance is presentation only: place the poster at the till/bar, ask
  staff to direct customers to that QR, state that the customer's phone joins
  and stamps, and keep the self-scan-before-first-customer reminder. `/app/scan`
  is reward redemption and is not taught as the first-stamp path.
- Webhook-only activation without a merchant return is an accepted gap; on the
  next visit the QR step exposes a manual create action that now succeeds.

## 5. Behavioral Requirements (EARS)

- **QG-1:** IF billing is not `active` or `trialing`, THEN automatic QR
  provisioning eligibility SHALL be false even when venue, card, and rewards
  setup are complete.
- **QG-2:** WHEN card or reward setup invokes automatic QR provisioning, THE
  provisioner SHALL load fresh billing and SHALL no-op before billing readiness.
- **QG-3:** IF a merchant submits QR generation or QR enable while billing is
  not ready, THEN THE action SHALL fail closed with a billing activation error
  before invoking the mutation RPC.
- **QG-4:** WHEN a merchant disables an existing QR after billing lapses, THE
  disable action SHALL remain allowed.
- **QG-5:** WHEN checkout or portal return resolves `confirmed` with active or
  trialing billing, THE return workflow SHALL automatically provision the venue
  QR before revalidation and SHALL expose a `See your venue QR ->`
  billing-panel action; otherwise it SHALL do neither.
- **QG-6:** WHILE a checkout or portal return is `catching_up`, THE billing tab
  SHALL retain the outcome without redirecting or claiming the QR is ready.
- **QG-7:** IF billing is not ready and no QR exists, THEN the QR tab SHALL show
  a locked billing-required panel, SHALL show no QR image, and SHALL link to the
  billing tab.
- **QG-8:** IF billing is not ready and a QR exists, THEN the QR tab SHALL keep
  the QR, share/print/email, and disable controls visible; SHALL label scans
  paused; and SHALL replace Enable with a fix-billing action.
- **QG-9:** WHEN billing is ready and the QR exists, THE live QR panel SHALL
  preserve current enable/disable/share/print behavior and scan availability.
- **QG-10:** WHILE scans are available, THE QR panel SHALL explain till/bar
  poster placement, staff direction to the customer-facing QR, customer-phone
  join/stamp behavior, and a self-scan before the first customer.
- **QG-11:** THE launch harness SHALL provide setup-incomplete, billing-locked,
  lapsed-existing-QR, and live states, and related dashboard/QR harnesses SHALL
  pass truthful `scansAvailable` inputs.
- **QG-12:** THE changed billing and QR surfaces SHALL remain accessible,
  responsive, and visually consistent with Wet Ink at mobile and desktop widths.
- **QG-13:** IF billing is not `active` or `trialing`, THEN public QR resolution,
  membership join, and earned-stamp persistence SHALL fail closed while the
  merchant's QR row remains intact.

## 6. Verification Criteria and Task Breakdown

1. Red eligibility/action/return source contracts and unit tests prove current
   pre-billing provision, enable, and confirmed-return behavior is unsafe.
2. Green the billing-aware provision eligibility and action guards, proving
   pre-billing calls no-op or fail closed while lapsed disable stays allowed.
3. Green confirmed checkout/portal provisioning and the billing success CTA
   without altering the billing-tab return contract.
4. Red then green the locked, lapsed, and live QR-panel states plus the four
   launch harness fixtures and truthful dashboard/QR harness props.
5. Add the till and staff first-stamp guidance only for scan-available state.
6. Prove `past_due` is unavailable through the public QR router and rejected by
   the real stamp RPC without a ledger write.
7. Tag and run the focused Chromium/Mobile Safari story, axe, overflow, DB
   entitlement, and Wet Ink visual evidence; update only legitimately changed
   baselines, with Darwin captures and CI-derived Linux twins.
8. Record all declared gates with
   `governance:run-gates --spec MS-merchant-qr-billing-gate --record`, then
   advance the lifecycle with `governance:advance`.
