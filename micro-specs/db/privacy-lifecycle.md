---
spec_id: MS-db-privacy-lifecycle
status: active
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/db/privacy-lifecycle.md
  - micro-specs/evidence/MS-db-privacy-lifecycle.json
  - supabase/migrations/20260711093000_erasure_revoke_sessions_push_notifications.sql
  - supabase/migrations/20260711094000_admin_unaffiliated_customer_lookup.sql
  - app/admin/actions.ts
  - app/admin/privacy/page.tsx
  - app/admin/privacy/unaffiliated-customers-panel.tsx
  - lib/admin/action-state.ts
  - lib/admin/data-export.ts
  - lib/admin/data.ts
  - lib/admin/lookup-query.ts
  - components/admin/action-form.tsx
  - tests/db/customer-erasure-related-records.test.mjs
  - tests/db/admin-unaffiliated-customer-lookup.test.mjs
  - tests/unit/admin-data-export.test.mjs
  - tests/unit/admin-lookup-query.test.mjs
  - tests/e2e/admin-privacy-export.spec.ts
implementation_surfaces:
  - supabase/migrations/20260711093000_erasure_revoke_sessions_push_notifications.sql
  - supabase/migrations/20260711094000_admin_unaffiliated_customer_lookup.sql
  - app/admin/actions.ts
  - app/admin/privacy/page.tsx
  - app/admin/privacy/unaffiliated-customers-panel.tsx
  - lib/admin/action-state.ts
  - lib/admin/data-export.ts
  - lib/admin/data.ts
  - lib/admin/lookup-query.ts
  - components/admin/action-form.tsx
  - tests/db/customer-erasure-related-records.test.mjs
  - tests/db/admin-unaffiliated-customer-lookup.test.mjs
  - tests/unit/admin-data-export.test.mjs
  - tests/unit/admin-lookup-query.test.mjs
  - tests/e2e/admin-privacy-export.spec.ts
related_docs:
  - AGENTS.md
  - micro-specs/README.md
  - micro-specs/db/emergency-containment.md
related_tests:
  - tests/db/customer-erasure-related-records.test.mjs
  - tests/db/admin-unaffiliated-customer-lookup.test.mjs
  - tests/unit/admin-data-export.test.mjs
  - tests/unit/admin-lookup-query.test.mjs
  - tests/e2e/admin-privacy-export.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=mobile-safari --grep "@MS-db-privacy-lifecycle"
required_playwright_projects: [mobile-safari]
evidence_required:
  - Command output for the declared verification gates.
  - test:db behavioural proof that admin_erase_customer_pii and admin_purge_stale_customer_pii revoke customer_sessions, disable push_subscriptions, and cancel queued/delivering notification_events while retaining terminal notifications and the loyalty ledger.
  - test:db proof that admin_purge_stale_customer_pii still self-guards on is_service_role_request() and stays non-executable by anon/authenticated after the redefinition.
  - Evidence that the subject-access export reaches the admin as a downloadable JSON payload and exposes no personal data beyond what admin_export_customer_data returns.
  - test:e2e (ADMIN_LIVE_DB_E2E=1, local Supabase) journey proof that an admin export request renders a download control for the customer-data export.
  - Fresh-database replay/idempotency proof that migrations 20260711093000 and 20260711094000 apply cleanly on a reset database and on a second re-apply.
approved_exceptions: []
---

# MS-db-privacy-lifecycle — Privacy lifecycle: subject-access export delivery, complete erasure, unaffiliated-customer lookup

## 1. Exact Goal and User-Visible Outcomes

Wave-3 follow-on to `MS-db-emergency-containment`. The 2026-07-10 database
audit found the customer privacy lifecycle incomplete in three ways. When this
ships:

- **A GDPR subject-access export actually produces the customer's data.** When
  an internal admin submits an `export` data request in the privacy console,
  the console returns a downloadable JSON file containing that customer's
  exported data. Today the export RPC returns the payload but the server action
  discards it and reports a generic "logged" success, so the admin gets
  nothing to hand to the data subject.
- **Erasure fully de-activates the customer, not just their profile row.** When
  an admin erases a customer (`admin_erase_customer_pii`) or the retention job
  purges a stale customer (`admin_purge_stale_customer_pii`), that customer's
  active `customer_sessions` are revoked, their `push_subscriptions` are
  disabled, and their still-pending (`queued` / `delivering`)
  `notification_events` are cancelled — so no session keeps working and no
  further notification fires at an erased person. The loyalty ledger and the
  already-terminal notification history are retained exactly as before
  (anonymise-not-delete is unchanged).
- **Admins can find verified customers who never joined a venue.** The privacy
  console lists verified customers with no membership so they can be discovered
  and serviced. The admin contact search stops erroring on the dropped
  `customers.phone` column.

The destructive-RPC self-guard added in `20260711090000`
(`admin_purge_stale_customer_pii` requires `service_role`) is preserved
verbatim; this spec only extends behaviour, never relaxes containment.

## 2. Blast Radius

In scope — two new forward-only migrations, the admin export/erasure app
surfaces, the unaffiliated lookup, and their tests, all listed in the
frontmatter:

- `supabase/migrations/20260711093000_erasure_revoke_sessions_push_notifications.sql`
  — `CREATE OR REPLACE` of `admin_erase_customer_pii` and
  `admin_purge_stale_customer_pii` adding session revocation, push
  disablement, and queued-notification cancellation.
- `supabase/migrations/20260711094000_admin_unaffiliated_customer_lookup.sql`
  — a service-role-only `customers_unaffiliated` view.
- `app/admin/actions.ts` — `logDataRequestAction` threads the export payload
  into a download descriptor.
- `lib/admin/action-state.ts` — the success state gains an optional download
  descriptor. `lib/admin/data-export.ts` (new) — pure filename / serialisation
  / type-guard helpers.
- `components/admin/action-form.tsx` — renders the download control when the
  state carries a download descriptor.
- `lib/admin/data.ts` — `getAdminUnaffiliatedCustomers`. `lib/admin/lookup-query.ts`
  — contact filter fixed to `phone_last4`.
- `app/admin/privacy/page.tsx` + `app/admin/privacy/unaffiliated-customers-panel.tsx`
  (new) — surface the unaffiliated list.
- `tests/db/*`, `tests/unit/*`, `tests/e2e/admin-privacy-export.spec.ts`.

Explicitly out of scope: editing any already-applied migration (append-only —
both repairs are new dated migrations); the export/erasure RPC bodies' existing
anonymisation, invite-scrub, audit-log, and return-payload logic (extended,
not rewritten); a customer-initiated erasure or export entry point (there is
none — erasure/export stay admin-executed on request); the notification
durability wave (the `p_response_metadata`/`p_metadata` delivery bug, claim
lease/expiry, duplicate enqueue) which is its own later Micro-Spec; the
existing `tests/db/customer-erasure.test.mjs` and `tests/db/admin-support-actions.test.mjs`
(they keep passing unchanged and are not edited).

## 3. Strict Constraints and Assumptions

- **Forward-only and idempotent.** No applied migration is edited. Both new
  migrations are `CREATE OR REPLACE` (function, view) and re-runnable: a fresh
  `supabase db reset` replay and a second re-apply both converge with no error.
- **Containment is preserved, never relaxed.** The redefined
  `admin_purge_stale_customer_pii` keeps its `is_service_role_request()`
  self-guard and stays non-executable by `anon` / `authenticated`;
  `admin_erase_customer_pii` keeps its `is_internal_admin()` + AAL2 gate. Both
  ACLs are re-asserted (`revoke ... from public, anon, authenticated`) belt-and-
  braces after redefinition, matching `20260711090000`.
- **Erasure is additive.** The three revocations are added to the existing
  bodies; the customer anonymisation, `pending_reward_invites` scrub, audit
  log, and JSON return value are byte-for-byte the current behaviour. Erasure
  RETAINS terminal notification history and the loyalty ledger.
- **Not-yet-terminal only.** Notification cancellation targets `status in
  ('queued','delivering')` and moves them to `cancelled` (with `cancelled_at`).
  Terminal rows (`sent`, `failed`, `cancelled`, `expired`) are untouched.
- **Export payload is delivered, not persisted.** The download is built client-
  side from the RPC's returned JSON (a `data:` URL on an anchor). The export
  contains exactly the fields `admin_export_customer_data` returns and no
  additional personal data; nothing new is logged or stored.
- **Unaffiliated lookup reads through a service-role view.** PostgREST cannot
  express "parent with no child rows" cleanly, so the anti-join lives in a
  `security_barrier` view granted to `service_role` only (admin reads already
  use the service-role client). The view excludes erased surrogates.
- **`test:db` is the primary proof; `test:e2e` is the secondary journey.** DB
  behavioural tests assert the erasure side-effects, the retained ledger, the
  preserved self-guard, and the view semantics against a live local database
  via the `tests/db/helpers` harness. The Playwright `@admin-live-db` tier
  proves the export-download journey when `ADMIN_LIVE_DB_E2E=1`.
- Assumption: the emergency-containment migrations (`20260711090000`–`092000`)
  are present on this branch and applied to the rehearsal database; the current
  erasure/export bodies are those in `20260707095000` (erase/export/purge) as
  re-guarded by `20260711090000` (purge). The implementer re-confirms both
  before redefining.

## 4. Decisions Already Made

- One `rls-rpc-ledger` spec, not `customer-pii`: the erasure fix needs a
  `supabase/migrations/**` surface, which the risk-radius hints force onto
  `migrations` / `rls-rpc-ledger`. `rls-rpc-ledger` is chosen over `migrations`
  because the primary invariants are RPC + ledger + audit behaviour and its
  floor pairs `test:db` (primary) with `test:e2e` (the admin export journey).
  The `customer-pii` "no unnecessary personal data exposed" obligation is kept
  as an explicit `evidence_required` item.
- Two migrations, one spec: erasure (`093000`) and the lookup view (`094000`)
  are kept in separate files for a clean forward-only ledger, but share this
  spec's blast radius and are proven together.
- Notification cancellation includes `delivering`, not only `queued`: a
  `delivering` row is leased-but-unsent, and the claim-lease-expiry bug is
  deferred, so a stuck `delivering` row would otherwise linger as an
  actionable notification about an erased person. Cancelling it is the
  privacy-correct outcome; the race with a live worker is benign because the
  contact is already anonymised and push is already disabled.
- Export delivery is client-side download from the returned payload, not a new
  route or a stored file: minimal surface, no new PII at rest, and the existing
  `admin_log_data_request('export', …)` → `admin_export_customer_data` chain
  (already proven by `tests/db/admin-support-actions.test.mjs`) is reused
  unchanged. The defect is purely the app action discarding `data`.
- Concern #3 uses a service-role view + existing PostgREST admin-read pattern,
  not a new RPC: the admin lookups already query tables/views via the
  service-role client. The `phone` → `phone_last4` contact-filter fix ships
  with it because both live in `lib/admin/lookup-query.ts`.
- Prod application is owner-owed. This spec proves the migrations on the local
  rehearsal database; the session has no prod credentials.

## 5. Behavioral Requirements (EARS)

- WHEN an internal admin submits a data request of type `export` in the privacy console, THE data-request server action SHALL return the customer-data export payload as a downloadable file instead of discarding it.
- THE admin data-request success state SHALL carry a download descriptor (filename, JSON content, mime type) built from the export payload if and only if the request type is `export` and the RPC returned a customer-data export.
- WHEN the data-request success state carries a download descriptor, THE admin action form SHALL render a control that downloads the customer-data export as a JSON file named for the customer and export date.
- IF the request type is `access`, `rectification`, `consent`, or `deletion`, THEN THE data-request action SHALL report the existing audit-trail confirmation and expose no download control.
- THE subject-access export download SHALL contain exactly the fields `admin_export_customer_data` returns and no additional personal data.
- WHEN `admin_erase_customer_pii` anonymises a customer, THE function SHALL mark every non-revoked `customer_sessions` row for that customer as revoked.
- WHEN `admin_erase_customer_pii` anonymises a customer, THE function SHALL disable every `push_subscriptions` row for that customer (enabled false, revoked timestamp set).
- WHEN `admin_erase_customer_pii` anonymises a customer, THE function SHALL cancel every `notification_events` row for that customer whose status is `queued` or `delivering`.
- WHILE erasing a customer, THE function SHALL leave that customer's terminal `notification_events` (`sent`/`failed`/`cancelled`/`expired`) and the loyalty ledger unchanged.
- WHEN `admin_purge_stale_customer_pii` anonymises each stale customer, THE function SHALL apply the same session revocation, push disablement, and queued/delivering-notification cancellation as `admin_erase_customer_pii`.
- THE `admin_purge_stale_customer_pii` function SHALL retain its `is_service_role_request()` self-guard and remain non-executable by `anon` and `authenticated` after redefinition.
- THE erasure-extension migration SHALL be forward-only and idempotent, leaving the existing anonymisation, invite scrub, audit log, and return payload unchanged.
- THE database SHALL expose a `security_barrier` `customers_unaffiliated` view, granted to `service_role` only, listing non-erased customers that have no `customer_memberships` row together with their verification status.
- IF a customer has at least one `customer_memberships` row or is an erased surrogate, THEN THE `customers_unaffiliated` view SHALL exclude that customer.
- WHEN an admin opens the privacy console, THE console SHALL list verified customers who have no membership so they can be discovered and serviced.
- THE admin contact-search filter SHALL match on `customers.phone_last4` (not the dropped `customers.phone` column) so a contact lookup does not error.

## 6. Verification Criteria and Task Breakdown

Observable outcomes to verify:

- Under a rolled-back transaction, after `admin_erase_customer_pii` on a
  customer that has an active session, an enabled push subscription, and both
  a `queued` and a `sent` notification: the session's `revoked_at` is set, the
  push row is `enabled=false` with `revoked_at` set, the `queued` (and any
  `delivering`) notification is `cancelled` with `cancelled_at` set, the `sent`
  notification is untouched, and the membership + stamp ledger are retained.
- The same side-effects hold for `admin_purge_stale_customer_pii` over a stale
  customer, and the function still raises for a non-`service_role` caller
  (`tests/db/rpc-execute-privilege-containment.test.mjs` self-guard test stays
  green).
- `customers_unaffiliated` returns a verified no-membership customer, excludes
  a customer that has a membership, and excludes an `erased+…@privacy.invalid`
  surrogate; `service_role` can `select`, `authenticated`/`anon` cannot.
- `logDataRequestAction` for `export` returns a success state whose download
  descriptor's content parses to the `nabaperks.customer-data-export.v1` schema
  for the right customer; for `access`/`deletion` it returns no download.
- The pure `data-export` helpers build a stable customer/date filename, JSON-
  serialise the payload, and reject non-export values; the fixed
  `contactOrIlikeFilter` emits `phone_last4.ilike`, never `phone.ilike`.
- With `ADMIN_LIVE_DB_E2E=1`, a seeded AAL2 admin submitting an `export`
  request sees a download control for the customer-data export.
- A fresh `supabase db reset` replays `093000` + `094000` with no error, and a
  second re-apply is a clean no-op.

Task breakdown (implement one at a time, red → green → refactor; run the
narrowest `tests/db` / `tests/unit` / `tests/e2e` file per task, then the full
recorded gate floor at the lifecycle boundary):

1. `tests/db/customer-erasure-related-records.test.mjs` red, then migration
   `20260711093000` green: extend `admin_erase_customer_pii` and
   `admin_purge_stale_customer_pii` with session revoke + push disable +
   queued/delivering-notification cancel; retain terminal rows, ledger, and the
   purge self-guard.
2. `tests/db/admin-unaffiliated-customer-lookup.test.mjs` red, then migration
   `20260711094000` green: `customers_unaffiliated` view + service-role grant.
3. `tests/unit/admin-data-export.test.mjs` red, then `lib/admin/data-export.ts`
   + `lib/admin/action-state.ts` green: filename, serialise, type-guard, and the
   download-carrying success state.
4. Wire `app/admin/actions.ts` (`logDataRequestAction`) + `components/admin/action-form.tsx`
   to build and render the export download.
5. `tests/unit/admin-lookup-query.test.mjs` red on the contact filter, then fix
   `lib/admin/lookup-query.ts` (`phone_last4`) green; add
   `getAdminUnaffiliatedCustomers` to `lib/admin/data.ts` and surface it via
   `app/admin/privacy/unaffiliated-customers-panel.tsx` + `app/admin/privacy/page.tsx`.
6. `tests/e2e/admin-privacy-export.spec.ts` (`@MS-db-privacy-lifecycle`,
   `@admin-live-db`) proving the export-download journey.
7. Fresh-DB rehearsal: `supabase db reset` twice, `pnpm test:db`; record with
   `governance:run-gates --spec MS-db-privacy-lifecycle --record` and advance the
   lifecycle with `governance:advance`.
