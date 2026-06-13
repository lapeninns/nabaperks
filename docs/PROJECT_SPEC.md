# Nabaperks Project Specification

Last reviewed: 2026-06-13

`nabaperks-micro-specs-final.md` v3 is the binding product specification. This
document summarizes the current repo shape and must stay consistent with that
pack.

## 1. Product Summary

Nabaperks is a UK no-app QR loyalty MVP for independent local businesses. A
merchant creates one active mystery visit card, publishes one permanent venue
QR, customers join through mobile web, and counter staff approve stamps or
redemptions through a paired station.

The trust model is:

1. The customer keeps their phone.
2. The customer shows a short-lived single-use verification code.
3. A paired counter station with a named staff session approves the code.
4. Every loyalty mutation is written server-side with merchant, station, staff
   session, customer, timestamp, and action attribution.

## 2. MVP Scope

In scope:

- Public marketing, pricing, terms, privacy, and merchant reward terms pages.
- Merchant signup, login, email confirmation, onboarding, card setup, reward
  pool, QR asset generation, station setup, billing, dashboard, activity,
  customer readback, and ROI settings.
- Customer QR resolver, OTP join flow, digital stamp card, verification-code
  panel, and reward state page.
- Paired staff station setup, named staff members, station sessions, stamp
  approval, undo, and reward redemption.
- Internal admin support console for merchants, customers, billing, fraud,
  audit, privacy, and pilot metrics.
- Supabase product events as analytics source of truth, optional PostHog
  mirroring, audit logs, RLS, RBAC, rate limits, fraud signals, and
  service-role isolation.

Out of scope:

- POS integration, CRM, marketplace, referrals, wallet, native customer app,
  gift cards, AI segmentation, automated marketing, multi-location merchant UX,
  and customer self-service data export/delete.

## 3. Actors

| Actor | Routes | Access model | Primary permissions |
| --- | --- | --- | --- |
| Merchant owner | `/signup`, `/login`, `/app/*`, `/pricing` | Supabase Auth session | Manage own merchant, card, reward pool, QR, staff, stations, billing, dashboard, activity, and customers. |
| Customer | `/q/[qrId]`, `/m/[merchantSlug]/join`, `/card/[membershipId]`, `/reward/[rewardId]` | Supabase OTP/session | Manage own membership, card, verification tokens, assigned rewards, and consent state. |
| Staff | `/staff` | Paired station credential plus named staff PIN session | Approve customer verification codes for the station's merchant. |
| Internal admin | `/admin/*` | Supabase session plus `internal_admins`; MFA when enabled | Support merchants and customers, adjust stamps, cancel rewards, review fraud, billing, audit, privacy, and pilot state. |
| System | `/api/stripe/webhook`, server modules | Stripe signature or server runtime | Billing sync, service-role event writes, audit writes, and analytics mirroring. |

## 4. Core Journeys

### Merchant Setup

1. Merchant signs up from `/signup`.
2. Supabase confirms email through `/auth/confirm`.
3. Merchant completes `/app/onboarding`.
4. Merchant creates the mystery card and reward pool from `/app/card`.
5. Merchant adds named staff and creates a station pairing from `/app/staff`.
6. Merchant generates QR assets from `/app/qr`.
7. Merchant starts or manages billing from `/pricing` or `/app/billing`.

### Customer Join

1. Customer scans a printed QR code.
2. `/q/[qrId]` records `qr_scanned` and redirects to `/m/[merchantSlug]/join`.
3. Customer verifies identity by email or phone OTP.
4. Customer accepts loyalty terms and optionally opts into marketing.
5. `join_customer_membership` creates or returns the membership.
6. Customer lands on `/card/[membershipId]`.

### Stamp Approval

1. Customer opens their card and creates a short-lived stamp code.
2. Staff signs into `/staff` on a paired station with an individual PIN.
3. Staff looks up the customer code.
4. `approve_stamp_token` consumes the token atomically and writes the stamp.
5. At threshold, the app selects a reward snapshot from `reward_pool_items`.
6. The reward becomes redeemable from the next UK business day.

### Reward Redemption

1. Customer opens `/reward/[rewardId]` and creates a redemption code when ready.
2. Staff looks up the code from the paired station.
3. `redeem_reward_token` consumes the token atomically and marks the reward
   redeemed once.
4. The visible stamp cycle resets.

## 5. Technical Architecture

| Layer | Current specification |
| --- | --- |
| Frontend | Next.js 16.2.6 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, local shadcn-compatible components. |
| Backend | Next.js Server Actions, Route Handlers, and Vercel Functions. |
| Database | Supabase Postgres with RLS, security-definer RPCs, migrations, and SQL tests. |
| Auth | Supabase Auth with cookie-based server clients and OTP flows. |
| Payments | Stripe Billing, Checkout, Customer Portal, and signed webhooks. |
| Analytics | Supabase `product_events` as source of truth; optional PostHog best-effort capture. |
| Email | Resend key is part of the env contract; transactional sending is not wired yet. |
| Hosting | Vercel for Next.js; Supabase for database/auth. |

## 6. Route Families

| Family | Purpose |
| --- | --- |
| `/` | Marketing home. |
| `/pricing` | Growth Plan and Stripe checkout entry. |
| `/login`, `/signup`, `/auth/confirm` | Merchant auth and Supabase callback. |
| `/app/*` | Merchant dashboard, onboarding, card, QR, staff, customers, activity, settings, and billing. |
| `/q/[qrId]` | Public QR resolver. |
| `/m/[merchantSlug]`, `/m/[merchantSlug]/join` | Merchant public landing and customer join. |
| `/card/[membershipId]` | Customer stamp card and stamp-code creation. |
| `/reward/[rewardId]` | Customer reward state and redemption-code creation. |
| `/staff` | Paired counter station, staff session, code lookup, stamp approval, undo, and redemption. |
| `/admin/*` | Internal support, pilot, billing, fraud, audit, and privacy console. |
| `/api/stripe/webhook` | Stripe billing synchronization. |

## 7. Data Model

Core tables:

| Table | Purpose |
| --- | --- |
| `merchants`, `merchant_locations` | Merchant profile and MVP location scope. |
| `staff_users` | Named staff metadata and station-bound PIN hashes. |
| `stations`, `staff_sessions`, `station_pin_attempts` | Paired station credentials, open staff sessions, and station-side PIN telemetry. |
| `loyalty_cards`, `reward_pool_items`, `qr_codes` | Merchant loyalty configuration and permanent QR records. |
| `customers`, `customer_memberships` | Customer identity and per-merchant card state. |
| `verification_tokens` | Short-lived single-use customer codes for stamp and redemption approval. |
| `stamp_events`, `reward_events` | Auditable loyalty ledger and assigned reward snapshots. |
| `fraud_flags`, `rate_limit_buckets`, `consent_records`, `billing_customers`, `audit_logs`, `product_events` | Security, compliance, billing, audit, and analytics records. |

Primary RPCs:

| RPC | Requirement |
| --- | --- |
| `create_merchant_onboarding` | Create merchant and first location for an authenticated owner. |
| `save_loyalty_card`, `upsert_reward_pool_item`, `delete_reward_pool_item` | Manage card and reward pool state. |
| `create_or_get_join_qr`, `set_qr_active`, `record_qr_download` | Manage permanent venue QR records and asset events. |
| `add_staff_member`, `set_staff_member_active`, `create_station_pairing`, `pair_station`, `revoke_station` | Manage named staff and station lifecycle. |
| `start_staff_session`, `end_staff_session`, `get_station_state` | Manage station-bound staff sessions. |
| `create_verification_token`, `get_verification_token_status`, `lookup_verification_code` | Create and inspect short-lived customer codes. |
| `approve_stamp_token`, `redeem_reward_token`, `undo_recent_stamp` | Consume tokens and mutate the auditable loyalty ledger. |
| Admin RPCs | Adjust stamps, cancel rewards, activate/regenerate QR codes, record consent opt-outs, log data requests, and log pilot notes. |
| `enforce_rate_limit` | Atomically enforce durable server-side rate limits. |

## 8. Environment Contract

Required or supported variables are defined in `config/env-contract.json` and
documented in `docs/ENV_KEYS.md`.

| Variable | Runtime | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Browser/server | Canonical app URL for redirects, QR links, and Stripe returns. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server | Supabase anon key protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service-role Supabase key for trusted server code. |
| `STRIPE_SECRET_KEY` | Server only | Stripe API secret. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser/server | Stripe publishable key. |
| `STRIPE_GROWTH_PRICE_ID` | Server only | Recurring Growth Plan price. |
| `STRIPE_WEBHOOK_SECRET` | Server only | Stripe webhook signature secret. |
| `RESEND_API_KEY` | Server only | Reserved for Resend transactional email. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Browser/server | Optional PostHog project key. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Browser/server | Optional PostHog host. |
| `SUPABASE_DB_URL` | Local/server scripts | Optional migration/test database URL. |
| `SUPABASE_DB_PASSWORD` | Local/server scripts | Optional local linked project database password. |

## 9. Release Gates

- Merchant can complete signup, confirmation, onboarding, card setup, reward
  pool setup, staff/station setup, QR generation, QR download, and billing.
- Customer can scan, join, view card, generate a stamp code, unlock a reward,
  and generate a redemption code from mobile web.
- Staff can pair a station, sign in with an individual PIN, approve stamps,
  undo the most recent station stamp, and redeem rewards without touching the
  customer phone.
- QR launch stays blocked until there is an active card, active reward pool,
  active named staff member, and active paired station.
- Admin can review and support merchants/customers without direct database
  editing.
- RLS tenant isolation, static schema verification, security verification,
  Vitest micro-specs, lint, typecheck, and build pass.

## 10. Source Of Truth Map

| Source | Role |
| --- | --- |
| `nabaperks-micro-specs-final.md` | Binding v3 product and engineering specification. |
| `AGENTS.md` | Agent-facing stack, project guardrails, and Next.js documentation warning. |
| `README.md` | Human setup, scripts, environment summary, and redesign overview. |
| `docs/ARCHITECTURE.md` | As-built route, module, data, RPC, flow, integration, and traceability map. |
| `DESIGN.md` | Visual system, tokens, typography, layout, and component conventions. |
| `docs/ENV_KEYS.md` | Provider key setup and local/Vercel environment instructions. |
| `app/` | Next.js route, page, layout, server action, and route handler implementation. |
| `lib/` | Server modules, data access, integrations, analytics, security, and environment helpers. |
| `supabase/migrations/` | Database schema, RLS, RPCs, grants, and schema evolution. |
| `supabase/tests/tenant_isolation.sql` | Tenant isolation and critical database behavior checks. |
| `tests/micro-specs/` | Vitest implementation checks by product slice. |
