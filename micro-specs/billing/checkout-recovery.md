---
spec_id: MS-billing-checkout-recovery
status: draft
risk_class: billing
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/billing/checkout-recovery.md
  - micro-specs/evidence/MS-billing-checkout-recovery.json
  - .env.example
  - config/env-contract.json
  - package.json
  - pnpm-lock.yaml
  - app/app/account/page.tsx
  - app/app/billing/actions.ts
  - app/app/billing/page.tsx
  - app/app/launch/page.tsx
  - app/api/stripe/webhook/route.ts
  - app/dev/app-harness/account/page.tsx
  - app/dev/app-harness/account/billing-harness-client.tsx
  - app/dev/app-harness/launch/page.tsx
  - components/merchant/account/account-tabs.ts
  - components/merchant/account/billing-activation-card.tsx
  - components/merchant/account/billing-checkout-form.tsx
  - components/merchant/account/billing-outcome-query-cleanup.tsx
  - components/merchant/account/billing-panel-view.tsx
  - components/merchant/account/billing-panel.tsx
  - lib/merchant/billing-checkout-core.ts
  - lib/merchant/billing-checkout-return.ts
  - lib/merchant/billing-nav.ts
  - lib/merchant/billing-presentation.ts
  - lib/merchant/billing.ts
  - lib/merchant/launch-search-params.ts
  - lib/stripe/billing.ts
  - lib/stripe/checkout.ts
  - lib/stripe/server.ts
  - lib/stripe/webhook-events.ts
  - scripts/check-env.mjs
  - scripts/env-keys.mjs
  - scripts/provider-readiness/checks.mjs
  - tests/e2e/helpers/harness.ts
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts-snapshots/**
  - tests/micro-specs/billing-checkout-recovery.test.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/unit/account-tabs.test.mjs
  - tests/unit/billing-checkout-core.test.mjs
  - tests/unit/billing-checkout-return.test.mjs
  - tests/unit/billing-nav.test.mjs
  - tests/unit/billing-presentation.test.mjs
implementation_surfaces:
  - micro-specs/billing/checkout-recovery.md
  - micro-specs/evidence/MS-billing-checkout-recovery.json
  - .env.example
  - config/env-contract.json
  - package.json
  - pnpm-lock.yaml
  - app/app/account/page.tsx
  - app/app/billing/actions.ts
  - app/app/billing/page.tsx
  - app/app/launch/page.tsx
  - app/api/stripe/webhook/route.ts
  - app/dev/app-harness/account/page.tsx
  - app/dev/app-harness/account/billing-harness-client.tsx
  - app/dev/app-harness/launch/page.tsx
  - components/merchant/account/account-tabs.ts
  - components/merchant/account/billing-activation-card.tsx
  - components/merchant/account/billing-checkout-form.tsx
  - components/merchant/account/billing-outcome-query-cleanup.tsx
  - components/merchant/account/billing-panel-view.tsx
  - components/merchant/account/billing-panel.tsx
  - lib/merchant/billing-checkout-core.ts
  - lib/merchant/billing-checkout-return.ts
  - lib/merchant/billing-nav.ts
  - lib/merchant/billing-presentation.ts
  - lib/merchant/billing.ts
  - lib/merchant/launch-search-params.ts
  - lib/stripe/billing.ts
  - lib/stripe/checkout.ts
  - lib/stripe/server.ts
  - lib/stripe/webhook-events.ts
  - scripts/check-env.mjs
  - scripts/env-keys.mjs
  - scripts/provider-readiness/checks.mjs
  - tests/e2e/helpers/harness.ts
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts-snapshots/**
  - tests/micro-specs/billing-checkout-recovery.test.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/unit/account-tabs.test.mjs
  - tests/unit/billing-checkout-core.test.mjs
  - tests/unit/billing-checkout-return.test.mjs
  - tests/unit/billing-nav.test.mjs
  - tests/unit/billing-presentation.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/billing.md
  - micro-specs/billing/state-durability.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
related_tests:
  - tests/db/billing-state-durability.test.mjs
  - tests/e2e/merchant-billing-recovery.spec.ts
  - tests/e2e/merchant-billing-recovery.visual.spec.ts
  - tests/micro-specs/billing-checkout-recovery.test.mjs
  - tests/micro-specs/provider-readiness-smoke.test.mjs
  - tests/unit/account-tabs.test.mjs
  - tests/unit/billing-checkout-core.test.mjs
  - tests/unit/billing-checkout-return.test.mjs
  - tests/unit/billing-nav.test.mjs
  - tests/unit/billing-presentation.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-billing-checkout-recovery"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:read-only-stripe-price-contract-proof
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Mocked Stripe proof that customer and Checkout creation are idempotent, interval switches expire the exact prior Session before rotation, and provider failures return safe recoverable state.
  - Exact-session proof that missing, incomplete, foreign, wrong-mode, or mismatched returns cannot claim success or mutate billing, while an owned completed trial Session syncs only its Subscription.
  - Local PostgreSQL readback that monthly and annual provider terms, scheduled cancellation, event ordering, Checkout attempts, and webhook leases satisfy MS-billing-state-durability.
  - Desktop and mobile browser proof for one-shot outcome cleanup, truthful success/rejection/catching-up copy, exact annual receipt, cancelled restart, pending interlock, inline retry, focus, accessibility, and no horizontal overflow.
  - Read-only Stripe provider proof that both configured Growth prices are active GBP 49 per month and GBP 490 per year; no hosted Stripe or Supabase mutation is part of verification.
approved_exceptions: []
---

# MS-billing-checkout-recovery — Exact checkout return and recoverable merchant billing

## 1. Exact Goal and User-Visible Outcomes

A merchant can start or safely retry one monthly or annual Stripe Checkout,
return to the same billing surface, and see success only after that exact Session
is proven to belong to their venue and its exact Subscription is stored. Annual
buyers see annual terms, cancelled merchants can restart, Portal changes and
scheduled cancellation reconcile once, provider failures stay inline and
retryable, and stale query flags never replay a success banner on refresh.

## 2. Blast Radius

May change the merchant billing action/orchestration, Stripe billing and webhook
adapters, Account/Launch return protocol, billing presentation seams and DB-free
harness, exact environment/provider readiness, the stable Stripe SDK/API pin,
and focused unit/source/browser/visual evidence listed in frontmatter. It
consumes the schema and database functions delivered by
MS-billing-state-durability.

Out of scope: changing prices or trial length, custom payment collection,
customer loyalty entitlements, invoices/refunds/tax, Stripe Connect, hosted
provider or database writes during verification, marketing redesign outside the
billing panels, or weakening webhook signature validation.

## 3. Strict Constraints and Assumptions

- Stripe Checkout Sessions and Billing remain the subscription mechanism.
  Dynamic payment methods remain enabled by omitting `payment_method_types`.
- Every Server Action authenticates again, derives merchant identity from the
  session, validates posted interval/return path, and returns only house-authored
  client-safe failure state. Provider and database text is logged structurally,
  never rendered.
- One durable service-role-only Checkout state binds the merchant to a Stripe
  customer and fenced attempt. Provider customer creation and Session creation
  carry explicit deterministic idempotency keys; an ambiguous response is
  recovered through the same attempt rather than issuing a parallel one.
- A same-interval retry resumes the exact open Session. Switching interval first
  recovers and expires the exact current Session, then compare-and-swap rotates
  its attempt. A stale tab cannot record or complete the replacement attempt.
- Checkout success URLs contain the literal `{CHECKOUT_SESSION_ID}` placeholder.
  `checkout=success` alone is untrusted and can never produce success copy.
- Exact return verification requires a completed subscription-mode Session,
  matching merchant metadata, matching durable customer/Session ownership, and
  one concrete Subscription whose customer and merchant metadata also match.
  A trial may correctly have `payment_status=no_payment_required`.
- Return reconciliation retrieves and stores that exact current Subscription;
  broad email/customer searching is not return proof. Webhooks remain the
  authoritative asynchronous channel.
- Webhook handlers hydrate the current Subscription from Stripe before applying
  full state, pass the event cursor into the conditional database function, and
  emit revalidation/analytics only for an applied snapshot. Invoice events never
  patch `past_due` directly from a stale payload.
- A live webhook lease returns retryable non-2xx, a processed event returns an
  idempotent 2xx, and completion/failure always carries the claim's fence.
- Production return URLs use the canonical configured app origin. Development
  may use only a validated loopback request origin so a server on another local
  port returns to itself; arbitrary headers never become redirect origins.
- Outcome query keys are one-shot UI protocol. Client cleanup removes only
  billing outcome keys with `history.replaceState`, preserves tab/unrelated
  params, and leaves the rendered banner until the next navigation or refresh.
- Browser state is presentation only. Billing, customer mapping, Checkout
  attempt, Subscription terms, and webhook state remain server/DB authoritative.

## 4. Decisions Already Made

- Upgrade the stable `stripe` dependency to 22.3.1 and pin the SDK-supported
  `2026-06-24.dahlia` API version after focused type/source tests. Do not use a
  preview package or a hand-written API date unsupported by installed types.
- Use one client Checkout form containing monthly and annual submit buttons and
  one shared pending state. The submitted button supplies the interval; pending
  disables both choices and exposes `aria-busy` plus a specific progress label.
- The presentational `BillingPanelView` receives a billing read model, typed
  return outcome, mode, annual availability, and an injectable checkout action.
  The production `BillingPanel` owns auth/data orchestration; the dev harness
  injects fake provider responses at the external boundary, not pre-baked UI.
- Return outcomes are typed as `confirmed`, `missing_session`, `rejected`, or
  `catching_up`. Only `confirmed` renders success. Missing/foreign/malformed
  returns say that billing could not be confirmed and give a safe retry/readback
  path.
- The billing read model keeps raw provider subscription status and the exact
  price terms. New Checkout is allowed for no subscription, `cancelled`, and
  provider `incomplete_expired`; trialing, active, past-due, paused, unpaid, or
  otherwise suspended subscriptions route to Portal/recovery instead.
- Annual receipts render the stored GBP 490/year contract; monthly receipts
  render GBP 49/month. Unknown historical terms say that Stripe details are
  still syncing rather than inventing monthly terms.
- Portal returns use `portal=returned`, reconcile the known customer/current
  Subscription exactly once, persist `cancel_at_period_end`/`cancel_at`, and
  show `Cancels on …` when confirmed. `portal=missing`, Checkout cancellation,
  and action errors remain truthful one-shot outcomes.
- `STRIPE_GROWTH_ANNUAL_PRICE_ID` stays optional for local boot but is required
  by the production env profile. Setup instructions and read-only readiness
  validate both exact active GBP prices. The already-existing local test annual
  Price is configured without creating or modifying a provider object.

## 5. Behavioral Requirements (EARS)

- **BR-1 (eligible start):** WHEN a merchant with no Subscription, a cancelled
  Subscription, or `incomplete_expired` state submits a valid interval, THE
  action SHALL reserve or resume one merchant-owned Checkout attempt and redirect
  only to its Stripe-hosted URL.
- **BR-2 (duplicate guard):** IF billing is trialing, active, past due, paused,
  unpaid, or otherwise non-restartable, THEN a direct Checkout action call SHALL
  refuse new Session creation and return safe management guidance.
- **BR-3 (customer idempotency):** WHEN no durable Stripe customer mapping exists,
  THE provider boundary SHALL recover a matching merchant-metadata customer or
  create one with a stable merchant idempotency key before reserving Checkout.
- **BR-4 (attempt recovery):** WHEN the same interval is retried from one or many
  tabs, THE system SHALL recover the same attempt and Session. IF another
  interval is requested, THEN it SHALL recover and expire the exact prior
  Session before fenced rotation; an unconfirmed expiration SHALL preserve the
  old attempt and return retryable failure.
- **BR-5 (Session contract):** WHEN a Checkout Session is created, THE request
  SHALL use the exact configured interval price, 30-day trial, merchant/plan/
  interval metadata, customer, fenced idempotency key, allowlisted cancel URL,
  and success URL with literal `{CHECKOUT_SESSION_ID}`, while omitting
  `payment_method_types`.
- **BR-6 (exact return):** WHEN an owned completed subscription Session returns,
  THE system SHALL retrieve and validate that Session and its exact Subscription,
  apply the current full provider snapshot, refresh launch state once, and return
  `confirmed` only after healthy billing readback.
- **BR-7 (forged return):** IF the Session id is absent, foreign, incomplete,
  wrong-mode, not the merchant's recorded attempt, missing a Subscription, or
  customer-inconsistent, THEN THE system SHALL NOT sync or claim active billing
  and SHALL return `missing_session` or `rejected`.
- **BR-8 (ambiguous return):** IF provider retrieval or authoritative database
  sync fails after a plausible return, THEN THE system SHALL show `catching_up`
  with refresh/Portal guidance and SHALL NOT say billing is active.
- **BR-9 (one-shot protocol):** WHEN Checkout, Portal, or billing action outcome
  copy renders, THE client SHALL remove `checkout`, `portal`, `session_id`, and
  `billing_error` from the current URL without navigation, preserving `tab` and
  unrelated parameters so refresh does not replay the outcome.
- **BR-10 (authoritative receipt):** WHEN exact monthly or annual terms exist,
  THE receipt SHALL render that amount/currency/interval and current period;
  IF terms are absent, THEN it SHALL show syncing copy rather than defaulting to
  a monthly contract.
- **BR-11 (restart and recovery):** WHEN billing is restartable, THE Account and
  Setup surfaces SHALL expose Checkout with the retained customer; WHEN it is
  non-restartable, they SHALL expose the appropriate Portal/recovery action and
  SHALL NOT offer a duplicate Subscription.
- **BR-12 (Portal reconciliation):** WHEN Stripe Portal returns, THE system SHALL
  reconcile the known current Subscription once and show scheduled cancellation
  or updated status only after authoritative readback.
- **BR-13 (ordered webhooks):** WHEN a signed supported webhook is claimed, THE
  handler SHALL hydrate current Subscription state, conditionally apply it with
  the event cursor, and suppress stale revalidation/analytics; invoice events
  SHALL NOT directly overwrite status from their payload.
- **BR-14 (crash recovery):** IF a webhook event is processed, busy under another
  live lease, explicitly failed, or abandoned after lease expiry, THEN the route
  SHALL respectively return idempotent success, retryable non-2xx, fenced retry,
  or reclaimed processing without allowing a stale worker to finalise.
- **BR-15 (recoverable interaction):** WHILE Checkout submission is pending, THE
  form SHALL accept only one submission, disable both interval controls, announce
  progress, preserve 44-pixel touch targets and focus visibility, and avoid
  horizontal overflow at 375 pixels. IF it fails, THEN a focusable inline alert
  SHALL explain that billing was not confirmed and re-enable retry.
- **BR-16 (price readiness):** WHEN production configuration or provider smoke
  runs, THE system SHALL require and read-only verify active GBP 49/month and GBP
  490/year Prices and SHALL identify the missing or mismatched interval exactly.

## 6. Verification Criteria and Task Breakdown

1. Add failing pure/source tests for eligibility, local-origin allowlisting,
   literal success placeholder, customer/Session idempotency options, interval
   conflict recovery, exact return classification, provider term mapping, Portal
   cancellation, webhook lease/cursor consumption, API pin, and both prices.
2. Implement the provider-injected Checkout/return core and Stripe adapters with
   fake Customer, Session, Subscription, Portal, timeout, and ambiguous-response
   cases; prove that no request supplies `payment_method_types`.
3. Consume MS-billing-state-durability through fenced attempt and lease RPCs,
   full conditional billing snapshots, exact Session ownership checks, current
   Subscription hydration, one reconciliation owner, and applied-only side
   effects.
4. Extract the billing view and shared client Checkout form, add truthful typed
   outcomes and annual/scheduled-cancellation receipts, allow only valid restart
   states, and scrub one-shot keys on Launch and Account without erasing banners
   during the first render.
5. Upgrade the stable Stripe SDK/API pin, make annual price configuration
   production-required, document both ids, validate both provider objects in the
   read-only smoke, and configure the existing local test annual Price without
   provider writes.
6. Mount the production classifier/view/form seams in the DB-free Account/Launch
   harness. Across Chromium and mobile Safari prove owned success, missing and
   foreign Session rejection, one-shot cleanup/refresh, exact annual receipt,
   cancelled restart, double-submit interlock, inline failure/retry focus,
   accessibility, 375-pixel fit, and approved focused visual baselines.
7. Run the local PostgreSQL durability suite, every declared gate, and a read-only
   lookup of both configured Stripe Prices; record evidence and advance only
   after exact UI and database readback agree.
