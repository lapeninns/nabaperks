---
spec_id: MS-analytics-merchant-billing-telemetry-seam-proof
status: implemented
risk_class: billing
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/analytics/merchant-billing-telemetry-seam-proof.md
  - micro-specs/evidence/MS-analytics-merchant-billing-telemetry-seam-proof.json
  - lib/analytics/merchant-billing-events-core.ts
  - lib/analytics/merchant-billing-events.ts
  - app/app/launch/page.tsx
  - app/app/billing/actions.ts
  - tests/unit/billing-stripe-orchestration.test.mjs
  - tests/micro-specs/merchant-billing-telemetry.test.mjs
implementation_surfaces:
  - micro-specs/analytics/merchant-billing-telemetry-seam-proof.md
  - micro-specs/evidence/MS-analytics-merchant-billing-telemetry-seam-proof.json
  - lib/analytics/merchant-billing-events-core.ts
  - lib/analytics/merchant-billing-events.ts
  - app/app/launch/page.tsx
  - app/app/billing/actions.ts
  - tests/unit/billing-stripe-orchestration.test.mjs
  - tests/micro-specs/merchant-billing-telemetry.test.mjs
related_tests:
  - tests/unit/billing-stripe-orchestration.test.mjs
  - tests/micro-specs/merchant-billing-telemetry.test.mjs
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-analytics-merchant-billing-telemetry"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Executable unit proof that only the exact launch gate and a usable Checkout redirect schedule their milestones.
  - Executable unit proof that negative outcomes and throwing analytics preserve the original render or Checkout result.
  - Source proof that production launch and Checkout action paths call the tested seams rather than reimplementing their decisions.
  - Existing mobile and desktop billing non-regression proof remains green.
approved_exceptions: []
---

# MS-analytics-merchant-billing-telemetry-seam-proof — Execute merchant billing telemetry seams

## 1. Exact Goal and User-Visible Outcomes

Billing analytics remains invisible to merchants: the launch page renders and a
validated Stripe Checkout redirect is preserved even when analytics throws.
Executable tests, not source regex alone, prove the positive and negative
decision branches that select the reached and checkout-started milestones.

## 2. Blast Radius

In scope: two pure, dependency-injected observation seams; the server adapter;
their existing production call sites; focused executable and source contracts;
this spec and its evidence ledger.

Out of scope: event names or payloads, database schema/RPCs, Stripe parameters,
attempt fencing, return verification, billing persistence, redirects, UI/copy,
browser storage, provider configuration, and new dependencies.

## 3. Strict Constraints and Assumptions

- The existing fixed milestone payloads and activation scheduler remain the
  only analytics contract; this slice adds no event or metadata.
- The launch observer receives the already-authoritative `activeTab` and
  `needsBilling` values. It never derives billing state independently.
- The Checkout observer wraps the actual preparation promise after merchant
  authentication and interval validation. It schedules only a returned
  `status: "redirect"` result.
- Both observers return or preserve the original product outcome. Scheduler
  exceptions are swallowed by the existing fail-open milestone adapter.
- Preparation failures and `status: "error"` results create no milestone.
- No telemetry work is awaited after a valid redirect becomes available; the
  existing activation scheduler owns after-response behavior.

## 4. Decisions Already Made

- Put branch decisions in the pure core with an injected scheduler so tests
  execute the same functions production calls.
- The launch page calls one unconditional observation seam with both resolved
  facts instead of re-spelling the conditional in JSX route code.
- The Checkout action passes a thunk for the existing
  `prepareBillingCheckout` call. The observer returns its exact result object,
  so error and redirect handling remain unchanged.
- Keep source checks only for call-site placement and early auth/interval
  guards; unit tests own positive, negative, and throwing behavior.

## 5. Behavioral Requirements (EARS)

- **BTS-1:** WHEN the resolved launch tab is billing and billing is required,
  THE launch seam SHALL schedule exactly one reached milestone.
- **BTS-2:** IF either launch fact is false, THEN THE launch seam SHALL schedule
  nothing.
- **BTS-3:** WHEN Checkout preparation returns a usable redirect, THE Checkout
  seam SHALL schedule exactly one checkout-started milestone and return the
  same redirect result.
- **BTS-4:** IF Checkout preparation returns an error or throws before a result,
  THEN THE Checkout seam SHALL schedule nothing and preserve that outcome.
- **BTS-5:** IF either injected scheduler throws, THEN THE seams SHALL preserve
  the launch call and exact Checkout result without throwing analytics errors.
- **BTS-6:** THE production launch and Checkout action paths SHALL call these
  tested seams only after their existing authoritative inputs are available.

## 6. Verification Criteria and Task Breakdown

1. Red focused unit contracts for false launch branches, error/throwing Checkout
   branches, recovered redirect, and throwing schedulers.
2. Green the pure helpers and replace the two textual production decisions with
   calls to those helpers; do not alter provider or redirect code.
3. Keep source contracts only for authoritative call ordering and the existing
   authentication/interval early guards.
4. Run focused unit/source tests and the existing phone/desktop billing tag.
5. Commit implementation, then use one lifecycle advance as this spec's full
   recorded boundary.
