---
spec_id: MS-db-dead-field-cleanup
status: active
risk_class: migrations
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/db/**
  - supabase/migrations/20260707091000_dead_field_cleanup.sql
  - supabase/seed.sql
  - tests/db/dead-field-cleanup.test.mjs
  - tests/micro-specs/db-dead-field-cleanup.test.mjs
implementation_surfaces:
  - supabase/migrations/20260707091000_dead_field_cleanup.sql
  - supabase/seed.sql
  - tests/db/dead-field-cleanup.test.mjs
  - tests/micro-specs/db-dead-field-cleanup.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/db/issued-rewards-schema.test.mjs
  - tests/db/architecture-moat.test.mjs
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
  - Schema readback on a fully migrated disposable database showing the dropped columns, dropped duplicate indexes, and dropped record_qr_download function are absent while the keep-list uniques and composite FK targets are intact.
  - Migration replay evidence, applying the chain twice on a disposable database with an identical final schema, plus a green pnpm db:seed run against the migrated schema.
approved_exceptions: []
---

# MS-db-dead-field-cleanup — Drop dead columns and duplicate indexes

## 1. Exact Goal and User-Visible Outcomes

The schema stops carrying removed-feature fields and write-amplifying
duplicate indexes. Per the 2026-07-06 schema audit, all of these are verified
dead (no app read/write, no live DB-function dependency): the
`min_spend_pence` columns on `loyalty_cards`, `reward_pool_items`, and
`reward_events` (the 20260624 remove_minimum_spend migration dropped the RPC
parameters but not the columns); the merchants ROI trio
(`average_order_value_pence`, `estimated_gross_margin_bps`,
`reward_cost_pence` — only ever written as zeros, read by nothing);
`merchant_locations.timezone` (never read; business dates hardcode
Europe/London via `uk_business_date`); seven duplicate indexes on hot write
paths; and the never-called `record_qr_download` function. No user-visible
behavior changes; every stamp write gets marginally cheaper; future audits
stop tripping over dead surface.

## 2. Blast Radius

May edit: `supabase/migrations/20260707091000_dead_field_cleanup.sql` (new),
`supabase/seed.sql` (remove ROI-trio column references at lines ~206-208 and
~244-246), `tests/db/dead-field-cleanup.test.mjs` (new),
`tests/micro-specs/db-dead-field-cleanup.test.mjs` (new), and this spec's
folder. The cited existing schema suites must stay green but are expected to
need no edits; if one asserts a dropped column, amend this spec's radius
before touching it.

Out of scope: `billing_customers.plan` (owner decision 2026-07-06: keep as-is
until a second plan exists); `soft_geofence_trigger_stamp_number` (owned by
MS-merchant-soft-geofence-knob, which makes it a real setting); the staff
subsystem (owned by MS-db-staff-excision); `customers.phone` (owned by
MS-db-phone-plaintext-retirement); all app code; all RLS policies.

## 3. Strict Constraints and Assumptions

- One idempotent migration (guarded `drop column if exists` /
  `drop index if exists` / `drop function if exists`), replayable on a
  database that already ran it.
- `get_reward_scan_context` still returns a `min_spend_pence` column sourced
  from `reward_events.min_spend_pence` (recreated by migration
  20260628122828). App code never reads that field (verified — zero
  references), so the function must be recreated in this migration without
  the column BEFORE the column drop; its other columns and behavior are
  untouched.
- Verify at implementation time (schema grep on a migrated DB) that no other
  live function body references a doomed column; if one is found, stop and
  amend the spec rather than improvising.
- Dropping a column drops its CHECK constraints implicitly; no separate
  constraint handling needed.
- `record_qr_download` may be dropped because MS-analytics-qr-downloaded-wire
  records via `recordProductEvent` instead; there is no call-site in app code
  today, so there is no ordering dependency between the two specs.

## 4. Decisions Already Made

- Columns to drop: `loyalty_cards.min_spend_pence`,
  `reward_pool_items.min_spend_pence`, `reward_events.min_spend_pence`,
  `merchants.average_order_value_pence`,
  `merchants.estimated_gross_margin_bps`, `merchants.reward_cost_pence`,
  `merchant_locations.timezone`.
- Indexes to drop (each fully covered by another index's leading columns):
  `billing_customers_merchant_id_idx`, `customers_auth_user_id_idx`,
  `customer_memberships_merchant_id_idx`,
  `loyalty_cards_merchant_location_idx`,
  `merchant_locations_merchant_id_idx`, `reward_events_membership_id_idx`,
  `stamp_events_membership_id_idx`.
- Keep-list (explicitly NOT touched): every `*_key` unique index, the
  composite `(…, id)` uniques serving as composite-FK targets, and every
  partial index.
- Function to drop: `public.record_qr_download(uuid, uuid, text)`.
- Business-date behavior stays Europe/London via `uk_business_date` — the
  timezone column removal changes nothing behaviorally.
- Historical `reward_events` rows lose their (never-displayed) min-spend
  snapshot value permanently — accepted, since redemption was never gated on
  spend and nothing renders it.

## 5. Behavioral Requirements (EARS)

- THE public schema SHALL NOT contain any of the seven columns listed in the
  decisions section.
- THE public schema SHALL NOT contain any of the seven duplicate indexes
  listed in the decisions section.
- THE public schema SHALL NOT contain the `record_qr_download` function.
- THE `get_reward_scan_context` function SHALL keep its current behavior and
  result shape minus the `min_spend_pence` column.
- THE keep-list uniques, composite-FK-target uniques, and partial indexes
  SHALL remain exactly as they are.
- WHEN `pnpm db:seed` runs against the migrated schema, THE seed SHALL
  complete without referencing dropped columns.
- WHEN the migration chain is applied twice, THE second application SHALL be
  a no-op.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify (live DB):

- information_schema readback: all seven columns absent; pg_indexes readback:
  all seven indexes absent, keep-list present; pg_proc readback:
  record_qr_download absent.
- `get_reward_scan_context` still resolves a valid scan token end-to-end
  (reuse the existing scan-context fixtures) and its result no longer carries
  min_spend_pence.
- Stamp issuance and reward unlock still work (smoke via existing suites —
  proves no hidden dependency was severed).
- `pnpm db:seed` completes green; replay of the chain is idempotent.

Task order: (1) failing DB tests asserting absence + scan-context shape;
(2) migration (recreate `get_reward_scan_context` without the column, then
guarded drops); (3) prune seed.sql ROI references; (4) green + seed run;
(5) `pnpm governance:run-gates --spec MS-db-dead-field-cleanup --record` and
advance with `governance:advance`.
