---
spec_id: MS-db-phone-plaintext-retirement
status: active
risk_class: customer-pii
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/db/**
  - supabase/migrations/20260707095000_phone_plaintext_retirement.sql
  - supabase/migrations/20260613210000_customer_phone_identity.sql
  - supabase/migrations/20260630128000_mask_customer_contact_backstop.sql
  - supabase/seed-activity-demo.sql
  - lib/customer/**
  - lib/admin/**
  - app/admin/**
  - components/admin/support.tsx
  - app/home/**
  - tests/db/phone-plaintext-retirement.test.mjs
  - tests/db/customer-profile.test.mjs
  - tests/db/customer-erasure.test.mjs
  - tests/micro-specs/admin-member-lookup.test.mjs
  - tests/db/tenant-rls.test.mjs
  - tests/unit/admin-lookup-query.test.mjs
  - tests/micro-specs/db-phone-plaintext-retirement.test.mjs
implementation_surfaces:
  - supabase/migrations/20260707095000_phone_plaintext_retirement.sql
  - supabase/migrations/20260613210000_customer_phone_identity.sql
  - supabase/migrations/20260630128000_mask_customer_contact_backstop.sql
  - supabase/seed-activity-demo.sql
  - lib/customer/**
  - lib/admin/**
  - app/admin/**
  - components/admin/support.tsx
  - app/home/**
  - tests/db/phone-plaintext-retirement.test.mjs
  - tests/db/customer-profile.test.mjs
  - tests/db/customer-erasure.test.mjs
  - tests/micro-specs/admin-member-lookup.test.mjs
  - tests/db/tenant-rls.test.mjs
  - tests/unit/admin-lookup-query.test.mjs
  - tests/micro-specs/db-phone-plaintext-retirement.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/db/customer-profile.test.mjs
  - tests/db/customer-erasure.test.mjs
  - tests/micro-specs/admin-member-lookup.test.mjs
  - tests/db/tenant-rls.test.mjs
  - tests/unit/admin-lookup-query.test.mjs
  - tests/e2e/customer-login.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@governance"
  - pnpm test:db
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Schema readback on a migrated disposable database showing customers.phone absent, the masked view and contact trigger free of plaintext-phone references, and the contact-present CHECK covering email/phone_hmac/phone_last4.
  - pnpm test:db output proving a legacy plaintext-only customer keeps a working masked identity (last4 backfilled) through the migration.
  - Grep evidence that no app code selects or writes customers.phone after the change.
approved_exceptions: []
---

# MS-db-phone-plaintext-retirement — Retire plaintext customer phone column

## 1. Exact Goal and User-Visible Outcomes

Plaintext customer phone numbers stop existing at rest. Today
`customers.phone` is legacy-only (new signups write NULL; the encrypted set
`phone_hmac`/`phone_ciphertext`/`phone_last4`/`phone_country` is the live
identity), but the plaintext column still exists, still counts as "contact
present", is still served as a fallback by the masked view, and is still
returned raw by `get_reward_scan_context` and selected by admin lookups. When
this ships: legacy rows keep a working masked identity (their last4 is
backfilled from the plaintext before the drop), every surface that showed a
masked phone still does, admins still disambiguate customers by masked
contact, and the `customers.phone` column is gone — along with every DB
function and view reference to it. Customers and merchants notice nothing.

## 2. Blast Radius

May edit: `supabase/migrations/20260707095000_phone_plaintext_retirement.sql`
(new); `lib/customer/**` (`identity.ts` CUSTOMER_COLUMNS selects `phone`;
`profile.ts` serves `profile.phone`); `lib/admin/**` (`data.ts` selects
customer phone for admin lookups); `app/admin/**` (panels render
`customer.email ?? customer.phone` masked fallbacks); `app/home/**` (the
authed profile page renders `profile.phone`); the named test files; and this
spec's folder.

Out of scope: the encrypted phone set and its write paths (unchanged);
`merchants.phone` (business contact, unrelated); OTP/verification flows;
consent channel vocabulary; RLS policies; `.env.example`.

## 3. Strict Constraints and Assumptions

- DB objects that reference `customers.phone` and must be recreated in the
  SAME migration, before the column drop: the `customers_masked` view (drops
  its plaintext-phone LATERAL fallback), the
  `prevent_verified_customer_contact_change` trigger function (drops its
  `phone` clause, keeps hmac/ciphertext/last4/country protections), the
  `customers_contact_present` CHECK, `admin_erase_customer_pii`,
  `admin_export_customer_data`, `admin_purge_stale_customer_pii`,
  `join_customer_membership` (email-vs-phone consent channel decision must
  key on `phone_hmac IS NOT NULL` instead), and `get_reward_scan_context`
  (returns a raw `customer_phone` column today — replace with a
  last4-derived masked value or drop the field; verify its consumer in
  `lib/merchant/reward-collection.ts` first and amend this spec if the field
  is actually rendered raw anywhere).
- Backfill BEFORE drop: `phone_last4 = right(regexp digits of phone, 4)`
  where `phone IS NOT NULL AND phone_last4 IS NULL`.
- The HMAC key lives app-side only, so the migration CANNOT compute
  `phone_hmac` for legacy rows. Therefore the new contact-present CHECK is
  `email IS NOT NULL OR phone_hmac IS NOT NULL OR phone_last4 IS NOT NULL` —
  otherwise legacy phone-only rows would violate it at drop time.
- App reads switch to `phone_last4`-derived display everywhere the plaintext
  was shown or fallen back to; no surface may gain access to a full number.
- Migration is idempotent; the backfill is a no-op on re-run.
- This spec runs LAST in the program (owner decision): it is the only one
  with a prod-data-dependent step.

## 4. Decisions Already Made

- Retire, don't re-encrypt: the plaintext column is dropped, not migrated
  into ciphertext (legacy rows never verified through the new pipeline; the
  product only needs last4 for display and hmac for identity matching, and
  hmac cannot be derived in-DB).
- `phone_verified_at` stays (it guards the encrypted set via the trigger).
- Legacy phone-only customers who lack `phone_hmac` can no longer be matched
  by phone lookup (they never could through the live path — `findCustomerBy
  VerifiedPhone` keys on hmac); accepted.
- `CurrentCustomer.phone` (plaintext passthrough in `lib/customer/identity.ts`)
  is removed from the type; consumers move to the last4/country fields that
  already exist on the type.
- Admin panels keep their masked-contact affordance, now sourced from email
  or last4 (`maskAdminContact` keeps working; it already masks).

## 5. Behavioral Requirements (EARS)

- THE `public.customers` table SHALL NOT contain a `phone` column, and no
  database function, view, trigger, or CHECK SHALL reference it.
- WHEN the migration runs on a database containing legacy rows with plaintext
  phone and NULL `phone_last4`, THE migration SHALL backfill `phone_last4`
  from the plaintext digits before dropping the column.
- THE `customers_masked` view SHALL keep serving "Phone ending NNNN" for
  every customer that has `phone_last4`, including backfilled legacy rows.
- THE contact-present CHECK SHALL accept rows with any of email, phone_hmac,
  or phone_last4, and SHALL reject rows with none of them.
- WHILE a customer's phone identity is verified, THE trigger SHALL continue
  to reject changes to the encrypted phone set exactly as today.
- WHEN `join_customer_membership` records a consent row for a phone-identity
  customer, THE channel decision SHALL behave as it does today (keyed on
  phone presence via `phone_hmac` instead of plaintext).
- THE admin customer lookup and panels SHALL show masked contact without any
  plaintext phone source.
- IF any app code selects or writes `customers.phone` after this change,
  THEN THE build/tests SHALL fail (no dangling references).

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify (live DB):

- Fixture: legacy customer with plaintext phone only (no hmac, no last4) —
  post-migration it has last4 backfilled, passes the new CHECK, and the
  masked view serves its "Phone ending" string.
- Fixture: phone-identity customer (hmac set) — verified-contact trigger
  still rejects encrypted-set changes; erase RPC still scrubs and passes.
- `get_reward_scan_context` end-to-end returns no raw phone.
- Join flow with a phone-identity customer records the same consent channel
  as today.
- Schema readback: no object references `customers.phone`; grep of app code
  finds no `customers.phone` selects/writes.
- Migration replay is idempotent.

Task order: (1) failing DB tests (backfill, CHECK, view, trigger, scan
context); (2) the single ordered migration (backfill → recreate view/trigger/
functions/CHECK → drop column); (3) app-side reads to last4 (identity,
profile, admin data + panels); (4) green everywhere;
(5) `pnpm governance:run-gates --spec MS-db-phone-plaintext-retirement
--record` and advance with `governance:advance`.
