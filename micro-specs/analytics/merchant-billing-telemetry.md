---
spec_id: MS-analytics-merchant-billing-telemetry
status: active
risk_class: billing
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/analytics/merchant-billing-telemetry.md
  - micro-specs/evidence/MS-analytics-merchant-billing-telemetry.json
  - lib/analytics/merchant-billing-events.ts
  - app/app/launch/page.tsx
  - app/app/billing/actions.ts
  - lib/merchant/billing-checkout-return.ts
  - lib/stripe/checkout.ts
  - tests/unit/billing-stripe-orchestration.test.mjs
  - tests/micro-specs/merchant-billing-telemetry.test.mjs
  - tests/db/merchant-activation-ledger.test.mjs
  - tests/db/billing-state-durability.test.mjs
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
implementation_surfaces:
  - micro-specs/analytics/merchant-billing-telemetry.md
  - micro-specs/evidence/MS-analytics-merchant-billing-telemetry.json
  - lib/analytics/merchant-billing-events.ts
  - app/app/launch/page.tsx
  - app/app/billing/actions.ts
  - lib/merchant/billing-checkout-return.ts
  - lib/stripe/checkout.ts
  - tests/unit/billing-stripe-orchestration.test.mjs
  - tests/micro-specs/merchant-billing-telemetry.test.mjs
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.desktop.spec.ts
related_tests:
  - tests/unit/billing-stripe-orchestration.test.mjs
  - tests/micro-specs/merchant-billing-telemetry.test.mjs
  - tests/db/merchant-activation-ledger.test.mjs
  - tests/db/billing-state-durability.test.mjs
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
  - Unit proof that only the three exact milestone seams schedule analytics and that a throwing scheduler cannot change billing render, redirect, verification, stale-apply, or provider-failure outcomes.
  - Source proof that billing events use fixed semantic idempotency keys, bounded first-party source values, and no Checkout Session, Stripe customer, Subscription, URL, or contact metadata.
  - Live database proof that the activation recorder is service-role-only and retry-idempotent while durable billing activation remains first-write-once and event-only claims cannot satisfy the cohort.
  - Phone and desktop browser proof that the setup billing gate remains usable and presents the existing trial and price contract after instrumentation.
approved_exceptions: []
---

# MS-analytics-merchant-billing-telemetry — Authoritative merchant billing telemetry

## 1. Exact Goal and User-Visible Outcomes

Internal operators can distinguish whether a merchant who still needs billing
reached the billing step, obtained a valid Stripe Checkout redirect, and
returned through an exactly verified owned Checkout Session. The merchant's
setup, redirect, and return outcomes remain unchanged even when analytics is
unavailable, and no Stripe or contact identifier is added to event metadata.

## 2. Blast Radius

In scope: one server-only billing milestone adapter; the launch model boundary,
successful Checkout action boundary, and exact verified-return application
boundary; focused unit/source proof; existing live billing/activation database
proof; and phone/desktop billing-gate non-regression proof.

Out of scope: Supabase schema or RPC changes, the Stripe webhook route,
subscription mutation semantics, Checkout/Portal provider calls, entitlement
or activation rules, portal telemetry, signup/onboarding telemetry, admin UI,
new merchant UI or copy, PostHog configuration, new browser storage, and new
dependencies. `merchant_billing_activated` remains an optional mirror; the
durable `billing_customers.activated_at` fact is already the authoritative
activation milestone and this spec does not add a second caller for it.

## 3. Strict Constraints and Assumptions

- The existing service-role-only `record_merchant_activation_event` RPC and
  `scheduleMerchantActivationEvent` adapter remain the only event persistence
  boundary. Billing code must not write `product_events` directly.
- `merchant_billing_reached` is valid only when the authoritative launch model
  resolves both `activeTab='billing'` and `needsBilling=true`.
- `merchant_billing_checkout_started` means a usable, durable or recovered
  Checkout redirect is ready. A submit, interval choice, provider attempt, or
  error is not a started Checkout.
- `merchant_billing_checkout_returned` means the exact recorded Session is
  complete, subscription-mode, merchant/customer owned, and its exact
  Subscription has passed ownership and snapshot validation. It is independent
  of whether a concurrent webhook makes the subsequent billing apply stale.
- Event scheduling is fail-open and after-response. It must not be awaited on a
  render, action, redirect, or billing mutation critical path.
- The fixed semantic idempotency keys are `first-entry`,
  `first-session-ready`, and `first-verified-return` respectively.
- Detailed provenance stays first-party as `merchant_billing` or
  `stripe_checkout`; the existing activation adapter normalizes any optional
  external mirror to the privacy-reviewed `merchant_activation` category.
- Metadata contains only the bounded source. Checkout Session ids, Stripe
  customer ids, Subscription ids, URLs, prices, contact values, and exception
  messages are forbidden.
- No schema, provider contract, billing outcome, UI state, or third-party
  dependency changes are permitted by this spec.

## 4. Decisions Already Made

- The three milestones are observed at server-owned seams, never from browser
  clicks or query parameters alone.
- Launch reach is decided only after `getLaunchPageModel` returns its
  authoritative `activeTab` and `needsBilling` values.
- Checkout start is scheduled only after `prepareBillingCheckout` returns its
  validated redirect result and immediately before the existing redirect.
- Verified return is observed at the exact application dependency invoked only
  after Session, customer, merchant, Subscription, and snapshot validation. It
  is scheduled before that dependency runs so an `applied`, `stale`, or
  thrown apply result cannot erase a genuine verified return.
- The verified-return observer wraps only Checkout return reconciliation, not
  Portal reconciliation or generic subscription application. The observer is
  optional, receives only the merchant id, and is caught at the orchestration
  boundary so it cannot alter the apply call or return outcome.
- Duplicate renders, action retries, and return retries intentionally reuse the
  same semantic keys; the database owns deduplication.
- Browser proof is a billing UX non-regression gate. Unit/source proof owns
  event-condition and fail-open behavior; live database proof owns idempotency,
  ACL, and durable activation truth.

## 5. Behavioral Requirements (EARS)

- **BT-1:** WHEN the launch model resolves the billing tab for a merchant who
  still needs billing, THE system SHALL schedule exactly the
  `merchant_billing_reached` milestone with idempotency key `first-entry`.
- **BT-2:** IF the launch model resolves another tab or billing is no longer
  required, THEN THE system SHALL NOT schedule a billing-reached milestone.
- **BT-3:** WHEN Checkout preparation returns a usable redirect, THE system
  SHALL schedule `merchant_billing_checkout_started` with idempotency key
  `first-session-ready` before preserving the existing redirect outcome.
- **BT-4:** IF authentication, interval validation, origin validation, durable
  attempt recovery, provider creation, or URL validation does not produce a
  redirect, THEN THE system SHALL NOT schedule checkout-started.
- **BT-5:** WHEN an exact completed Checkout Session and its Subscription pass
  all ownership and snapshot checks, THE system SHALL schedule
  `merchant_billing_checkout_returned` with idempotency key
  `first-verified-return` before attempting the current-subscription apply.
- **BT-6:** IF a Checkout return is missing, foreign, wrong-mode, incomplete,
  missing its Subscription, customer-mismatched, or fails before snapshot
  validation, THEN THE system SHALL NOT schedule checkout-returned.
- **BT-7:** WHEN a verified return's current-subscription apply is applied,
  stale, or throws, THE system SHALL preserve both the existing billing outcome
  and the already scheduled verified-return milestone.
- **BT-8:** IF any milestone scheduler or downstream analytics writer throws,
  THEN THE system SHALL preserve the launch render, Checkout redirect, exact
  return verification, billing apply, and existing safe error outcome.
- **BT-9:** THE billing telemetry adapter SHALL send only the merchant id,
  closed event name, semantic idempotency key, and bounded source to the
  existing activation scheduler, with no provider or contact metadata.
- **BT-10:** THE activation cohort SHALL continue to derive billing activation
  only from first-write-once `billing_customers.activated_at`; supplemental
  product events SHALL NOT activate an account or start its seven-day clock.

## 6. Verification Criteria and Task Breakdown

Observable proof:

1. First fail focused unit tests until reach scheduling is gated by both launch
   facts, start scheduling occurs only for redirect results, and the verified
   return wrapper schedules before apply while swallowing scheduler failures.
2. First fail source-contract tests until all three production seams use the
   server-only adapter with the exact event names, keys, sources, and no
   provider-derived metadata.
3. Prove negative return classifications, provider preparation errors, stale
   applies, and thrown observers do not create false milestones or alter the
   existing billing outcomes.
4. Run the live database tests that prove service-only recorder ACL,
   semantic-key replay idempotency, first-write-once billing activation, and
   rejection of event-only activation claims.
5. Render the setup billing gate in mobile Safari and Chromium and verify the
   existing free-trial, monthly/annual price, accessible actions, and no
   horizontal overflow remain intact.
6. Run the declared gates once at the implementation lifecycle boundary and
   record the evidence ledger only from the committed implementation state.
