---
spec_id: MS-merchant-onboarding-continuity
status: active
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-09
allowed_blast_radius:
  - micro-specs/merchant/onboarding-continuity.md
  - micro-specs/evidence/MS-merchant-onboarding-continuity.json
  - app/app/onboarding/actions.ts
  - components/merchant/onboarding-form.tsx
  - components/merchant/onboarding-form-fields.tsx
  - components/merchant/venue-address-fields.tsx
  - lib/merchant/venue-location-submission.ts
  - lib/merchant/onboarding.ts
  - package.json
  - supabase/migrations/20260710100000_atomic_merchant_onboarding.sql
  - tests/db/merchant-onboarding-transaction.test.mjs
  - tests/micro-specs/merchant-onboarding-continuity.test.mjs
  - tests/micro-specs/merchant-onboarding-completion.test.mjs
  - tests/micro-specs/architecture-audit-hardening.test.mjs
  - tests/e2e/merchant-onboarding-continuity.spec.ts
  - tests/e2e/merchant-onboarding-continuity.desktop.spec.ts
  - tests/e2e/merchant-onboarding-continuity-flow.ts
  - tests/e2e/helpers/merchant-onboarding-live-db.ts
implementation_surfaces:
  - micro-specs/merchant/onboarding-continuity.md
  - micro-specs/evidence/MS-merchant-onboarding-continuity.json
  - app/app/onboarding/actions.ts
  - components/merchant/onboarding-form.tsx
  - components/merchant/onboarding-form-fields.tsx
  - components/merchant/venue-address-fields.tsx
  - lib/merchant/venue-location-submission.ts
  - lib/merchant/onboarding.ts
  - package.json
  - supabase/migrations/20260710100000_atomic_merchant_onboarding.sql
  - tests/db/merchant-onboarding-transaction.test.mjs
  - tests/micro-specs/merchant-onboarding-continuity.test.mjs
  - tests/micro-specs/merchant-onboarding-completion.test.mjs
  - tests/micro-specs/architecture-audit-hardening.test.mjs
  - tests/e2e/merchant-onboarding-continuity.spec.ts
  - tests/e2e/merchant-onboarding-continuity.desktop.spec.ts
  - tests/e2e/merchant-onboarding-continuity-flow.ts
  - tests/e2e/helpers/merchant-onboarding-live-db.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/onboarding.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
related_tests:
  - tests/db/merchant-onboarding-transaction.test.mjs
  - tests/micro-specs/merchant-onboarding-continuity.test.mjs
  - tests/micro-specs/merchant-onboarding-completion.test.mjs
  - tests/micro-specs/architecture-audit-hardening.test.mjs
  - tests/e2e/merchant-onboarding-continuity.spec.ts
  - tests/e2e/merchant-onboarding-continuity.desktop.spec.ts
  - tests/e2e/merchant-onboarding-continuity-flow.ts
  - tests/e2e/helpers/a11y-sweep.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-merchant-onboarding-continuity"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - manual:local-supabase-onboarding-transaction-proof
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Local PostgreSQL proof that a failed onboarding statement leaves no partial merchant, venue, product-event, or audit rows.
  - Local PostgreSQL proof that fresh, legacy-first, repeated, and concurrent submissions produce one merchant, one primary venue, and one onboarding event/audit pair; complete rows are not overwritten.
  - Local RLS and ACL proof that anonymous and cross-owner calls fail while the authenticated owner can complete onboarding.
  - Mobile and desktop browser proof that validation and database failures retain safe form context, announce errors, and allow a successful retry into the Card step.
  - Readback and cleanup proof for every disposable auth user, merchant, venue, product event, and audit row created by the harness.
approved_exceptions: []
---

# MS-merchant-onboarding-continuity — Atomic and recoverable merchant onboarding

## 1. Exact Goal and User-Visible Outcomes

A newly verified merchant can enter business and venue details once, correct
mistakes immediately, and retry a temporary save failure without losing their
work. A successful submit persists the merchant, the complete primary venue,
and the onboarding ledger rows as one database outcome before continuing to
`/app/launch?tab=card`; a failed outcome leaves no half-created account that can
misroute the merchant or hide their draft.

## 2. Blast Radius

May edit only the onboarding action and form, its field-error presentation and
draft merge, the venue-resolution boundary needed to resolve address data before
persistence, the onboarding status readback, one additive migration, and the
focused source-contract, local-DB, browser, and accessibility proof listed in
frontmatter.

Out of scope: merchant auth and OTP, launch Card/Rewards/QR/Billing behavior,
multi-location onboarding, public venue slugs after launch, hosted Supabase,
production data repair, Google Places UI redesign, geofence policy changes,
analytics taxonomy changes, and reward creation. The legacy
`create_merchant_onboarding` signature remains as a lock-sharing deployment
compatibility adapter, but the application SHALL stop calling it, its PUBLIC
execute grant SHALL be removed, and the app SHALL never treat its
address-incomplete location as completed onboarding.

## 3. Strict Constraints and Assumptions

- Server and PostgreSQL state remain authoritative. The user-scoped browser
  draft is a cache only; non-empty server fields win when server and draft
  values are merged.
- Address/provider resolution and all application validation complete before
  the first database mutation. External geocoding failure cannot create a
  merchant or location.
- The new onboarding RPC is one PostgreSQL statement and one transaction. No
  application-side follow-up update may be required to make the venue complete.
- The `SECURITY DEFINER` function uses a fixed `search_path`, derives its owner
  only from `auth.uid()`, rejects a missing identity, and exposes no
  cross-tenant identifier or raw database error to the browser.
- Same-owner concurrent calls are serialized inside PostgreSQL. Do not rely on
  browser disabling, a read-then-insert race, or application memory for
  idempotency.
- Retry updates an existing _incomplete_ merchant and its primary location in
  place. Once the canonical location is complete, later stale onboarding
  submissions cannot overwrite it (first complete write wins). The RPC still
  conflict-safely reconciles either missing durable onboarding ledger row on a
  historical complete record. It preserves the existing business slug and
  never creates a second merchant, primary location, `merchant_signed_up`
  event, or `merchant_onboarded` audit row.
- PostHog remains best-effort and runs only after the authoritative RPC succeeds.
  Supabase `product_events` and `audit_logs` are the durable ledger.
- Tests and helpers are local-only, use disposable identities, run schema-level
  fault controls with one Playwright worker, scope any failure trigger to the
  fixture owner, remove it in `finally`, and never write to a linked or hosted
  database.
- The DB integration gate runs test files sequentially. Several suites replay
  migrations or install short-lived schema fault controls; parallel files can
  deadlock on PostgreSQL DDL locks and produce false-red evidence even when the
  product transaction is correct.
- One merchant per auth owner is the current product invariant. Multi-business
  ownership is not introduced by this audit-remediation program.

## 4. Decisions Already Made

- Add a uniquely named, typed `complete_merchant_onboarding` RPC rather than
  extending the legacy RPC with an application-side venue update. Its caller
  supplies only business name/type/phone, location name, structured address,
  address source/provider identity, resolved coordinates, geofence radius and
  requirement, soft-geofence trigger, and pin source.
- Derive owner, canonical auth email, stable slug, display address, `GB`
  country, primary status, and both persistence timestamps inside PostgreSQL.
  The first slug candidate uses the readable eight-character owner suffix; a
  collision deterministically falls back to the full owner UUID.
- Validate bounded names, the current business-type allowlist, canonical UK
  postcode, provider/source coherence, finite coordinate ranges, radius
  25-1000, trigger stamp 1-99, and pin-source allowlist inside the RPC as
  defence in depth. PostgreSQL constraints remain the final validation layer.
- Take a transaction-scoped advisory lock derived from `auth.uid()` before
  reading or inserting merchant state.
- Add durable unique invariants for one merchant per owner and one onboarding
  product/audit ledger row per merchant. The migration locks and preflights
  existing rows and fails explicitly on duplicates; it never guesses which
  production row to delete or merge. Replay validation requires each index to
  be ready, valid, unique, on the exact key, and on the exact intended partial
  predicate rather than trusting a same-named relation.
- On a new owner, insert the merchant, complete primary venue, product event,
  and audit row in the same function. On retry, complete only an incomplete
  record; a complete record returns its stable identifiers unchanged.
- Rewrite the legacy seven-argument RPC as a compatibility adapter that takes
  the same owner lock and respects the new unique invariants. Revoke all PUBLIC
  access and grant only `authenticated` and `service_role` on both signatures.
- Return `(merchant_id, location_id, completed_now)` from the new RPC. The
  action emits PostHog only when `completed_now=true`; SQL inserts use the
  one-time indexes so legacy-first repair cannot duplicate durable ledger rows.
- Keep a stable house-authored form error for database failures and preserve all
  safe submitted fields. Never return SQL, provider, or service-role details.
- Restore cached draft fields that are absent from a partial server record while
  keeping every non-empty server value authoritative.
- Field errors use an assertive live semantic and the first invalid field is
  focused on every failed client or server validation attempt.

## 5. Behavioral Requirements (EARS)

- **OC-1 (pre-resolution):** WHEN a merchant submits onboarding, THE action
  SHALL validate and resolve the complete venue payload before invoking any
  database mutation.
- **OC-2 (atomic success):** WHEN a fresh owner submits a valid payload, THE RPC
  SHALL atomically create one trial merchant, one complete primary venue, one
  `merchant_signed_up` product event, and one `merchant_onboarded` audit row.
- **OC-3 (atomic failure):** IF any merchant, venue, event, or audit write fails,
  THEN THE statement SHALL roll back all writes from that onboarding attempt.
- **OC-4 (idempotent retry):** WHEN an owner with partial onboarding retries,
  THE RPC SHALL update the same merchant and earliest primary venue to the
  complete submitted state without duplicating merchant, venue, event, or audit
  rows.
- **OC-4a (first complete wins):** IF onboarding is already complete, THEN a
  later onboarding submission SHALL return the stable identifiers without
  overwriting the complete merchant or venue, while conflict-safely restoring
  a missing durable onboarding event or audit row on historical state.
- **OC-5 (concurrency):** WHEN two valid onboarding calls for the same owner
  overlap, THE database SHALL serialize them behind a durable unique owner
  invariant and return the same merchant and location identifiers with one
  durable onboarding ledger pair.
- **OC-6 (authorization):** IF `auth.uid()` is absent, THEN the new RPC SHALL
  fail before reading or writing tenant state; no caller-controlled owner,
  merchant, location, email, slug, primary flag, country, display address, or
  persistence timestamp SHALL cross its interface. Authenticated outsiders
  SHALL neither read nor mutate the owner's merchant, venue, product-event,
  or audit state through the underlying RLS tables.
- **OC-7 (completion):** WHILE a location lacks its required canonical address
  fields or required coordinates, THE onboarding status SHALL remain
  `missing_location`; only complete state may continue to the launch hub.
- **OC-8 (recoverable error):** IF resolution or persistence fails, THEN THE
  form SHALL retain safe business/venue fields, announce house-authored recovery
  guidance, focus the relevant error, and permit a successful retry.
- **OC-9 (draft continuity):** WHEN partial server state and a user-scoped local
  draft both exist, THE form SHALL merge them field by field with non-empty
  server values authoritative and draft values filling only missing fields.
- **OC-10 (inline validation):** WHEN required fields are missing in the
  browser, THE form SHALL show associated live errors and focus the first
  invalid control without spending a server or database request.
- **OC-11 (safe continuation):** WHEN the RPC returns valid merchant and
  location identifiers, THE action SHALL revalidate merchant caches, emit
  best-effort external analytics only for `completed_now`, and continue exactly to
  `/app/launch?tab=card`.
- **OC-12 (legacy boundary):** THE application SHALL contain no call to the
  legacy create-then-update onboarding path after this change; the compatibility
  signature SHALL share the owner lock and SHALL not be executable by PUBLIC or
  `anon`.

## 6. Verification Criteria and Task Breakdown

1. Lock the source contract first: the action resolves before persistence,
   calls only the atomic RPC, returns sanitized errors, and redirects only after
   valid IDs; onboarding completeness still requires canonical venue state.
2. Add a replay-safe tail migration defining the derived-identity typed definer
   RPC, explicit ACLs, duplicate preflights, durable unique owner/ledger indexes,
   database validation, owner lock, slug fallback, first-complete-wins branches,
   and the lock-sharing legacy adapter without altering launch or reward rules.
3. Prove the database directly with disposable auth users: constraint-induced
   rollback at the final audit insert, valid create with every resolved venue
   column, partial completion, complete-row no-overwrite plus missing-ledger
   repair, owner-visible and outsider-hidden RLS rows/mutations, new/new and
   legacy/new concurrency, anonymous and legacy mismatched-owner denial, exact
   ACLs, fixed search paths, FORCE RLS, exact valid/ready unique indexes,
   malformed same-name index rejection, slug-collision fallback, migration
   replay, and zero-row cleanup readback.
4. Refactor venue resolution so onboarding obtains a merchant-independent
   canonical persistence payload before the RPC while the launch venue editor
   retains its existing authenticated/RLS write contract.
5. Merge server and local draft data field by field, make repeat validation
   errors announce, preserve pending/focus behavior, and retain all safe fields
   after a server failure.
6. Prove mobile 375x812 and desktop 1280x800 behavior. A local authenticated
   merchant must hit a fixture-scoped database trigger failure without losing
   input, retry after the trigger is removed, reach the Card step, and receive
   exact database readback; the trigger cleanup runs in `finally` and the live
   suite requires one worker.
7. Run every declared gate fresh, record the separate local transaction
   attestation honestly, and re-prove `MS-merchant-onboarding` because this spec
   intentionally changes its action/readback surfaces.
