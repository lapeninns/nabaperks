# Nabaperks Project Specification

Last reviewed: 2026-06-15

This document is the source-of-truth product specification (as-built). It
summarizes the current repo shape after the static-QR self-service stamp model
replaced the older approval flow. Binding cross-cutting rules live in
`micro-specs/GLOBAL_CONTEXT.md`.

## 1. Product Summary

Nabaperks is a UK no-app QR loyalty MVP for independent local businesses. A
merchant creates one active mystery visit card, publishes one permanent venue
QR, and customers join, stamp, and present rewards for merchant-scanned
collection through mobile web.

The trust model is:

1. The customer keeps their phone.
2. The permanent venue QR routes new customers to join and existing members to
   a stamp-confirm screen.
3. The customer taps to add one stamp, capped at one stamp per UK business day.
4. Optional GPS checks are soft: out-of-range, denied, or unavailable location
   still completes the stamp and writes a fraud review flag.
5. Every loyalty mutation is written server-side with merchant, customer,
   membership, timestamp, action, and metadata attribution.

## 2. MVP Scope

In scope:

- Public marketing, pricing, terms, privacy, and merchant reward terms pages.
- Merchant signup, login, onboarding, card setup, reward pool, venue address
  and soft GPS settings, QR asset generation, billing, dashboard, activity,
  customer readback, and ROI settings.
- Customer QR resolver, OTP join flow, digital stamp card, self-service stamp
  confirmation, and reward state / merchant-scanned collection page.
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

| Actor          | Routes                                                                                           | Access model                                              | Primary permissions                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Merchant owner | `/signup`, `/login`, `/app/*`, `/pricing`                                                        | Supabase Auth session                                     | Manage own merchant, card, reward pool, QR, venue checks, billing, dashboard, activity, and customers.                  |
| Customer       | `/q/[qrId]`, `/m/[merchantSlug]/join`, `/card/[membershipId]`, `/reward/[rewardId]`, `/wallet/*` | Twilio Verify plus signed customer session cookie         | Manage own membership, card, assigned rewards, and consent state.                                                       |
| Internal admin | `/admin/*`                                                                                       | Supabase session plus `internal_admins`; MFA when enabled | Support merchants and customers, adjust stamps, cancel rewards, review fraud, billing, audit, privacy, and pilot state. |
| System         | `/api/stripe/webhook`, server modules                                                            | Stripe signature or server runtime                        | Billing sync, service-role event writes, audit writes, and analytics mirroring.                                         |

## 4. Core Journeys

### Merchant Setup

1. Merchant signs up from `/signup`.
2. Supabase confirms email through `/auth/confirm`.
3. Merchant completes `/app/onboarding`.
4. Merchant creates the mystery card and reward pool from `/app/launch?tab=card`.
5. Merchant saves venue address and optional GPS review settings from
   `/app/launch?tab=venue`.
6. Merchant generates QR assets from `/app/launch?tab=qr`.
7. Merchant starts or manages billing from `/pricing` or `/app/billing`.

### Customer Join And Stamp

1. Customer scans a printed QR code.
2. `/q/[qrId]` records `qr_scanned`.
3. New customers go to `/m/[merchantSlug]/join`; existing members go to
   `/card/[membershipId]/stamp?qr=...`.
4. New customers verify their phone with Twilio Verify, accept loyalty terms,
   and land on `/card/[membershipId]`.
5. Existing members tap to add a self-service stamp. The server enforces one
   stamp per UK business day and logs optional location anomalies.

### Reward Redemption

1. At threshold, the app selects a reward snapshot from `reward_pool_items`.
2. The reward becomes redeemable from the next UK business day.
3. Customer opens `/reward/[rewardId]` and shows the collection QR at the
   venue.
4. The logged-in merchant scans the reward QR from `/app/rewards/scan`.
5. `redeem_self_service_reward` marks the reward redeemed once and resets the
   visible stamp cycle.

## 5. Route Families

| Family                                        | Purpose                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `/`                                           | Marketing home.                                                                 |
| `/pricing`                                    | Growth Plan and Stripe checkout entry.                                          |
| `/login`, `/signup`, `/auth/confirm`          | Merchant auth and Supabase callback.                                            |
| `/app/*`                                      | Merchant dashboard, onboarding, launch, customers, activity, settings, billing. |
| `/q/[qrId]`                                   | Public QR resolver for join or stamp-confirm routing.                           |
| `/m/[merchantSlug]`, `/m/[merchantSlug]/join` | Merchant public landing and customer join.                                      |
| `/card/[membershipId]`                        | Customer stamp card.                                                            |
| `/card/[membershipId]/stamp`                  | QR-context self-service stamp confirmation.                                     |
| `/reward/[rewardId]`                          | Customer reward state and merchant-scanned collection QR.                       |
| `/admin/*`                                    | Internal support, pilot, billing, fraud, audit, and privacy console.            |
| `/api/stripe/webhook`                         | Stripe billing synchronization.                                                 |

## 6. Data Model

| Table                                                                                                       | Purpose                                                                           |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `merchants`, `merchant_locations`                                                                           | Merchant profile, MVP location, address, geocoded coordinates, soft GPS settings. |
| `staff_users`                                                                                               | Legacy named team metadata retained for historical records.                       |
| `loyalty_cards`, `reward_pool_items`, `qr_codes`                                                            | Merchant loyalty configuration and permanent QR records.                          |
| `customers`, `customer_memberships`                                                                         | Customer identity and per-merchant card state.                                    |
| `stamp_events`, `reward_events`                                                                             | Auditable loyalty ledger and assigned reward snapshots.                           |
| `fraud_flags`, `rate_limit_buckets`, `consent_records`, `billing_customers`, `audit_logs`, `product_events` | Security, compliance, billing, audit, and analytics records.                      |

Primary RPCs:

| RPC                                                                       | Requirement                                                                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `create_merchant_onboarding`                                              | Create merchant and first location for an authenticated owner.                                                                |
| `save_loyalty_card`, `upsert_reward_pool_item`, `delete_reward_pool_item` | Manage card and reward pool state.                                                                                            |
| `create_or_get_join_qr`, `set_qr_active`, `record_qr_download`            | Manage permanent venue QR records and asset events.                                                                           |
| `issue_self_service_stamp`                                                | Issue one customer-owned stamp per UK business day and log soft GPS anomalies.                                                |
| `redeem_self_service_reward`                                              | Collect an unlocked customer-owned reward once from the merchant-scanned reward QR.                                           |
| Admin RPCs                                                                | Adjust stamps, cancel rewards, activate/regenerate QR codes, record consent opt-outs, log data requests, and log pilot notes. |
| `enforce_rate_limit`                                                      | Atomically enforce durable server-side rate limits.                                                                           |

## 7. Release Gates

- Merchant can complete signup, confirmation, onboarding, card setup, reward
  pool setup, venue checks, QR generation, QR download, and billing.
- Customer can scan, join, view card, add a self-service stamp, unlock a reward,
  and present the reward QR for merchant-scanned collection.
- QR launch readiness requires active card, active reward pool, saved venue
  checks, and generated QR.
- Admin can review and support merchants/customers without direct database
  editing.
- RLS tenant isolation, static schema verification, security verification,
  Vitest micro-specs, lint, typecheck, and build pass.
