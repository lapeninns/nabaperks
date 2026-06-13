# Nabaperks MVP Micro-Specs

This folder contains the current executable micro-specs for the Nabaperks MVP.

Use these files in order. Each spec is intended to be a focused 1-3 day implementation slice with explicit scope, settled decisions, EARS requirements, and verification gates.

## Source Documents

- `Instructions_MircroSpecsCreation.md` - required micro-spec structure and writing style.
- `Instructions_tdd.md` - test-first implementation workflow.
- `AGENTS.md` - project stack and Next.js guidance.
- `DESIGN.md` - brand, UI tokens, and component conventions.

## Global Context

Read `GLOBAL_CONTEXT.md` before any individual spec. It contains reusable project-wide constraints that should not be repeated in every implementation task.

## Recommended Build Order

| Phase | Spec | Purpose |
|---|---|---|
| 0 | `00-mvp-scope/01-scope-and-release-gates.md` | Lock MVP boundaries, non-goals, pilot gates, and release assumptions. |
| 1 | `01-foundation/01-project-shell-and-environments.md` | Prepare the Next.js/Vercel/Supabase-ready app foundation. |
| 1 | `01-foundation/02-supabase-schema-rls-and-audit.md` | Create the data model, tenant isolation, roles, and audit backbone. |
| 2 | `02-merchant/01-merchant-auth-onboarding-and-business-profile.md` | Let merchants sign up and create their first business/location profile. |
| 2 | `02-merchant/02-loyalty-card-builder.md` | Let merchants create one mystery visit card and manage its reward pool. |
| 2 | `02-merchant/03-dynamic-qr-generation-and-downloads.md` | Generate one permanent venue QR and downloadable merchant assets. |
| 3 | `03-customer/01-qr-resolver-and-customer-join.md` | Resolve `/q/{qr_id}` and let customers join without an app. |
| 3 | `03-customer/02-digital-stamp-card.md` | Show a mobile customer visit card with locked and revealed reward states. |
| 4 | `04-staff-rewards/01-staff-pin-stamp-issuing.md` | Let staff approve one visit stamp per UK date with PIN validation and fraud controls. |
| 4 | `04-staff-rewards/02-reward-unlock-and-redemption.md` | Reveal assigned rewards and redeem them once from the next UK business day. |
| 5 | `05-merchant-value/01-merchant-dashboard-activity-and-roi.md` | Prove merchant value through members, repeats, activity, and ROI estimates. |
| 6 | `06-admin-billing/01-stripe-billing-and-access-control.md` | Start subscriptions, sync Stripe state, and enforce billing access. |
| 6 | `06-admin-billing/02-internal-admin-support-console.md` | Give internal admins support, adjustment, fraud, QR, and audit tools. |
| 7 | `07-observability-compliance/01-events-analytics-and-funnels.md` | Record product events in Supabase and track funnels in PostHog. |
| 7 | `07-observability-compliance/02-consent-legal-pages-and-data-requests.md` | Separate loyalty participation from marketing consent and support UK data requests. |
| 7 | `07-observability-compliance/03-security-fraud-and-rate-limits.md` | Harden PINs, QR flows, webhooks, admin access, and abuse detection. |
| 8 | `08-pilot/01-pilot-readiness-and-validation.md` | Prepare the 10-20 merchant pilot and success measurement loop. |

## Working Rule

Do not treat this folder as a fixed implementation plan if live code evidence contradicts it. Before implementing any spec, inspect the current repo state and narrow the task to what is still missing.
