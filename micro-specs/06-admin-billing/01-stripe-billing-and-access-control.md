# Micro-Spec: Stripe Billing and Access Control

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

- WHEN a merchant starts checkout, THE system SHALL create a Stripe Checkout Session for the Growth Plan.
- WHEN checkout completes and the webhook is verified, THE system SHALL create or update the merchant billing record.
- WHEN Stripe sends subscription updates, THE system SHALL sync plan, status, and current period end.
- WHEN payment fails, THE app SHALL show a billing warning and apply the configured grace behaviour.
- WHEN status is cancelled, THE system SHALL block new stamp issuance while preserving dashboard data access.
- WHEN status is suspended, THE system SHALL disable customer-facing card use.
- WHEN webhook verification fails, THE system SHALL reject the event and SHALL not update billing state.

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
