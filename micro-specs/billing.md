---
spec_id: MS-billing
status: implemented
risk_class: billing
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/app/billing/**
  - app/api/stripe/**
  - lib/stripe/**
  - micro-specs/**
  - tests/db/billing*.test.mjs
implementation_surfaces:
  - app/app/billing/page.tsx
  - app/app/billing/actions.ts
  - app/api/stripe/webhook/route.ts
  - lib/stripe/billing.ts
  - lib/stripe/server.ts
  - lib/stripe/webhook-events.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/launch.md
  - micro-specs/customer/card-stamp.md
related_tests:
  - tests/micro-specs/launch-billing-local-stripe.test.mjs
  - tests/db/architecture-moat.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-billing — Stripe checkout/portal + idempotent webhooks + fail-closed entitlement

## Intent

Merchants subscribe through Stripe Checkout and manage their plan through the
Stripe billing portal. Inbound Stripe webhooks are signature-verified and made
exactly-once via a claim table keyed on the Stripe event id, so a redelivered or
duplicated event never double-applies. Entitlement **fails closed**: a merchant
that requires billing and has no `active`/`trial` status cannot run the loyalty
ledger — the customer stamp/redeem RPCs reject inside the database.

## Scope (in)

- `/app/billing` (checkout + portal server actions) and the customer/merchant
  billing state (`billing_customers`).
- `/api/stripe/webhook` signature verification and the idempotent claim
  lifecycle (`lib/stripe/webhook-events.ts`: `claimStripeWebhookEvent`,
  `markStripeWebhookEventProcessed`, `markStripeWebhookEventFailed`).
- The fail-closed entitlement gate as it is enforced inside the loyalty RPCs.

## Scope (out)

- The loyalty ledger mechanics themselves (owned by [MS-customer-card-stamp] /
  [MS-customer-redeem]) — this spec only asserts the billing GATE on them.
- Launch-readiness's consumption of billing status (owned by
  [MS-merchant-launch]). Real Stripe network calls are out; the contract is
  verified against the local stripe-mock / DB. No schema change.

## Decisions already made

- Webhook idempotency is a `stripe_webhook_events` row with a unique
  `stripe_event_id`. A fresh insert → `claimed`; a unique-violation (`23505`) →
  `duplicate` (skip) UNLESS the stored event is `processed_at IS NULL AND
  failed_at IS NOT NULL`, in which case it is re-claimed (retry on redelivery).
- A handled event is marked `processed_at`; a thrown handler marks `failed_at` +
  `last_error`.
- Entitlement fails closed: the stamp/redeem RPCs reject when the merchant
  `requires_billing` and `billing_customers.status` is null/`cancelled`/
  `suspended`; they open on `trial`/`active`.

## EARS requirements

- **B-1 (signature):** IF an inbound `/api/stripe/webhook` request does not carry
  a valid Stripe signature for `STRIPE_WEBHOOK_SECRET`, THEN THE system SHALL
  reject it without processing.
- **B-2 (idempotent claim):** WHEN a signed webhook event is received, THE system
  SHALL claim it by inserting a uniquely-keyed `stripe_webhook_events` row; a
  second delivery of the same event id SHALL resolve to `duplicate` and SHALL NOT
  be reprocessed.
- **B-3 (retry failed):** IF a claimed event previously failed (`failed_at` set,
  `processed_at` null), THEN a redelivery SHALL be allowed to re-claim and retry.
- **B-4 (mark processed):** WHEN an event handler succeeds, THE system SHALL set
  `processed_at` so the event is never applied again.
- **B-5 (entitlement fail-closed):** IF a merchant requires billing and has no
  `active`/`trial` billing status, THEN the loyalty stamp/redeem RPCs SHALL
  reject inside the database (no stamp, no redemption).
- **B-6 (entitlement open):** WHEN billing status is `trial` or `active`, THE
  loyalty RPCs SHALL operate normally.
- **B-7 (checkout/portal scope):** WHEN a merchant starts checkout or opens the
  portal, THE system SHALL act on their own merchant's billing customer only.

## Verification method

Live-DB tier (`pnpm test:db`): `tests/db/architecture-moat.test.mjs` proves B-5
("merchant requires billing + no billing row → stamp issuance fails closed inside
the RPC"). The local-Stripe contract (checkout/portal/webhook shape) is guarded
by `tests/micro-specs/launch-billing-local-stripe.test.mjs`. The claim/duplicate/
retry logic (B-2/B-3/B-4) is pure and unit-checkable against `stripe_webhook_
events`. Signature rejection (B-1) is asserted at the route boundary.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:db`.
