---
spec_id: MS-customer-join
status: implemented
risk_class: auth-session
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/q/**
  - app/m/**
  - lib/customer/**
  - micro-specs/customer/**
  - tests/e2e/customer-join*.spec.ts
implementation_surfaces:
  - app/q/[qrId]/page.tsx
  - app/m/[merchantSlug]/page.tsx
  - app/m/[merchantSlug]/join/page.tsx
  - app/m/[merchantSlug]/join/actions.ts
  - lib/customer/verification.ts
  - lib/customer/email-verification.ts
  - lib/customer/returning-qr-redirect.ts
  - supabase/migrations/20260624140000_security_scan_hardening.sql
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/card-stamp.md
related_tests:
  - tests/db/customer-join.test.mjs
  - tests/micro-specs/customer-home-login.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-customer-join — Venue QR → join (with first stamp) vs returning-customer stamp

## Intent

A customer scans a venue QR sticker and lands on `/q/[qrId]`. A **new** visitor
is taken through a phone-verified join wizard and, on completing it, is enrolled
in the merchant's loyalty card **and given their first stamp in one atomic
operation**, then shown their card. A **returning** customer who scans the same
QR is sent straight to the stamp flow for their existing membership — they never
re-join. No browser storage is authoritative: enrolment, consent, and the first
stamp are all written server-side via a single security-definer RPC.

## Scope (in)

- QR resolve + branch: `/q/[qrId]` → join (new) vs `/card/[membershipId]/stamp`
  (returning), and the merchant card preview at `/m/[merchantSlug]`.
- The three-step join wizard at `/m/[merchantSlug]/join` (phone request → OTP
  verify → terms + opt-in → join) and its server actions
  (`requestCustomerIdentityAction`, `verifyCustomerOtpAction`,
  `joinRewardsAction`).
- The atomic enrolment RPC `join_customer_membership_with_first_stamp`.
- The dev-OTP bypass used by the harness (`CUSTOMER_DEV_OTP_CODE`).

## Scope (out)

- The stamp algorithm itself (one-per-UK-day, geofence) — owned by
  [MS-customer-card-stamp]. This spec only asserts that join *attempts* a first
  stamp atomically and surfaces its outcome flags.
- Reward redemption, wallet login, profile/marketing surfaces — separate specs.
- Real Twilio/Resend OTP delivery — out of scope; the dev-OTP path is the tested
  path. No change to RLS, schema, or the RPC's internals.

## Decisions already made

- Phone OTP is the customer identity gate. In non-production with
  `CUSTOMER_DEV_OTP_CODE` set, that exact code is accepted and Twilio is skipped
  (`lib/customer/verification.ts`); `CUSTOMER_OTP_BYPASS_MODE=any-4-digits` is a
  separate non-production shortcut. Production uses real delivery.
- `join_customer_membership_with_first_stamp` (newest def:
  `20260624140000_security_scan_hardening.sql`) takes `p_customer_id`,
  `p_merchant_slug`, `p_qr_id`, `p_marketing_opt_in`, `p_policy_version`,
  optional `p_latitude`/`p_longitude` and returns `membership_id`,
  `created_membership`, `first_stamp_issued`, `new_stamp_count`,
  `reward_unlocked`, `geo_flagged`. The first stamp is attempted only when a
  membership was newly created AND a non-empty `p_qr_id` was supplied.
- Consent/policy version is server-set (`2026-06-06`), not client-supplied.

## EARS requirements

- **J-1 (QR new visitor):** WHEN a visitor with no membership opens
  `/q/[qrId]` for an active venue QR, THE system SHALL redirect to
  `/m/[merchantSlug]/join` carrying the originating `qr` id.
- **J-2 (QR returning customer):** WHEN a customer who already holds a membership
  for the QR's merchant opens `/q/[qrId]`, THE system SHALL redirect to
  `/card/[membershipId]/stamp` for that membership rather than the join wizard.
- **J-3 (OTP gate):** WHILE the customer has not passed phone OTP verification,
  THE join wizard SHALL NOT enrol them; `joinRewardsAction` SHALL reject an
  unverified caller.
- **J-4 (dev OTP):** WHERE `CUSTOMER_DEV_OTP_CODE` is configured in a
  non-production environment, THE system SHALL accept that exact code as a valid
  OTP without calling the SMS provider.
- **J-5 (terms required):** IF the customer has not accepted terms, THEN
  `joinRewardsAction` SHALL reject the join.
- **J-6 (atomic enrol + first stamp):** WHEN a verified customer completes the
  wizard from a venue QR, THE system SHALL create the membership and issue the
  first stamp in one RPC call, and SHALL record marketing opt-in and the policy
  version.
- **J-7 (idempotent re-join):** IF a verified customer submits the join for a
  merchant they already belong to, THEN THE system SHALL return their existing
  membership without creating a duplicate or issuing an extra first stamp
  (`created_membership = false`).
- **J-8 (outcome surfaced):** WHEN the join completes, THE system SHALL redirect
  to the customer's card reflecting the first-stamp outcome (issued / pending)
  and any geofence flag, without exposing another customer's data.

## Verification method

DB-free harness tier proves the wizard UI/branching is reachable and renders.
Live-Supabase tier proves the invariants: drive the wizard with the dev OTP
against a seeded merchant QR, then assert in Postgres that exactly one
`customer_memberships` row and one `stamp_events` (earned) row were written
atomically (J-6); re-run to assert no duplicate membership/stamp (J-7); submit
without verification/terms to assert rejection (J-3/J-5).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:e2e` ·
`pnpm test:db`.

## Verification log — 2026-06-30

Live-DB tier green via `pnpm test:db`:
`tests/db/customer-join.test.mjs` creates a fresh customer and drives the real
`join_customer_membership_with_first_stamp` RPC inside a rolled-back
transaction, proving **J-6** (a QR join creates exactly one membership AND
issues exactly one earned stamp atomically) and **J-7** (re-joining the same
merchant returns the existing membership id with `created_membership = false`
and no duplicate). The OTP gate (J-3/J-4) is covered by the existing
`tests/micro-specs/customer-home-login.test.mjs`. Verdict: **READY** for
J-6/J-7; J-1/J-2 (QR branching) and J-5/J-8 authored.
