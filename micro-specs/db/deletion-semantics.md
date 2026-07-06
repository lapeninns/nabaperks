---
spec_id: MS-db-deletion-semantics
status: active
risk_class: migrations
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/db/**
  - reports/db-schema-audit-2026-07-06.md
  - supabase/migrations/20260707090000_deletion_semantics_fk_rules.sql
  - tests/db/deletion-semantics.test.mjs
  - tests/micro-specs/db-deletion-semantics.test.mjs
implementation_surfaces:
  - supabase/migrations/20260707090000_deletion_semantics_fk_rules.sql
  - tests/db/deletion-semantics.test.mjs
  - tests/micro-specs/db-deletion-semantics.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/db/customer-erasure.test.mjs
  - tests/db/customer-lifecycle.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - pnpm test:db output proving auth-user deletion is blocked while a customers row exists and consent rows survive customer-row deletion with a nulled customer reference.
  - Migration replay evidence, applying the chain twice on a disposable database with an identical final schema.
approved_exceptions: []
---

# MS-db-deletion-semantics — Deletion semantics: auth-user RESTRICT and consent retention

## 1. Exact Goal and User-Visible Outcomes

Deleting a Supabase auth user can no longer silently destroy a customer's
loyalty history, and consent evidence outlives the customer row. Today
`customers.auth_user_id` is `ON DELETE CASCADE`: one auth-dashboard deletion
cascades through memberships into stamp events, reward events, notifications,
sessions, and consent records — the exact mechanism of the 2026-07-04 prod
bulk-delete incident, and a contradiction of the deliberate erasure design
(`admin_erase_customer_pii` scrubs PII while preserving the anonymized ledger).
When this ships: an auth-user delete for an account that still has a
`customers` row is refused by the database, and deleting a `customers` row
keeps its `consent_records` rows (customer reference nulled) so PECR/UK-GDPR
consent proof is retained — matching how `audit_logs` and `fraud_flags`
already survive deletion.

## 2. Blast Radius

May edit: `supabase/migrations/20260707090000_deletion_semantics_fk_rules.sql`
(new), `tests/db/deletion-semantics.test.mjs` (new),
`tests/micro-specs/db-deletion-semantics.test.mjs` (new), and this spec's
folder. The existing `tests/db/customer-erasure.test.mjs` and
`tests/db/customer-lifecycle.test.mjs` are related reading and must stay green,
but are not expected to change; if their fixtures turn out to assume the old
cascade, amend this spec's radius before editing them.

Out of scope: `merchants.owner_user_id` (already RESTRICT — unchanged); every
other CASCADE chain (`customer_memberships` → event tables stays CASCADE; that
is the deliberate explicit-deletion path); `admin_erase_customer_pii` and all
other RPC bodies; app code, UI, API routes; RLS policies; any data backfill.

## 3. Strict Constraints and Assumptions

- `consent_records.customer_id` must become nullable (`DROP NOT NULL`) for
  `SET NULL` to be legal. Verified readers filter by `customer_id = <id>`
  (`lib/customer/profile.ts` latest-per-channel read, `lib/admin/data.ts`
  consent log), so nulled orphan rows naturally drop out of existing queries.
- Constraint swaps are metadata-only (no table rewrite); the brief
  `ACCESS EXCLUSIVE` lock during `ALTER TABLE` is acceptable at current scale.
- The migration must be idempotent (guarded drop/re-add), matching the repo's
  re-runnable all-pending chain.
- No app code path deletes auth users today; this guards the Supabase
  dashboard, Management API scripts, and future code paths.

## 4. Decisions Already Made

- `customers_auth_user_id_fkey` becomes `ON DELETE RESTRICT` (not SET NULL): a
  customers row without an auth link cannot log in, so allowing the delete
  would only create a dangling account. RESTRICT forces the explicit order:
  erase PII → delete the customers row (cascade is intentional there) → delete
  the auth user.
- `consent_records_customer_id_fkey` becomes `ON DELETE SET NULL`; surviving
  rows keep `merchant_id`, `channel`, `consent_status`, `source`,
  `policy_version`, `created_at`, and `metadata` as compliance evidence.
- `consent_records.merchant_id` stays CASCADE: deleting an entire merchant
  removes their consent ledger (tenant teardown) — existing, accepted
  semantic.
- No new RPCs, no app-code changes, no view changes.

## 5. Behavioral Requirements (EARS)

- IF a Supabase auth user still owns a `public.customers` row, THEN THE
  database SHALL refuse to delete that auth user with a foreign-key violation.
- WHEN a `public.customers` row is deleted, THE database SHALL set
  `consent_records.customer_id` to NULL instead of deleting those rows.
- THE surviving consent rows SHALL retain merchant, channel, status, source,
  policy version, timestamp, and metadata values unchanged.
- WHEN `admin_erase_customer_pii` runs, THE customer's consent_records rows
  SHALL remain present and unmodified by the erasure.
- WHEN a `public.customers` row is deleted, THE database SHALL continue to
  cascade-delete memberships, stamp events, reward events, sessions, push
  subscriptions, and notification rows exactly as before this change.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify (live DB, rolled-back transactions per the
tests/db pattern):

- Deleting an auth user that owns a customers row fails with a foreign-key
  error; after the customers row is removed, the same auth-user delete
  succeeds.
- Deleting a customers row leaves its consent_records rows present with
  `customer_id IS NULL` and all evidence fields intact.
- The erasure RPC still succeeds end-to-end and leaves consent rows intact.
- Membership/event cascade on customer-row deletion is unchanged.
- Applying the migration chain twice yields an identical schema (idempotent).

Task order: (1) write the failing DB suite; (2) write the migration (guarded
constraint swap + `DROP NOT NULL`); (3) green locally against the disposable
DB; (4) `pnpm governance:run-gates --spec MS-db-deletion-semantics --record`
and advance with `governance:advance`.
