# Global Context for Nabaperks Micro-Specs

These constraints apply to every micro-spec unless a deeper project instruction or a specific spec explicitly overrides them.

## Product Positioning

Nabaperks is a UK no-app QR loyalty platform for independent local businesses. The MVP must prove that merchants will pay monthly for a simple replacement for paper loyalty cards.

The product promise is:

> Replace paper loyalty cards with QR stamp cards in 5 minutes.

The first beachhead is independent cafes, dessert shops, bubble tea shops, barbers, and salons. The strongest initial segment is cafes and dessert/bubble tea shops.

## MVP Boundaries

Build a mobile-web QR stamp card platform. Do not build a CRM, POS integration, marketplace, referral system, stored-value wallet, customer mobile app, AI segmentation engine, gift-card product, or automated SMS/WhatsApp marketing product during MVP.

The MVP supports one location and one active loyalty card per merchant account. Multi-location structure may be represented in the data model, but multi-location UX and billing are out of scope unless a spec says otherwise.

## Settled Stack Decisions

- Frontend: Next.js App Router with React, hosted on Vercel.
- Backend: Next.js Route Handlers, Server Actions, and Vercel Functions.
- Database: Supabase Postgres.
- Auth: Supabase Auth with Row Level Security.
- Payments: Stripe Checkout, Stripe Billing, Stripe Customer Portal, and Stripe webhooks.
- Analytics: Supabase product event tables as source of truth, plus PostHog for funnels and product analytics.
- Email: Resend for transactional email.
- Design: `DESIGN.md` "Honey & Ink" / "Tactile Modernism" system.
- UI components: existing local components and shadcn/ui conventions.

## Next.js Guidance

This repo uses Next.js `16.2.6`. Before implementing app routes, Server Actions, Route Handlers, auth, or data mutation, read the relevant local documentation under `node_modules/next/dist/docs/`.

Relevant starting points:

- `node_modules/next/dist/docs/01-app/index.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`

## Security Baseline

- Enforce HTTPS in production.
- Enable RLS on tenant, customer, billing, loyalty, event, and support tables.
- Merchant owners can only access their own merchant account.
- Staff can only perform allowed actions for their merchant/location.
- Customers can only access their own customer profile, memberships, and reward state.
- Admin access is restricted to internal admin roles with MFA.
- Service-role Supabase keys may only be used in trusted server-side code.
- Stripe webhooks must verify signatures before changing billing state.
- Server-side mutation inputs must be validated.
- Sensitive secrets must never be exposed to client bundles.

## Data and Event Principles

Supabase tables are the system of record. PostHog is for product analytics, funnels, session-level usage insight, and optional error tracking.

Business-critical events must be persisted in Supabase before or alongside external analytics calls. Event payloads must avoid unnecessary personal data.

## UK Compliance Baseline

Customer loyalty participation and marketing opt-in are separate choices. Customers must be able to join and collect stamps without marketing consent.

The MVP must include a privacy notice, merchant reward terms surface, consent records, and a data request support path. Legal review is still required before public launch.

## Design Baseline

Customer flows are mobile-first and optimized for use at a checkout counter. Keep the customer experience fast, high-contrast, and thumb-friendly.

Use the `DESIGN.md` tokens and conventions:

- Honey Amber for primary reward/action moments.
- Paper Cream and Espresso Ink for warm high-contrast surfaces and text.
- Fresh Green/Mint for success and progress.
- Rounded, tactile controls with accessible tap targets.
- QR codes must always render on high-contrast white backgrounds.

## Verification Baseline

Every implementation slice must include:

- Automated tests or typed checks appropriate to the changed layer.
- Manual QA for the primary happy path and the named failure paths.
- Tenant isolation checks when data access changes.
- Audit/event readback when business-critical mutations occur.
- No unreviewed expansion beyond the spec's out-of-scope list.
