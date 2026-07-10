---
spec_id: MS-referral-ops-visibility
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260710200000_referral_ops_visibility.sql
  - lib/admin/data.ts
  - app/admin/referrals/**
  - components/layout/console-nav.ts
  - tests/db/referral-ops-visibility.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710200000_referral_ops_visibility.sql
  - lib/admin/data.ts
  - app/admin/referrals/page.tsx
  - app/admin/referrals/referral-ops-panel.tsx
  - components/layout/console-nav.ts
  - tests/db/referral-ops-visibility.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/referral/state-machine.md
  - micro-specs/referral/settlement.md
related_tests:
  - tests/db/referral-ops-visibility.test.mjs
  - tests/e2e/customer-referral-attribution.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "referral attribution" --project=mobile-safari
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Live-DB output proving admin_referral_ops(...) returns the full support view (referrer, referred, attribution/qualification times, status, hold reason, bonus stamp, retry count, fraud-flag count) only to an internal admin, and raises for a non-admin caller.
  - Live-DB output proving merchant_referral_summary(merchant_id) returns aggregate-only counts (attributed / qualified / awarded / held) to the venue owner, carries no customer identifiers, and raises for a non-owner.
  - Playwright (mobile-safari) output proving the customer referral attribution journey still completes (secondary; the admin surface is gated and proven at the DB tier).
approved_exceptions: []
---

# MS-referral-ops-visibility — Support operational view and merchant aggregate summary

## 1. Exact Goal and User-Visible Outcomes

Support and operations gain a **small operational referral view**: for each referral
they can see the referrer, the referred member, when it was attributed and qualified,
its current state, any hold reason and retry count, the awarded bonus stamp, and how
many fraud flags touch it. This detail — which necessarily exposes both customers'
identities — is restricted to **internal admin (support) roles** and is surfaced on a
new `/admin/referrals` console page beside the existing fraud console.

Merchants, by contrast, get **aggregate-only** referral analytics: counts of how many
referrals were attributed, qualified, awarded, and are currently held for their venue,
with **no customer identifiers**. A venue owner can read their own summary and no one
else's.

Nothing about the member-facing referral flow changes; this spec is read-only
reporting on the state the earlier specs already record.

## 2. Blast Radius

In scope (may be edited):

- A new migration `supabase/migrations/20260710200000_referral_ops_visibility.sql`:
  - `admin_referral_ops(p_merchant_id uuid, p_status text, p_limit int, p_offset int)`
    — `SECURITY DEFINER`, guarded by `is_internal_admin()`, returns the joined
    support detail rows (both customers' emails/last4, timings, state, hold, bonus,
    retry count, fraud-flag count) ordered newest first;
  - `merchant_referral_summary(p_merchant_id uuid)` — `SECURITY DEFINER`, guarded by
    `is_merchant_owner(p_merchant_id)`, returns aggregate counts only.
- `lib/admin/data.ts` — a `getAdminReferralOps()` loader over the gated admin
  service-role client.
- `app/admin/referrals/page.tsx` + `referral-ops-panel.tsx` — the console page +
  table, mirroring the fraud console.
- `tests/db/referral-ops-visibility.test.mjs`.

Out of scope (explicitly not touched):

- Any change to how referrals are created, qualified, settled, or notified.
- Merchant dashboard surfacing of the summary — the aggregate RPC is provided and
  DB-proven; wiring it into the merchant analytics page is deferred.
- The existing `referrals` RLS SELECT policy (admin can already read all rows); this
  spec adds RPCs, it does not widen row access.
- Code rotation and fraud monitoring — later specs.

## 3. Strict Constraints and Assumptions

- **Support detail is admin-only.** `admin_referral_ops` raises
  `insufficient_privilege` unless `is_internal_admin()` (which already requires an
  active `internal_admins` row + AAL2). It follows the established guarded-RPC shape
  (`admin_resolve_fraud_flag`).
- **Merchant summary is owner-scoped and PII-free.** `merchant_referral_summary`
  raises unless `is_merchant_owner(p_merchant_id)` and returns only integer counts —
  never a customer id, email, phone, or membership id.
- **Read-only.** Both functions only `select`; neither writes the ledger, so there is
  no new audit surface and no lifecycle effect.
- **Reuses existing gating for the page.** The console page uses
  `canRenderAdminPage()` + `createAdminServiceRoleClient()` exactly like
  `/admin/fraud`, so admin auth/MFA is enforced app-side as defence-in-depth on top
  of the RPC guard.
- **No new PII at rest.** The view composes already-stored fields; last4/email are
  shown to support as the fraud console already does.

## 4. Decisions Already Made

- **Two functions, two audiences.** Support gets identified detail; merchants get
  anonymous aggregates. They are separate RPCs with separate guards so the aggregate
  can never leak identity.
- **`attributed_at` = `referrals.created_at`.** No separate attribution timestamp is
  added; creation time is the attribution time.
- **Fraud-flag count, not detail.** The ops row shows how many fraud flags reference
  the referrer membership; resolving them stays in the existing fraud console.
- **New console page**, not a bolt-on to the fraud page, so the two stay independently
  navigable.

## 5. Behavioral Requirements (EARS)

- **OV-1 (admin detail):** WHEN an internal admin calls `admin_referral_ops`, THE
  system SHALL return each referral's referrer, referred member, attributed and
  qualified times, status, hold reason, retry count, bonus stamp, and fraud-flag
  count, newest first.
- **OV-2 (admin-only):** IF a non-admin calls `admin_referral_ops`, THEN THE system
  SHALL raise `insufficient_privilege` and return no rows.
- **OV-3 (status filter):** WHERE a status is supplied, THE `admin_referral_ops`
  result SHALL be limited to referrals in that status.
- **OV-4 (merchant aggregate):** WHEN a venue owner calls
  `merchant_referral_summary` for their venue, THE system SHALL return counts of
  attributed, qualified, awarded, and held referrals for that venue.
- **OV-5 (aggregate is PII-free):** THE `merchant_referral_summary` result SHALL
  contain only counts and SHALL NOT contain any customer identifier.
- **OV-6 (owner-only):** IF a caller who does not own the venue calls
  `merchant_referral_summary`, THEN THE system SHALL raise `insufficient_privilege`.
- **OV-7 (read-only):** THE ops functions SHALL NOT modify any referral, stamp,
  reward, or notification.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify (DB tier is primary; live Postgres, rolled-back
transactions with a seeded internal-admin/service-role context):

- With an internal-admin context, `admin_referral_ops` returns a seeded referral's
  full detail (both customers, times, status, hold, bonus, retry count, fraud-flag
  count); with a non-admin context it raises (OV-1/OV-2), and a status filter narrows
  the result (OV-3).
- `merchant_referral_summary` for the owner returns correct counts across attributed
  / qualified / awarded / held and exposes no customer id; a non-owner call raises
  (OV-4/OV-5/OV-6).
- Neither call changes any row (OV-7).

Browser tier (mobile-safari, secondary): the customer attribution journey still
completes (`tests/e2e/customer-referral-attribution.spec.ts`); the admin page is
gated and proven at the DB tier.

Source scan (`pnpm test`): the console page gates on `canRenderAdminPage`; the loader
uses the admin service-role client; the aggregate exposes no identifier.

Task breakdown (test-first per `Instructions_tdd.md`):

1. Migration: `admin_referral_ops` (is_internal_admin guard) + `merchant_referral_summary`
   (is_merchant_owner guard, counts only).
2. DB tests red → green across OV-1…OV-7.
3. `getAdminReferralOps` loader; `/admin/referrals` page + panel.

Prove the work with `governance:run-gates --spec MS-referral-ops-visibility --record`
and advance the lifecycle with `governance:advance`.
