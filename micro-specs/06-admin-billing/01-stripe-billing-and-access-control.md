---
spec_id: MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL
status: active
risk_class: billing
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/api/stripe/**
  - app/app/billing/**
  - app/pricing/**
  - lib/customer/**
  - lib/stripe/**
  - micro-specs/06-admin-billing/01-stripe-billing-and-access-control.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
implementation_surfaces:
  - app/pricing/**
  - app/app/billing/**
  - app/api/stripe/**
  - lib/stripe/**
  - lib/customer/**
  - supabase/migrations/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - manual:billing/admin micro-spec Vitest evidence in retained legacy filename
  - tests/micro-specs/marketing-auth-legal.test.ts
  - tests/micro-specs/customer.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm security:verify
  - pnpm build
approved_exceptions: []
---

# Micro-Spec: Stripe Billing and Access Control

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

A merchant can start a GBP 29/month subscription, manage billing in Stripe Customer Portal, and have Nabaperks enforce access based on trusted Stripe webhook state stored in Supabase.

## Blast Radius

In scope:

- `/pricing`
- `/app/billing`
- Stripe Checkout subscription start.
- Stripe Customer Portal link.
- Stripe webhook route handler.
- `billing_customers` persistence.
- Merchant status enforcement for trialing, active, past_due, cancelled, and suspended states.

Out of scope:

- Multiple pricing tiers in MVP.
- Per-customer, per-scan, or commission pricing.
- SMS/WhatsApp credits.
- Manual invoice management UI beyond Stripe portal link.

## Strict Constraints and Assumptions

- MVP plan is Growth Plan at GBP 29/month per location.
- Pilot offer is first 30 days free, then GBP 29/month if they continue.
- Stripe webhook signatures must be verified before updating Supabase.
- Billing state in Supabase is the app's access-control source after webhook sync.
- Cancelled merchants keep data access but cannot issue new stamps.
- Suspended merchants have customer-facing loyalty cards disabled.

## Decisions Already Made

Required Stripe events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

Status behaviour:

- `trialing`: full access.
- `active`: full access.
- `past_due`: warning with temporary grace period.
- `cancelled`: disable new stamp issuance, keep data accessible.
- `suspended`: disable customer-facing loyalty card.

## Behavioral Requirements

- **MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-001** WHEN a merchant starts checkout, THE system SHALL create a Stripe Checkout Session for the Growth Plan.
- **MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-002** WHEN checkout completes and the webhook is verified, THE system SHALL create or update the merchant billing record.
- **MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-003** WHEN Stripe sends subscription updates, THE system SHALL sync plan, status, and current period end.
- **MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-004** WHEN payment fails, THE app SHALL show a billing warning and apply the configured grace behaviour.
- **MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-005** WHEN status is cancelled, THE system SHALL block new stamp issuance while preserving dashboard data access.
- **MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-006** WHEN status is suspended, THE system SHALL disable customer-facing card use.
- **MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL-007** WHEN webhook verification fails, THE system SHALL reject the event and SHALL not update billing state.

## Verification Criteria

Acceptance criteria:

- Merchant can open Stripe Checkout from pricing or billing.
- Merchant can open Stripe Customer Portal after subscription exists.
- Webhook events update `billing_customers`.
- Access rules change based on stored status.

Manual QA:

- Use Stripe test mode to complete checkout.
- Send signed test webhook events for active, past_due, cancelled, and payment succeeded.
- Attempt stamp issuing under trialing, active, cancelled, and suspended states.
- Confirm failed signature webhook does not mutate data.

Task breakdown:

- Configure Stripe product/price contract.
- Implement checkout and portal actions.
- Implement webhook sync.
- Enforce billing states in stamp and customer-card flows.
- Verify with Stripe test events.
