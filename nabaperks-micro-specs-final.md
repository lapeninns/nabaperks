# Nabaperks UK — Final Micro-Spec Pack (v3)

**Revision notes (v3 — final)**

- **v3 adds the TDD implementation workflow to the Global Context**: Red → Green → Refactor, Fake It / Triangulation / Obvious Implementation, the Rule of Three, stride control, and a per-spec Definition of Done. Every in-scope EARS requirement now maps to a failing test before production code is written.
- MS-00 (platform architecture) is now part of the pack and binds all vendor choices. Feature specs stay vendor-neutral; vendor names live in MS-00 only.
- **Wallet passes are deferred.** MS-13 is a reserved tombstone so existing references stay stable, `packages/wallet` is removed from the repo domains, the customer journey no longer includes a wallet step, and the build order is updated.
- **PostHog (EU hosting) is the single analytics and error-tracking vendor.** Sentry is removed. On `customer-web` the SDK runs cookieless and captures exceptions only.
- Earlier review feedback is folded into the specs it concerned: MS-05 (number recycling / dormant identities), MS-07 (default cooldown), MS-14 (entitlement state vocabulary), MS-15 (erasure mechanics), MS-18 (explicit idempotency key).
- Cross-cutting platform rules are promoted into the Global Context per the authoring instruction; MS-00 stands up their enforcement.

---

# Product thesis

**Nabaperks UK** is a web-first loyalty product where:

> A customer scans a venue QR, shows a short-lived code to staff, staff confirms the purchase on a counter station, the customer's card is stamped, and all stamps/rewards are recoverable by phone number without downloading an app.

The core promise is:

> **No app. No plastic card. No lost stamps.**

The main product decision:

> **The customer keeps their phone, and staff approvals happen only from paired counter stations.**

---

# Global Context for AI Agents

Place this in `AGENTS.md`, `constitution.md`, or equivalent.

## Product assumptions

The product is for UK small and mid-sized local businesses. The MVP is web-first. Customers do not need a native app. Staff use a web-based counter station. Merchants use a web console. Platform operators use an admin console.

Currency is GBP. Default timezone is `Europe/London`. Do not use "UK business day" as a default visit rule; venues may trade heavily on weekends.

Customer identity is phone-number-first. The system shall accept UK numbers in local `07...` format and store them in E.164 format. Browser storage is cache only; the server is the source of truth.

No POS integration is required for MVP. No customer payment flow is required for MVP. No customer password is required for MVP.

## Legal/compliance baseline

Customer privacy information must be clear, concise, intelligible, easy to access, and provided at the point where personal data is collected. ([ICO][1])

Marketing SMS and loyalty/service SMS must be separated. A reward-ready or OTP message can be treated as a service message only when it does not include promotional upsell. Offers, winback nudges, and campaign messages require explicit marketing opt-in. ICO guidance on loyalty schemes also says additional marketing outside the loyalty scheme requires clear consent. ([ICO][2])

Cookies, local storage, scripts, tags, and similar client-side storage/access technologies fall under PECR-style rules, so do not use non-essential analytics or tracking storage without the correct consent surface. ([ICO][3])

Promotional claims must be consistent. Significant reward conditions should appear in the initial promotional material where omission could mislead; do not advertise "free coffee after 3 visits" if the actual mechanic can return a discount voucher. ([ASA][4])

If alcohol or another age-restricted reward is supported, it must not be promoted to under-18s, and the system must support a staff-controlled age-check gate without storing ID scans. ([ASA][5])

VAT-registered UK businesses have digital record-keeping obligations, so merchant billing, invoices, and exports should be designed as durable digital records. ([GOV.UK][6])

Use WCAG 2.2 AA as the accessibility quality baseline, even if the product is private-sector. UK public-sector guidance uses WCAG 2.2 AA as the technical accessibility standard, and it is a strong practical target for a public-facing loyalty product. ([GOV.UK][7])

## Repo domains

Use these domain boundaries for the micro-specs. If the actual repo differs, map these one-to-one and do not widen scope without approval.

* `apps/customer-web`
* `apps/staff-station`
* `apps/merchant-console`
* `apps/admin-console`
* `packages/api`
* `packages/domain`
* `packages/db`
* `packages/ui`
* `packages/messaging`
* `packages/risk`
* `packages/billing`
* `packages/compliance`
* `packages/analytics`

`packages/wallet` is intentionally absent: wallet passes are deferred (see MS-13).

## Architectural constraints

All loyalty-affecting actions must be represented as auditable server-side events.

All customer-visible card state must be recoverable from server state.

Every tenant-owned entity must include tenant isolation.

Every venue action must be attributable to venue, station, staff session where applicable, timestamp, and action type.

Do not introduce shared staff secrets as the primary verification mechanism.

Do not store customer ID documents.

Do not expose raw phone numbers to merchants by default.

Do not allow marketing messages unless an explicit opt-in exists.

Do not allow a reward promise mismatch between poster, QR landing, customer card, and merchant configuration.

## Engineering rules (platform)

These rules apply to every micro-spec. Do not restate them inside feature specs; MS-00 establishes their enforcement.

Every loyalty-affecting write executes on the server inside a single Postgres transaction that appends the ledger event, updates the projection, and enqueues any side-effect jobs. There is no second write path.

Event tables are append-only at the database layer. Corrections are new adjustment events, never edits.

No plaintext phone number exists anywhere in the system. Storage is HMAC index plus ciphertext; display always goes through a masking helper.

The Supabase service-role key never reaches a client. Browser clients hold the anon key at most.

`customer-web` sets no non-essential client storage and loads no third-party scripts before consent. The card session token is documented in `packages/compliance` as strictly necessary for the service the customer requested.

Queued side-effect consumers are idempotent. Delivery is at-least-once.

Every request and resulting event carries a correlation id across app and package boundaries.

Tenant-owned rows reference other tenant-owned rows through composite keys that include `tenant_id`.

Vendors hold no loyalty truth. Stripe is the source of truth for money, Twilio for delivery receipts; the Postgres ledger is the source of truth for loyalty state.

Do not introduce new dependencies, alter architecture, or change schemas beyond a micro-spec's stated scope without approval.

## TDD implementation workflow

All production code in this repo is written test-first. Follow the cycle:

> **Red → Green → Refactor**

Make each behavior pass with the smallest possible implementation, then improve the design only after the behavior is protected by tests.

### How TDD maps onto this pack

In this pack, a micro-spec (MS-xx) is a feature spec containing many behaviors. The unit of the TDD loop is a **test derived from a single EARS requirement or acceptance criterion** — not the MS document. Where the TDD instruction says "create a second Micro-Spec to triangulate," that means *add another test case for the same behavior with a different input, state, or edge case*. It never means creating a new MS-xx document.

Work through each spec's Task breakdown in order. For the current task:

1. Identify the EARS requirements and Required tests the task covers.
2. Write them as failing tests (Red). Every in-scope EARS requirement must end up covered by at least one automated test; requirements that can only be verified visually or on a real device move to the spec's Manual QA list instead.
3. Write the smallest amount of production code that makes the current test pass (Green).
4. Refactor under green.
5. Repeat until the task's tests pass, then move to the next task.

The per-spec Definition of Done (below) gates moving on to the next spec in the build order.

### Two feedback loops

* **Inner loop — Vitest** on `packages/domain`, `packages/api`, and `packages/db` logic. Runs on every step. This is where Fake It and Triangulation happen.
* **Outer loop — Playwright** dual-context E2E (customer browser + station browser) and axe checks. Written from the journey-level EARS requirements, run at task or spec completion, not on every step.

Tests for database-enforced invariants — append-only trigger guards, composite-key tenancy, RLS policies, atomic token consumption — run against a real Postgres instance, never mocks. A mocked database cannot fail the way these invariants are designed to fail.

### Reach Green as simply as possible

When a test is failing, write only the minimum production code required to make it pass. During this phase: do not optimize, do not generalize early, do not refactor prematurely, do not add behavior the current test does not require, and do not introduce abstractions before there is evidence they are needed. Correctness is the only goal.

When the correct implementation is not yet clear, use **Fake It**: hardcode the expected value just enough to make the current test pass. This is acceptable because the purpose of the first implementation is to satisfy the test, not to produce the final design.

### Use Triangulation to force generalization

Do not leave hardcoded or fake implementations in place. After Fake It, add a second test for the same behavior using a different input, state, or edge case. The new test must fail against the hardcoded implementation. Then replace the fake logic with a generalized implementation that satisfies both tests.

Use triangulation when: the first passing solution is hardcoded; the real algorithm is not obvious yet; you want the tests to force the shape of the implementation; or you need confidence that the behavior works for more than one case. The implementation should only become more generic when the tests demand it.

### Use Obvious Implementation for trivial behavior

Do not fake or triangulate every behavior unnecessarily. When the solution is straightforward, well understood, small, and low-risk, write the real logic directly, run the tests, and confirm green.

### Refactor only after the tests are green

Refactor only when the relevant tests are passing, using them as a safety net to improve internal structure without changing external behavior. Improve names, simplify complex logic, remove unnecessary branches, improve readability, separate responsibilities, decouple modules from concrete dependencies, and introduce abstractions only when they clarify the design. Preserve all existing behavior. The refactor phase must not add functionality — any new behavior requires a new failing test first.

### Apply the Rule of Three for duplication

Do not remove duplication the moment it appears. Allow minor duplication to exist temporarily so the correct abstraction can emerge naturally. Refactor duplication only after the same pattern appears three times. Duplicate code is acceptable while it helps reveal the underlying pattern; refactor only when the repetition provides enough evidence for a stable abstraction.

### Adjust stride to problem difficulty

* Hard or unclear problems — atomic token consumption (MS-07), the merge and dormant-identity flows (MS-05), the entitlement state machine (MS-14), outbox atomicity (MS-00) — use baby steps: write 1 to 3 lines of production code, run the tests, confirm, and continue only after feedback.
* Simple or obvious problems — display formatting, masking helpers, copy rendering — use larger steps: 4 to 7 lines, then run the tests.

Do not take steps so small they slow down trivial work, or so large that debugging becomes difficult.

### Prohibited

* Production code without a failing test.
* Generalizing before tests require it.
* Refactoring while tests are red.
* Optimizing during the green phase.
* Removing duplication before the Rule of Three is met.
* Abstractions based on speculation.
* Behavior added because it "might be useful later." If it falls outside the current spec's blast radius, it is also an unauthorized scope change — stop and request approval.

### Definition of Done (per micro-spec)

A micro-spec is complete when:

* All Required tests pass and all acceptance criteria are verified.
* Every in-scope EARS requirement is covered by at least one automated test, or is explicitly listed under Manual QA.
* All Fake It implementations have been replaced through triangulation.
* Refactoring has improved structure without changing behavior.
* Duplication has been handled according to the Rule of Three.
* No untested behavior, unnecessary abstraction, or unauthorized functionality has been introduced.
* The spec's Manual QA steps have been executed, or handed over with notes where they require a human or a real device.

---

# MVP build order

## P0 — Pilot-safe foundation

0. MS-00 — Platform architecture and cross-cutting infrastructure
1. MS-01 — Domain model and ledger
2. MS-02 — Merchant venue onboarding
3. MS-03 — Reward promise builder
4. MS-04 — Customer QR entry and card creation
5. MS-05 — Phone save and recovery
6. MS-06 — Staff station pairing and staff sessions
7. MS-07 — Customer-code to staff-station stamp approval
8. MS-08 — Reward redemption
9. MS-09 — Undo, adjustment, and missing-stamp dispute
10. MS-10 — Consent and service/marketing messaging

## P1 — Business confidence

* MS-11 — Merchant dashboard
* MS-12 — Risk flags and admin case workflow
* MS-14 — Billing and VAT invoice records
* MS-15 — Privacy rights centre

## P2 — Scale

* MS-16 — Multi-venue customer wallet
* MS-17 — Campaigns and winback
* MS-18 — Offline/degraded operations
* MS-19 — Accessibility and motion QA gate
* MS-20 — Marketing site and demo mode

## Deferred

* MS-13 — Wallet pass issuance (out of scope; number reserved, see tombstone)

---

# MS-00 — Platform Architecture, Stack, and Cross-Cutting Infrastructure

This spec sits before MS-01. It binds the vendor and infrastructure choices every other micro-spec depends on, so feature agents never make platform decisions inside feature work.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Monorepo | Turborepo + pnpm, TypeScript end-to-end | `apps/*` and `packages/*` map 1:1 to the repo domains in the Global Context |
| Frontend | Next.js (App Router) on Vercel | Four apps: `customer-web`, `staff-station`, `merchant-console`, `admin-console`. Node runtime by default (Stripe SDK, crypto) |
| API layer | Next.js Route Handlers calling `packages/api` → `packages/domain` | Loyalty-affecting writes are explicit POST endpoints with idempotency keys. Server Actions are allowed for console CRUD only — never for stamps, redemptions, or adjustments |
| Database | Supabase Postgres | Append-only event tables (trigger-guarded), card projections, `pg_cron`, `pgmq` (Supabase Queues) |
| Auth — merchant/admin | Supabase Auth, email + TOTP MFA | MFA mandatory for admin console, strongly encouraged for merchant owners. Role claims drive RBAC |
| Auth — customer | Platform-owned identity, phone-first, OTP via Twilio Verify | Not Supabase Auth users. Enables the MS-05 merge flow, masked display (MS-11), and the MS-15 erasure workflow without fighting `auth.users` |
| Auth — staff station | Pairing flow → station device credential (httpOnly cookie) bound to one venue + per-staff PIN sessions | PINs are argon2-hashed, but a 4–6 digit PIN's real security is server-side rate limiting + station binding (MS-06), not the hash |
| Authorization | RLS deny-by-default as defense-in-depth; explicit tenant/actor checks in server code for all writes | RLS cannot express token consumption, cooldown windows, or transactional ledger appends |
| Tokens | Short-lived single-use codes as Postgres rows; atomic conditional-update consume | Approval idempotency key = token id (MS-07, MS-18) |
| QR | Dynamic `/q/{qr_id}` on a short dedicated domain; opaque ids; status field for reprint rotation | Server-side scan log feeds MS-11 QR health. Print at ECC level Q/H for laminated counters. Station scans customer codes via web camera (BarcodeDetector with a zxing fallback); manual short-code entry always available |
| SMS | Twilio at MVP: Verify for OTP, Programmable Messaging for service sends | MS-05 is P0 — SMS cannot be deferred. Verify ships rate limiting and SMS-pumping fraud protection. Marketing SMS is P2 (MS-17), sent from a long virtual number so STOP replies work, gated by `packages/messaging` consent checks |
| Email | Resend | Merchant transactional only (onboarding, billing, risk alerts). Customers are phone-first; customer email is out of MVP scope |
| Payments | Stripe Billing + Customer Portal + Stripe Tax; verified, idempotent webhooks | Webhooks drive the entitlement state machine (AD-07) implementing the MS-14 grace/suspension gates. Invoice PDFs are mirrored to Supabase Storage as durable records independent of Stripe account access |
| Jobs & scheduling | Transactional outbox on `pgmq` + `pg_cron` sweeps; Vercel Cron (plus an inline kick after enqueue) drains the queue | Side effects — SMS sends, exports, campaign fan-out, risk evaluation — enqueue in the same transaction as the ledger event |
| Realtime | Polling-first (1–2 s during the code window); Supabase Realtime as a later enhancement | Polling is robust on café Wi-Fi and trivially testable. Realtime authorization for non-Supabase-Auth users requires minting custom JWTs — defer |
| File storage | Supabase Storage | Invoice mirrors, DSAR export bundles (signed URLs with TTL), print/poster assets |
| Product analytics | Postgres event tables = source of truth; PostHog (EU hosting) on merchant, staff, and admin surfaces only | No third-party analytics or non-essential client storage on `customer-web` at MVP (PECR, per the Global Context). The MS-11 dashboard reads SQL views over the ledger, not PostHog |
| Errors & observability | PostHog Error Tracking (EU hosting) from day one, server and client, across all four apps; correlation ids end-to-end | Single vendor for analytics and errors. On `customer-web` the SDK runs cookieless: memory persistence, autocapture off, session replay off, exception capture only — recorded in `packages/compliance` as strictly necessary diagnostics |
| Rate limiting | Postgres-backed counters for OTP and PIN attempts | Durable and auditable, which satisfies MS-06's "increment a server-side rate limit". Per-IP/WAF limiting later if abuse appears |
| PII handling | Phones stored E.164: deterministic HMAC-SHA-256 index column (key in Supabase Vault) for lookup + ciphertext at rest; masked display helpers in `packages/domain` | Ledger event payloads carry `customer_id` only (MS-01 constraint) |
| Backups / DR | PITR from day one; restore runbook written and rehearsed before pilot | "No lost stamps" is the headline promise — data-loss tolerance is already low at pilot |
| Environments | Production + staging Supabase projects; Vercel preview deployments; Supabase CLI migrations in `packages/db`, applied via CI | Optional: Supabase branching for preview databases |
| Demo isolation | `is_demo` flag on tenant, hard-filtered from production metrics and merchant views; scheduled purge job | MS-20 |
| Security baseline | HTTPS/HSTS, CSP, httpOnly cookies, RLS, RBAC, MFA, service-role key server-only, secrets in Vercel env + Supabase Vault, append-only ledger as the audit log | |
| Testing gates | Vitest on `packages/domain`; Playwright dual-context E2E (customer browser + station browser running the MS-07 handshake); axe accessibility checks per MS-19 | The dual-context handshake E2E is the money test for this product |

## Goal and user-visible outcomes

Nothing in this spec is directly user-visible. The outcome is that every feature micro-spec can be implemented without inventing platform behaviour, and the pack's four invariants — recoverable customer card, venue-specific context, staff/station confirmation, auditable event — are enforced by infrastructure rather than by convention.

## Blast radius

**In scope**

* Repo scaffold and deployment topology
* `packages/db` baseline schema, migrations tooling, append-only guards, outbox
* `packages/api` transport conventions (idempotency, correlation ids, error shapes)
* `packages/messaging` transport bindings (Twilio, Resend)
* `packages/compliance` client-storage posture
* Vendor configuration: Vercel, Supabase, Stripe, Twilio, Resend, PostHog
* CI gates

**Out of scope**

* All feature flows in MS-01 through MS-20
* Wallet passes (deferred, MS-13)
* POS integration
* Native apps
* Machine-learning risk models

## Strict constraints and assumptions

The Engineering rules in the Global Context apply in full; this spec stands up their enforcement.

All production code — including MS-00's own infrastructure code — is written test-first per the Global Context TDD implementation workflow.

A drain latency of up to one minute is acceptable for queued side effects, except OTP, which is sent synchronously through Verify inside the request.

Production and staging are separate Supabase projects. Migrations apply through CI only.

PITR is enabled before the first pilot stamp is granted.

## Decisions already made

**AD-01 — Transactional write path.** Every stamp, redemption, adjustment, and consent change goes through a route handler that runs one transaction: ledger append + projection update + outbox enqueue. There is no second write path.

**AD-02 — Append-only enforcement in the database.** Event tables get `BEFORE UPDATE OR DELETE` triggers that raise, plus revoked `UPDATE`/`DELETE` privileges. The service role is not exempt from triggers, so even an application bug cannot mutate history. Treat this as a seatbelt: application code never issues those statements anyway.

**AD-03 — Customer identity is platform-owned.** A `customers` table keyed by phone HMAC, verified through Twilio Verify. Customers are not Supabase Auth users: this keeps the MS-05 same-venue merge a plain data operation, keeps phone exposure masked by default, and makes the MS-15 erasure workflow a domain concern rather than an `auth.users` surgery.

**AD-04 — Station and staff session model.** Pairing creates a station row bound to one venue and sets an httpOnly device credential on the station browser. Staff sessions are rows referencing a staff profile, started by PIN. PIN verification happens server-side against an argon2 hash with Postgres-backed attempt counters; the PIN is only meaningful in combination with the station credential.

**AD-05 — Token semantics.** Stamp and redemption codes are rows `{id, card_id, venue_id, kind, expires_at, consumed_at}`. Consumption is a single conditional `UPDATE ... WHERE consumed_at IS NULL RETURNING *` — atomic single-use with no lock choreography. The approval request carries the token id as its idempotency key, which makes MS-18 retries safe by construction.

**AD-06 — Transactional outbox on pgmq.** Side effects are enqueued in the same transaction as the event that caused them, so an event without its jobs (or jobs without their event) cannot exist. Delivery is at-least-once; every consumer is idempotent. A Vercel Cron drain plus an inline fire-and-forget kick after enqueue keeps latency low without long-running functions.

**AD-07 — Entitlement state machine.** Billing states are `TRIALING`, `ACTIVE`, `PAST_DUE_GRACE`, `SUSPENDED`, `CANCELLED`, transitioned only by signature-verified, idempotently-processed Stripe webhooks. MS-14's gates (pause new stamps, never erase cards) key off these states, never off Stripe API reads in the request path.

**AD-08 — Analytics and error posture: one vendor, PostHog, EU hosting.** Product truth lives in the ledger and projections; the MS-11 dashboard is SQL views (materialized where needed, refreshed by pg_cron). PostHog product analytics runs on merchant, staff, and admin surfaces. PostHog error tracking runs everywhere, including server code; on `customer-web` the client SDK is configured cookieless — memory persistence, no autocapture, no session replay — and captures exceptions only, so no non-essential storage is set before consent.

**AD-09 — Polling-first realtime.** During the code window the customer page polls every 1–2 seconds; the station polls approval status the same way. Supabase Realtime is a later enhancement because authorizing it for non-Supabase-Auth customers means minting custom JWTs — not worth it for MVP.

**AD-10 — Tenancy enforcement in the schema.** `tenant_id` on every tenant-owned row; composite foreign keys `(tenant_id, id)` so a cross-tenant reference fails at the schema layer, not just in tests. RLS read predicates keyed on tenant claims for console reads. The per-spec tenant-isolation tests remain mandatory.

**AD-11 — Environments, migrations, demo.** Separate Supabase projects for production and staging; Supabase CLI migrations live in `packages/db` and apply through CI only. Demo tenants carry `is_demo = true`, are hard-filtered out of production metrics, merchant lists, and exports, and are purged on a schedule.

**AD-12 — PII handling and erasure.** Phones normalize to E.164 at the boundary. Storage is HMAC-SHA-256 index (key in Supabase Vault) plus ciphertext; display always goes through a masking helper. MS-15 erasure deletes ciphertext and HMAC and anonymises the identity while retaining ledger events — audit retention and right-to-erasure coexist, and the same phone signing up later creates a fresh identity, satisfying "prevent future recovery."

## EARS requirements

WHEN a loyalty-affecting action executes, THE system SHALL append the ledger event, update the projection, and enqueue side-effect jobs within a single database transaction.

WHEN any database role attempts UPDATE or DELETE on a ledger event table, THE database SHALL reject the statement.

WHEN a queued side-effect job is delivered more than once, THE consumer SHALL produce no duplicate external effect.

WHEN a Stripe webhook is received, THE system SHALL verify its signature and process each Stripe event id at most once.

WHEN a phone number is persisted, THE system SHALL store only its HMAC index and ciphertext, never plaintext.

WHEN `customer-web` loads before any consent interaction, THE system SHALL set only strictly necessary client storage and SHALL load no third-party scripts beyond cookieless exception capture.

WHEN a request crosses an app or package boundary, THE system SHALL propagate a correlation id into logs and any resulting events.

WHEN a tenant-owned row references another tenant-owned row, THE schema SHALL enforce same-tenant integrity through composite keys.

WHEN a tenant is flagged as demo, THE system SHALL exclude it from production metrics, merchant-facing lists, and exports.

WHEN a billing state transition occurs, THE system SHALL update the entitlement state machine and SHALL NOT modify loyalty ledger history.

## Verification criteria and task breakdown

**Acceptance criteria**

* `UPDATE`/`DELETE` on any event table fails for every application role, including service role.
* An event append and its outbox jobs cannot exist independently of each other.
* A replayed Stripe event id produces exactly one state transition.
* OTP and PIN attempts hit server-side limits and lock out correctly.
* A cross-tenant composite-FK insert fails at the schema layer.
* One staging PITR restore has been performed and the runbook updated from it.
* Demo tenants never appear in production metrics or merchant views.

**Required tests**

* Trigger-guard tests on event tables.
* Outbox atomicity tests (forced rollback leaves neither event nor job).
* Webhook signature and replay tests.
* OTP/PIN rate-limit tests.
* Composite-key tenancy tests.
* Demo isolation tests.
* Correlation-id propagation tests.

**Manual QA**

* Run the full MS-07 handshake on staging with the PostHog error feed open in another tab.
* Kill the station's network mid-approval; confirm unknown-state handling and that no duplicate stamp lands. This rehearses MS-18 before MS-18 is built.

**Task breakdown**

1. Scaffold the monorepo (Turborepo, pnpm), four apps, shared packages.
2. Baseline schema and migrations: tenants, venues, customers, cards, event tables with guards, outbox.
3. Auth surfaces: Supabase Auth for merchant/admin with MFA; customer identity plus Twilio Verify; station pairing and staff sessions.
4. Outbox drain worker, pg_cron sweeps, Vercel Cron wiring.
5. Stripe Billing, Tax, Portal; webhook handler into the entitlement state machine; invoice mirroring.
6. Messaging bindings: Verify OTP, service sends, the consent-gate stub MS-10 will fill in.
7. Observability: PostHog error tracking on all apps and server code (customer-web cookieless, exceptions only), product analytics on business surfaces, correlation ids, structured logs.
8. CI gates: the tests above, migration drift check, axe baseline.

## Stack-to-spec mapping

| Spec | Platform components it leans on |
| --- | --- |
| MS-01 | Event tables + trigger guards, projections, correlation ids, tenancy schema |
| MS-02 | Supabase Auth (merchant), setup-state tables, RLS read policies |
| MS-03 | `packages/domain/rewards` validation, copy-consistency checks in `packages/compliance` |
| MS-04 | `/q/{id}` resolver + scan log, strictly-necessary card session token |
| MS-05 | Customer identity tables, HMAC index, Twilio Verify, merge transaction, dormancy check |
| MS-06 | Station device credential, staff PIN hashes, Postgres rate counters |
| MS-07 | Token rows + atomic consume, polling endpoints, station camera scanning |
| MS-08 | Reward lifecycle states, outbox (reward-ready service message via the MS-10 gate) |
| MS-09 | Adjustment events — the append-only model makes undo a reversing event by construction |
| MS-10 | Consent event tables, eligibility gate in `packages/messaging`, Twilio STOP webhooks |
| MS-11 | SQL/materialized views over the ledger (pg_cron refresh), masking helpers |
| MS-12 | pg_cron risk sweeps over event tables, admin console on Supabase Auth + mandatory MFA |
| MS-13 | Deferred — wallet passes are out of scope; no platform components are provisioned |
| MS-14 | Stripe webhooks → entitlement state machine, invoice mirror in Storage |
| MS-15 | Export jobs → Storage signed URLs; erasure = ciphertext/HMAC deletion + anonymised identity |
| MS-16 | Identity → memberships query, RLS tenancy isolation |
| MS-17 | Campaign tables, consent-gated fan-out through pgmq, long-number STOP handling |
| MS-18 | Idempotency keys, token status re-check endpoint, health endpoint |
| MS-19 | `packages/ui` tokens, reduced-motion utilities, axe CI gate |
| MS-20 | `is_demo` tenant flag, metric exclusion, scheduled purge |

---

# MS-01 — Loyalty Domain Model and Audit Ledger

## Goal and user-visible outcomes

A customer's stamps, rewards, redemptions, and recovery state are stored server-side and can be reconstructed from auditable events. A merchant or support agent can see what happened without relying on browser storage.

## Blast radius

**In scope**

* `packages/domain/loyalty`
* `packages/db/migrations`
* `packages/api/loyalty`
* `packages/compliance/audit`

**Out of scope**

* Customer UI
* Merchant dashboard UI
* Billing
* SMS sending
* Fraud scoring beyond basic event recording

## Strict constraints and assumptions

The ledger is append-only for stamp, reward, redemption, adjustment, and consent events.

Card projections may exist for performance, but the ledger is the source of truth.

Every event must include tenant, venue, actor type, actor ID where available, timestamp, and correlation ID.

Personally identifying data must not be duplicated into every event payload.

Phone numbers must not be stored in plaintext inside the loyalty event ledger.

## Decisions already made

The product supports tenants, venues, customers, memberships, cards, stamps, reward rules, reward instances, redemptions, staff members, stations, and audit events.

A customer may hold cards at multiple venues.

A merchant may own multiple venues.

A stamp is not valid unless it is confirmed by a staff station or approved adjustment.

## EARS requirements

WHEN a stamp is approved, THE system SHALL create an immutable `STAMP_GRANTED` event.

WHEN a reward is earned, THE system SHALL create a `REWARD_ISSUED` event linked to the stamp/card that triggered it.

WHEN a reward is redeemed, THE system SHALL create a `REWARD_REDEEMED` event linked to the reward instance and staff session.

WHEN an event is created, THE system SHALL include tenant ID, venue ID, event type, event timestamp, and correlation ID.

WHEN an event changes customer-visible card state, THE system SHALL update the card projection or make the updated state available through the card read API.

WHEN a card projection disagrees with the ledger, THE system SHALL prefer the ledger and expose the inconsistency to admin diagnostics.

## Verification criteria and task breakdown

**Acceptance criteria**

* A card can be reconstructed from ledger events.
* A stamp cannot exist without an event.
* A reward cannot be redeemed twice.
* Tenant A cannot query Tenant B's cards or events.

**Required tests**

* Ledger append tests.
* Projection rebuild tests.
* Tenant isolation tests.
* Duplicate redemption prevention tests.

**Manual QA**

* Create a tenant, venue, customer card, stamp, reward, and redemption.
* Confirm the audit trail shows the full chain.

**Task breakdown**

1. Define loyalty entities and event types.
2. Define event storage and tenant isolation.
3. Define projection/read model.
4. Add reconstruction and duplicate-protection tests.

---

# MS-02 — Merchant Tenant and Venue Onboarding

## Goal and user-visible outcomes

A UK business owner can create a merchant account, add a venue, enter basic business details, configure opening days, and reach a "not live yet" setup checklist without exposing a customer QR prematurely.

## Blast radius

**In scope**

* `apps/merchant-console/onboarding`
* `packages/api/merchant`
* `packages/domain/merchant`
* `packages/db/migrations`

**Out of scope**

* Billing collection
* Reward configuration
* Staff setup
* Customer QR activation
* Public marketing site

## Strict constraints and assumptions

Venue timezone defaults to `Europe/London`.

Business name, trading name, venue address, postcode, and primary contact email are required.

VAT number is optional at onboarding.

Venue opening days are informational and must not block stamps unless a reward rule explicitly uses them.

The merchant cannot go live until reward rules, QR preview, and staff station setup are complete.

## Decisions already made

The product starts in "setup mode."

A merchant may have multiple venues, but MVP onboarding creates one primary venue first.

No Companies House lookup is required for MVP.

## EARS requirements

WHEN a merchant completes account creation, THE system SHALL create a tenant in setup mode.

WHEN the merchant adds a venue, THE system SHALL require venue name, address, postcode, and timezone.

WHEN a postcode is entered in lowercase or with no space, THE system SHALL normalize display formatting without rejecting a valid UK postcode.

WHEN required venue fields are missing, THE merchant console SHALL show field-level errors and SHALL NOT create the venue.

WHEN onboarding is incomplete, THE merchant console SHALL show the remaining setup checklist.

WHEN the merchant attempts to activate the programme before completing required setup, THE system SHALL block activation and show the missing requirements.

## Verification criteria and task breakdown

**Acceptance criteria**

* Merchant can create a tenant and venue.
* Setup checklist persists across refresh.
* Venue cannot be activated before required steps.

**Required tests**

* Required field validation.
* UK postcode normalization.
* Setup-state transition tests.
* Tenant isolation tests.

**Manual QA**

* Create a venue with a London postcode.
* Refresh the browser.
* Confirm the setup checklist remains accurate.

**Task breakdown**

1. Create tenant and venue data model.
2. Build onboarding form and validation.
3. Add setup checklist state.
4. Add activation gate.

---

# MS-03 — Reward Promise Builder

## Goal and user-visible outcomes

A merchant can configure a reward programme whose public promise exactly matches the actual reward mechanic. The system prevents misleading combinations such as advertising a guaranteed free item while configuring a mystery discount pool.

## Blast radius

**In scope**

* `apps/merchant-console/rewards`
* `apps/customer-web/reward-summary`
* `packages/domain/rewards`
* `packages/api/rewards`
* `packages/compliance/promotions`

**Out of scope**

* Reward redemption flow
* Billing
* Marketing campaigns
* Advanced randomization analytics

## Strict constraints and assumptions

MVP supports two reward models: `FIXED_REWARD` and `MYSTERY_REWARD`.

A reward rule must include visit threshold, reward title, reward description, expiry policy, exclusions, and redemption timing.

A mystery reward must show the customer that the reward is variable before the customer participates.

A fixed reward must not contain weighted alternatives.

A reward cannot be activated without customer-facing terms.

## Decisions already made

Default MVP recommendation is fixed reward.

Mystery rewards are allowed only if all public copy uses mystery language.

"Redeem immediately" is the default redemption timing.

"Redeem from next visit" is optional and must be visible in customer copy before participation.

## EARS requirements

WHEN the merchant selects `FIXED_REWARD`, THE system SHALL allow exactly one customer reward outcome.

WHEN the merchant selects `MYSTERY_REWARD`, THE system SHALL require at least two possible reward outcomes and mystery-specific public copy.

WHEN a merchant changes the reward model, THE system SHALL invalidate incompatible copy and require confirmation before saving.

WHEN customer-facing poster copy says "free [item]," THE system SHALL reject any reward configuration that can issue a non-free-item outcome.

WHEN a reward has exclusions, THE customer card SHALL show the exclusions before the customer redeems.

WHEN a reward has an expiry, THE customer card SHALL show the expiry date or expiry rule before redemption.

WHEN a reward is age-restricted, THE system SHALL require staff age-check gating at redemption.

## Verification criteria and task breakdown

**Acceptance criteria**

* Fixed reward cannot contain random outcomes.
* Mystery reward cannot be advertised as guaranteed.
* Customer preview updates with the exact configured promise.
* Reward terms appear in poster preview, landing page, and card view.

**Required tests**

* Reward model validation.
* Copy consistency tests.
* Expiry/exclusion rendering tests.
* Age-restricted reward validation.

**Manual QA**

* Try to create "Free coffee after 3 visits" with a 20% discount mystery outcome.
* Confirm the system blocks it.

**Task breakdown**

1. Define reward rule schema.
2. Build reward model selector.
3. Build terms/copy preview.
4. Add validation preventing promise mismatch.

---

# MS-04 — Venue QR Landing and Customer Card Creation

## Goal and user-visible outcomes

A customer scans a venue QR and lands on a venue-specific card page. The customer can start a card without an app, see the reward promise, and access "Already have a card?" before attempting to stamp.

## Blast radius

**In scope**

* `apps/customer-web/venue-entry`
* `apps/customer-web/card`
* `packages/api/customer-card`
* `packages/domain/loyalty`

**Out of scope**

* Phone OTP recovery
* Staff station approval
* Reward redemption
* Marketing consent

## Strict constraints and assumptions

A venue QR identifies the venue, not a customer.

Scanning the venue QR must not create a stamp.

An unsaved card may be created server-side but must be clearly marked as not recoverable until saved.

Local browser storage may hold a short-lived card access token but must not be the source of truth.

The customer must see the reward promise before starting participation.

## Decisions already made

The landing page has three primary choices: "Get today's stamp," "Already have a card?", and "How it works."

No customer app download prompt is shown before first stamp.

The venue name must be visible above the card action.

## EARS requirements

WHEN a valid venue QR is opened, THE customer web app SHALL display the venue name and active reward promise.

WHEN no active reward programme exists, THE customer web app SHALL display "This venue is not collecting stamps right now."

WHEN the customer taps "Get today's stamp," THE system SHALL create or retrieve a server-side card session but SHALL NOT grant a stamp.

WHEN a card is unsaved, THE customer web app SHALL display "Save this card so you do not lose your stamps."

WHEN the customer taps "Already have a card?", THE customer web app SHALL route to phone recovery.

WHEN the QR is invalid or expired, THE customer web app SHALL show a non-technical error and SHALL NOT create a card.

## Verification criteria and task breakdown

**Acceptance criteria**

* QR scan opens venue landing.
* No stamp is granted by scan alone.
* Unsaved card state is visibly marked.
* Invalid QR fails safely.

**Required tests**

* Valid QR route.
* Invalid QR route.
* No-stamp-on-scan test.
* Unsaved-card warning test.

**Manual QA**

* Scan a venue QR on iOS Safari and Chrome.
* Confirm the same venue copy appears.
* Confirm no stamp appears before staff approval.

**Task breakdown**

1. Build venue QR resolver.
2. Build landing/card shell.
3. Add unsaved card session state.
4. Add invalid QR states.

---

# MS-05 — Phone Save and Card Recovery

## Goal and user-visible outcomes

A customer can save their card with a UK mobile number, verify by OTP, recover stamps on a new device, and merge an unsaved local card into an existing saved card.

## Blast radius

**In scope**

* `apps/customer-web/save-recover`
* `packages/api/identity`
* `packages/messaging/otp`
* `packages/domain/customer`
* `packages/db/migrations`

**Out of scope**

* Email login
* Social login
* Passwords
* Marketing campaigns

## Strict constraints and assumptions

Phone number is the primary customer identifier.

OTP must be rate-limited.

OTP failure must not reveal whether a number has an account.

Customer phone number storage must support lookup and masked display.

The system must separate "save/recover card" from marketing consent.

After the first stamp, saving is strongly encouraged. Before a second stamp, saving is required.

UK mobile numbers are recycled by carriers. An identity with no stamp, redemption, or successful recovery for 12 months is dormant and must not be restored by OTP alone.

## Decisions already made

No customer password exists in MVP.

UK mobile numbers are accepted as `07...` or `+44...`.

OTP copy must say the number is used to save and recover the loyalty card.

The dormancy threshold is 12 months. The dormant-identity confirmation step is selecting the venue of the customer's most recent stamp from a short list of options; failing it routes to a support claim instead of restoring cards.

## EARS requirements

WHEN a customer enters a valid UK mobile number, THE system SHALL send an OTP and transition to OTP entry.

WHEN a customer enters an invalid mobile number, THE customer web app SHALL show a field-level error before sending any request.

WHEN an OTP is correct, THE system SHALL attach the card to the customer identity and show a saved confirmation.

WHEN an OTP is incorrect, THE system SHALL show a generic incorrect-code error and SHALL NOT disclose account existence.

WHEN the customer uses a new device and verifies the same phone number, THE system SHALL restore all active cards linked to that phone number.

WHEN a customer verifies a phone number attached to a dormant identity, THE system SHALL require the dormant-identity confirmation step before restoring any cards.

WHEN the dormant-identity confirmation fails, THE system SHALL NOT restore cards and SHALL offer a support recovery path.

WHEN an unsaved card has stamps and the verified phone number already has a card for the same venue, THE system SHALL offer a merge path rather than silently creating a duplicate.

WHEN the customer attempts a second stamp on an unsaved card, THE system SHALL require save or recovery before showing the staff confirmation code.

## Verification criteria and task breakdown

**Acceptance criteria**

* First card can be saved by OTP.
* Saved card can be recovered on another device.
* Duplicate cards can be merged safely.
* OTP errors do not disclose account existence.
* Dormant identities are not restored by OTP alone.

**Required tests**

* Phone normalization tests.
* OTP success/failure tests.
* Rate-limit tests.
* Card recovery tests.
* Merge tests.
* Dormant-identity recovery tests.

**Manual QA**

* First stamp unsaved.
* Save with phone.
* Open private browser.
* Recover card with same phone.
* Confirm stamps remain.

**Task breakdown**

1. Build phone entry and OTP state machine.
2. Build customer identity mapping.
3. Build recovery flow.
4. Build same-venue merge flow.
5. Build dormant-identity confirmation step.
6. Add rate limits and tests.

---

# MS-06 — Staff Station Pairing and Staff Sessions

## Goal and user-visible outcomes

A merchant can pair a counter station to a venue. Staff can start a named session on that station, so stamps and redemptions are attributable without requiring staff to handle customer phones.

## Blast radius

**In scope**

* `apps/staff-station`
* `apps/merchant-console/staff`
* `packages/api/staff`
* `packages/domain/staff`
* `packages/db/migrations`

**Out of scope**

* Customer card UI
* Stamp approval logic
* Payroll/timekeeping
* Staff email accounts
* Admin fraud case workflow

## Strict constraints and assumptions

A station belongs to one venue.

A station must be paired by a manager or merchant owner.

Staff authentication on a paired station may use individual staff PINs, but those PINs are valid only on the paired station surface.

Shared daily PINs are not allowed as the primary flow.

A staff member can be deactivated by a manager.

## Decisions already made

Each stamp or redemption must record the station and active staff session.

Staff names may be display names only.

MVP does not require staff email addresses.

## EARS requirements

WHEN a merchant creates a station, THE system SHALL generate a pairing flow for one venue.

WHEN a station is paired, THE staff station SHALL show the venue name and station name.

WHEN staff start a session, THE system SHALL require selection of a staff profile and that profile's station PIN.

WHEN a staff PIN is incorrect, THE staff station SHALL show a generic error and increment a server-side rate limit.

WHEN a staff member is deactivated, THE system SHALL prevent new sessions for that staff profile.

WHEN no active staff session exists, THE staff station SHALL block stamp and redemption approval actions.

WHEN a staff session is active, THE station SHALL show the active staff display name and a clear "end session" action.

## Verification criteria and task breakdown

**Acceptance criteria**

* Station can be paired to venue.
* Staff session can be started and ended.
* Deactivated staff cannot approve actions.
* Staff session is attached to stamp/redemption events.

**Required tests**

* Station pairing tests.
* Staff session tests.
* Deactivated staff tests.
* Staff PIN rate-limit tests.

**Manual QA**

* Pair a tablet browser.
* Start a session as a staff member.
* Deactivate the staff member in merchant console.
* Confirm the station blocks new session start.

**Task breakdown**

1. Build station entity and pairing flow.
2. Build staff profile management.
3. Build station session state.
4. Add rate limits and deactivation handling.

---

# MS-07 — Counter Handshake: Customer Code to Staff Approval

## Goal and user-visible outcomes

A customer gets a stamp only after showing a short-lived code or QR to staff, and staff approve the stamp on the counter station. The customer keeps their phone.

## Blast radius

**In scope**

* `apps/customer-web/stamp-code`
* `apps/staff-station/stamp`
* `packages/api/stamps`
* `packages/domain/loyalty`
* `packages/risk/basic-rules`

**Out of scope**

* Reward redemption
* Offline mode
* POS integration
* Venue-wide approval code
* Customer marketing consent

## Strict constraints and assumptions

A customer confirmation code must be short-lived.

A confirmation code must be single-use.

A stamp requires customer card, venue, active reward programme, active staff session, and active station.

The station must show enough card state to avoid accidental duplicate stamping.

The customer app must update after approval without requiring a page refresh where technically possible.

## Decisions already made

Customer code expires after a short visible countdown.

Staff can enter a short code manually or scan a QR.

One customer may not receive multiple normal stamps for the same venue within the configured cooldown window unless a manager override exists.

The default cooldown is one stamp per card per venue per 2 hours, merchant-configurable within platform limits.

## EARS requirements

WHEN a customer requests a stamp code, THE system SHALL create a short-lived, single-use verification token linked to the card and venue.

WHEN the token expires, THE customer web app SHALL show "Code expired" and allow generating a new code.

WHEN staff enters or scans a valid token, THE staff station SHALL show the venue, current stamp count, saved/unsaved status, and duplicate warnings.

WHEN staff approves a valid token, THE system SHALL grant exactly one stamp and consume the token.

WHEN a token has already been consumed, THE staff station SHALL reject it as already used.

WHEN a card has already been stamped within the cooldown window, THE staff station SHALL block normal approval and show the reason.

WHEN approval succeeds, THE customer web app SHALL show the stamp animation and updated progress.

WHEN approval fails, THE customer web app SHALL show a recoverable error and SHALL NOT show a fake stamp.

## Verification criteria and task breakdown

**Acceptance criteria**

* QR scan alone does not stamp.
* Valid staff approval grants one stamp.
* Expired, reused, or wrong-venue codes fail.
* Duplicate same-window stamp is blocked.
* Customer card updates after approval.

**Required tests**

* Token expiry tests.
* Single-use token tests.
* Wrong venue tests.
* Duplicate cooldown tests.
* Stamp ledger tests.

**Manual QA**

* Customer requests code.
* Staff approves.
* Attempt to reuse same code.
* Confirm reuse fails.

**Task breakdown**

1. Build token generation and expiry.
2. Build staff token lookup.
3. Build approval event.
4. Build customer live update/polling.
5. Add duplicate protection tests.

---

# MS-08 — Reward Issuance and Redemption

## Goal and user-visible outcomes

When a customer completes the required number of visits, the system issues a reward. The customer can show the reward to staff, and staff can redeem it once through the counter station.

## Blast radius

**In scope**

* `apps/customer-web/rewards`
* `apps/staff-station/redeem`
* `packages/api/rewards`
* `packages/domain/rewards`
* `packages/risk/basic-rules`

**Out of scope**

* Reward builder
* Marketing SMS
* Billing
* POS integration
* Admin case workflow

## Strict constraints and assumptions

Reward issuance is triggered by server-side card state, not client-side animation.

A reward instance has status: `ISSUED`, `AVAILABLE`, `REDEEMED`, `EXPIRED`, or `VOIDED`.

Default redemption timing is immediate.

A reward can be redeemed only once.

The customer-facing reward screen must show expiry, exclusions, and availability.

Age-restricted rewards require staff age-check confirmation.

## Decisions already made

Reward reveal animation is presentation only.

The staff station is the redemption authority.

The customer phone does not contain a staff secret.

## EARS requirements

WHEN a stamp completes the reward threshold, THE system SHALL issue a reward instance.

WHEN a reward is issued, THE customer web app SHALL show the reward title, availability, expiry, and redemption instructions.

WHEN a customer opens a reward, THE customer web app SHALL show a short-lived redemption code.

WHEN staff scans or enters a valid redemption code, THE staff station SHALL show reward details and restrictions before redemption.

WHEN staff confirms redemption, THE system SHALL mark the reward as redeemed and create a redemption event.

WHEN a redeemed reward code is scanned again, THE staff station SHALL show "Already redeemed" with the redemption time.

WHEN a reward is expired, THE customer web app SHALL show expired state and SHALL NOT show an active redemption code.

WHEN a reward is age-restricted, THE staff station SHALL require an age-check confirmation before enabling the redeem action.

## Verification criteria and task breakdown

**Acceptance criteria**

* Reward is issued at threshold.
* Reward is redeemable once.
* Expired rewards cannot be redeemed.
* Staff can see restrictions before redeeming.
* Customer sees redeemed state after redemption.

**Required tests**

* Threshold issuance tests.
* Single redemption tests.
* Expiry tests.
* Age-gate tests.
* Ledger event tests.

**Manual QA**

* Stamp a card to completion.
* Redeem reward.
* Try to redeem again.
* Confirm second attempt fails clearly.

**Task breakdown**

1. Build reward instance lifecycle.
2. Build customer reward view.
3. Build staff redemption lookup.
4. Build redemption confirmation.
5. Add expiry and duplicate tests.

---

# MS-09 — Undo, Adjustment, and Missing-Stamp Dispute

## Goal and user-visible outcomes

Staff can undo a recent mistake, managers can adjust a card with a reason, and customers can report a missing stamp without contacting platform support first.

## Blast radius

**In scope**

* `apps/staff-station/undo`
* `apps/merchant-console/customers`
* `apps/customer-web/support`
* `packages/api/adjustments`
* `packages/domain/loyalty`
* `packages/compliance/audit`

**Out of scope**

* Admin fraud investigation
* Refunds
* POS evidence upload
* Automated customer compensation

## Strict constraints and assumptions

Undo is time-limited and available only for recent actions from the same station.

Manager adjustment requires a reason.

Adjustments are ledger events, not edits to historical stamp events.

Customers can submit missing-stamp claims, but claims do not automatically grant stamps.

## Decisions already made

Staff undo window is short.

Manager adjustment is available in merchant console.

All manual changes are auditable.

## EARS requirements

WHEN staff grants a stamp, THE staff station SHALL show an undo action for a limited time.

WHEN staff taps undo within the allowed window, THE system SHALL create a reversing adjustment event and update the customer card.

WHEN the undo window expires, THE staff station SHALL hide or disable undo.

WHEN a manager adjusts a card, THE merchant console SHALL require adjustment type, reason, and manager confirmation.

WHEN a customer reports a missing stamp, THE system SHALL create a support claim linked to venue, approximate visit time, and customer card.

WHEN a missing-stamp claim is approved, THE system SHALL grant an adjustment stamp and notify the customer through the card UI.

WHEN a missing-stamp claim is rejected, THE system SHALL show a neutral status without exposing internal notes.

## Verification criteria and task breakdown

**Acceptance criteria**

* Recent staff stamp can be undone.
* Old stamp cannot be undone by staff.
* Manager can add/remove stamp with reason.
* Customer can file missing-stamp claim.
* Adjustments appear in audit trail.

**Required tests**

* Undo window tests.
* Adjustment reason validation.
* Missing-stamp claim tests.
* Audit trail tests.

**Manual QA**

* Staff approves wrong stamp.
* Undo immediately.
* Confirm customer card decreases by one.
* Manager adds a manual stamp with reason.

**Task breakdown**

1. Build undo event model.
2. Build staff undo UI.
3. Build manager adjustment UI.
4. Build customer missing-stamp claim.
5. Add audit display.

---

# MS-10 — Consent, Service Messages, and Marketing Preferences

## Goal and user-visible outcomes

Customers understand why their phone number is collected. They can receive OTP and reward service messages without being opted into marketing, and they can separately opt into or out of promotional messages from a venue.

## Blast radius

**In scope**

* `apps/customer-web/consent`
* `apps/merchant-console/customers`
* `packages/messaging`
* `packages/compliance/consent`
* `packages/api/preferences`

**Out of scope**

* Campaign composer
* Segmentation
* Email marketing
* Third-party ad audiences
* Push notifications

## Strict constraints and assumptions

Marketing consent must be opt-in, not pre-checked.

Consent events must be timestamped and linked to venue/tenant.

Service messages must not include promotional offers.

Customers must be able to opt out of marketing without losing their card.

Merchants must not be able to message customers without the required consent state.

## Decisions already made

The save-card flow includes phone use explanation.

Marketing opt-in is venue-specific.

Platform-wide operational messages are separate from merchant marketing.

## EARS requirements

WHEN a customer enters a phone number, THE customer web app SHALL explain that the number is used to save and recover the card.

WHEN marketing opt-in is shown, THE checkbox SHALL be unchecked by default.

WHEN the customer saves a card without marketing opt-in, THE system SHALL permit OTP and card-recovery messages but SHALL NOT permit promotional messages.

WHEN a customer opts into marketing, THE system SHALL record consent text, timestamp, venue, and source screen.

WHEN a customer opts out, THE system SHALL immediately prevent future marketing sends for that venue.

WHEN a merchant views customer lists, THE merchant console SHALL distinguish "card member" from "marketing opted in."

WHEN a message is promotional and no valid consent exists, THE messaging service SHALL reject the send.

## Verification criteria and task breakdown

**Acceptance criteria**

* Customer can save card without marketing opt-in.
* Marketing opt-in is recorded as separate consent.
* Opt-out blocks future marketing.
* Merchant cannot send promotional messages to non-consented customers.

**Required tests**

* Consent recording tests.
* Opt-out tests.
* Service vs marketing message validation.
* Merchant permission tests.

**Manual QA**

* Save card without checking marketing.
* Confirm reward-ready service message can send.
* Attempt merchant campaign send.
* Confirm blocked.

**Task breakdown**

1. Define consent event model.
2. Build preference UI.
3. Build messaging eligibility rules.
4. Build merchant consent indicators.
5. Add tests for blocked sends.

---

# MS-11 — Merchant Programme Dashboard

## Goal and user-visible outcomes

A merchant can see whether the loyalty programme is working today, what needs attention, how many rewards are outstanding, and whether staff/QR activity looks healthy.

## Blast radius

**In scope**

* `apps/merchant-console/dashboard`
* `packages/api/merchant-analytics`
* `packages/analytics`
* `packages/domain/loyalty`

**Out of scope**

* Advanced cohort analysis
* Campaign sending
* Billing
* Admin risk case decisions
* POS integration

## Strict constraints and assumptions

Dashboard metrics must be tenant-scoped.

Customer counts must separate total members from marketing-opted-in members.

Reward liability must be shown as estimated, not accounting-grade.

The dashboard must avoid exposing raw phone numbers.

## Decisions already made

Dashboard prioritizes action over raw feeds.

The first screen shows today, programme health, reward liability, and needs-attention items.

## EARS requirements

WHEN a merchant opens the dashboard, THE system SHALL show today's stamps, new saved members, redemptions, and rewards waiting.

WHEN a QR has unusually low scans after launch, THE dashboard SHALL show a QR health prompt.

WHEN rewards are issued but not redeemed, THE dashboard SHALL show outstanding reward count and estimated cost.

WHEN staff station activity exists, THE dashboard SHALL show active/recent stations.

WHEN a metric cannot be calculated, THE dashboard SHALL show an unavailable state rather than zero.

WHEN customer data is shown, THE dashboard SHALL mask phone numbers and avoid cross-venue leakage.

## Verification criteria and task breakdown

**Acceptance criteria**

* Merchant sees today's activity.
* Merchant sees outstanding reward liability.
* Merchant sees setup/QR/staff warnings.
* Metrics respect tenant and venue boundaries.

**Required tests**

* Metric aggregation tests.
* Empty-state tests.
* Tenant isolation tests.
* Masked customer display tests.

**Manual QA**

* Generate stamps and redemptions.
* Confirm dashboard updates.
* Create another tenant.
* Confirm no cross-tenant metrics appear.

**Task breakdown**

1. Define dashboard metric contract.
2. Build aggregation endpoints.
3. Build dashboard UI.
4. Add empty/error states.
5. Add tenant-isolation tests.

---

# MS-12 — Risk Flags and Admin Case Workflow

## Goal and user-visible outcomes

Platform admins can see suspicious stamp or redemption patterns as reviewable cases with evidence and recommended actions. The system flags risk without automatically accusing customers or staff.

## Blast radius

**In scope**

* `apps/admin-console/risk`
* `packages/risk`
* `packages/api/admin-risk`
* `packages/compliance/audit`

**Out of scope**

* Machine-learning fraud models
* Automatic account bans
* Police/law-enforcement workflows
* Customer-facing accusation copy

## Strict constraints and assumptions

Risk flags are signals, not verdicts.

Risk cases must show event evidence.

Admin actions must be audited.

Risk logic must not require invasive device fingerprinting.

No risk flag may silently delete customer rewards.

## Decisions already made

Initial risk rules are rule-based.

Examples: stamp velocity, repeated failed code entry, staff anomaly, same station excessive activity, repeated redemption attempts.

## EARS requirements

WHEN stamp velocity exceeds configured limits, THE risk service SHALL create or update a risk signal.

WHEN a risk signal is created, THE admin console SHALL show affected tenant, venue, time window, event evidence, and suggested next action.

WHEN an admin opens a risk case, THE admin console SHALL show timeline, impacted cards, impacted staff sessions, and current status.

WHEN an admin resolves a case, THE system SHALL require resolution category and note.

WHEN an admin reverses a stamp or reward from a case, THE system SHALL create an adjustment event and audit event.

WHEN a risk case is unresolved, THE merchant dashboard MAY show a non-accusatory "review needed" alert.

## Verification criteria and task breakdown

**Acceptance criteria**

* Risk signals are generated from event patterns.
* Admin can review evidence.
* Admin can resolve cases.
* Reversal actions are audited.

**Required tests**

* Risk rule tests.
* Admin permission tests.
* Case lifecycle tests.
* Adjustment audit tests.

**Manual QA**

* Generate repeated stamps from one station.
* Confirm a risk case appears.
* Resolve it with note.
* Confirm audit trail.

**Task breakdown**

1. Define risk signal schema.
2. Build basic rules.
3. Build admin case list/detail.
4. Build resolution workflow.
5. Add audit integration.

---

# MS-13 — Wallet Pass Issuance [DEFERRED — OUT OF SCOPE]

Wallet passes (Apple Wallet / Google Wallet) are explicitly out of scope for the current build. This spec number is reserved so existing references remain stable.

**Rules while deferred:**

* Do not implement any wallet pass functionality.
* Do not add wallet-related dependencies, certificates, or vendor accounts.
* Do not create `packages/wallet`.
* Phone-number recovery (MS-05) and the multi-venue customer wallet (MS-16) are the only card re-access surfaces.

When wallet passes are re-scoped, a full micro-spec will replace this placeholder. Until then, any agent encountering a wallet-related requirement must stop and request approval rather than implement.

---

# MS-14 — Billing, Subscription Status, and VAT Invoice Records

## Goal and user-visible outcomes

A merchant can see subscription status, billing history, downloadable invoices, and what happens to customer cards if payment fails. Customers do not lose earned stamps because of merchant billing problems.

## Blast radius

**In scope**

* `apps/merchant-console/billing`
* `packages/billing`
* `packages/api/billing`
* `packages/domain/merchant`

**Out of scope**

* Customer payments
* POS payments
* Payroll
* Accounting integrations
* Tax advice

## Strict constraints and assumptions

Billing status must not delete loyalty data.

If a merchant subscription fails, existing customer cards and earned rewards remain viewable.

New stamp issuance may be paused only after a clearly defined grace period.

Invoices must be durable records.

VAT display must support UK VAT where applicable.

## Decisions already made

Merchant pays SaaS subscription.

Customer loyalty data remains protected even if merchant billing fails.

MVP supports invoice download and billing status display.

Entitlement states are `TRIALING`, `ACTIVE`, `PAST_DUE_GRACE`, `SUSPENDED`, and `CANCELLED`, held in our database and transitioned only by signature-verified, idempotently processed Stripe webhooks (MS-00, AD-07). All gates in this spec key off these states.

## EARS requirements

WHEN a merchant opens billing, THE merchant console SHALL show current plan, status, next billing date where available, and billing history.

WHEN an invoice exists, THE merchant console SHALL allow the merchant to view or download it.

WHEN billing payment fails, THE merchant console SHALL show a clear recovery banner.

WHEN billing enters grace period (`PAST_DUE_GRACE`), THE customer card SHALL continue showing existing stamps and rewards.

WHEN billing suspension (`SUSPENDED`) begins, THE system SHALL block new merchant programme activation and new stamp grants according to policy, but SHALL NOT erase cards.

WHEN billing recovers, THE system SHALL restore eligible stamp operations without duplicating missed actions.

WHEN a verified Stripe webhook reports a subscription change, THE system SHALL transition the entitlement state machine and SHALL NOT modify loyalty ledger history.

## Verification criteria and task breakdown

**Acceptance criteria**

* Merchant sees billing status.
* Invoices are accessible.
* Failed billing does not delete customer card state.
* Suspension policy is visible.

**Required tests**

* Billing status tests.
* Invoice access tests.
* Grace/suspension state tests.
* Webhook replay/idempotency tests.
* Customer visibility tests during billing failure.

**Manual QA**

* Simulate failed payment.
* Open merchant console.
* Open customer card.
* Confirm earned stamps still show.

**Task breakdown**

1. Define billing status states.
2. Build billing UI.
3. Build invoice list/download.
4. Add grace/suspension gates.
5. Add tests.

---

# MS-15 — Customer Privacy Rights Centre

## Goal and user-visible outcomes

A customer can see what phone number their card is saved to, manage marketing preferences, request export, and request deletion or deactivation of their loyalty account.

## Blast radius

**In scope**

* `apps/customer-web/privacy`
* `packages/api/privacy`
* `packages/compliance/privacy`
* `packages/domain/customer`

**Out of scope**

* Legal ticketing integrations
* Full DSAR automation beyond MVP export request
* Merchant billing data
* Staff HR data

## Strict constraints and assumptions

Customer must verify phone ownership before accessing privacy actions.

Deletion must respect legal/audit retention requirements.

The system must distinguish deleting marketing consent from deleting loyalty account.

Privacy copy must use plain language.

## Decisions already made

Customer privacy controls live inside the card/account area.

Merchant cannot delete a customer silently from the customer's perspective.

Right-to-erasure requests are handled through a controlled workflow.

Erasure mechanics: deletion removes the phone ciphertext and HMAC index and anonymises the customer identity; ledger events are retained in anonymised form to satisfy audit retention (MS-00, AD-12). A later sign-up with the same phone number creates a fresh identity.

## EARS requirements

WHEN a verified customer opens privacy settings, THE customer web app SHALL show saved phone number in masked form.

WHEN a customer opts out of marketing, THE system SHALL preserve the loyalty card and stop marketing sends.

WHEN a customer requests export, THE system SHALL create an export request and show pending status.

WHEN a customer requests deletion, THE system SHALL explain consequences before confirmation.

WHEN deletion is confirmed, THE system SHALL deactivate customer access and queue deletion/anonymisation according to retention policy.

WHEN deletion is executed, THE system SHALL delete the phone ciphertext and HMAC index, anonymise the identity, and retain ledger events in anonymised form.

WHEN deletion is completed, THE system SHALL prevent future recovery with that phone number unless the customer signs up again.

## Verification criteria and task breakdown

**Acceptance criteria**

* Customer can manage preferences.
* Export request can be created.
* Deletion request can be created.
* Loyalty opt-out and marketing opt-out are separate.

**Required tests**

* Verified access tests.
* Marketing opt-out tests.
* Export request tests.
* Deletion workflow tests.
* Anonymisation tests.

**Manual QA**

* Recover card by phone.
* Open privacy centre.
* Opt out of marketing.
* Confirm card still works.

**Task breakdown**

1. Build privacy settings route.
2. Build preference controls.
3. Build export request model.
4. Build deletion request flow.
5. Build anonymisation job.
6. Add verification tests.

---

# MS-16 — Multi-Venue Customer Wallet

## Goal and user-visible outcomes

A customer with cards at multiple businesses can recover and view all active cards after verifying their phone number, while each merchant sees only their own venue's customers.

## Blast radius

**In scope**

* `apps/customer-web/wallet`
* `packages/api/customer-wallet`
* `packages/domain/customer`
* `packages/domain/loyalty`

**Out of scope**

* Cross-merchant campaigns
* Shared customer profiles exposed to merchants
* Marketplace discovery
* Payment wallet
* Apple/Google wallet passes (deferred, MS-13)

## Strict constraints and assumptions

Customer wallet is customer-facing only.

The customer wallet is a web surface for the customer's own cards. It is unrelated to Apple/Google wallet passes, which are deferred (MS-13).

Merchant A must not learn that a customer has a card at Merchant B.

Customer identity can link multiple venue memberships.

The QR scan still lands on the venue-specific card first.

## Decisions already made

A single verified phone identity can own multiple cards.

The wallet is a recovery/access surface, not a public discovery marketplace.

## EARS requirements

WHEN a verified customer opens wallet, THE system SHALL show active cards grouped by venue.

WHEN a customer taps a venue card, THE customer web app SHALL open that venue's loyalty card.

WHEN a merchant views customers, THE merchant console SHALL show only memberships for its tenant and venues.

WHEN a customer has no cards, THE wallet SHALL show an empty state explaining how to collect a first stamp.

WHEN a venue programme is paused, THE wallet SHALL show paused state without deleting the card.

## Verification criteria and task breakdown

**Acceptance criteria**

* Customer can see cards across venues.
* Merchant cannot see cross-venue wallet data.
* Paused cards remain visible.
* Empty state is clear.

**Required tests**

* Multi-venue wallet tests.
* Tenant isolation tests.
* Paused programme tests.
* Empty-state tests.

**Manual QA**

* Create cards at two venues.
* Recover by phone.
* Confirm both appear in customer wallet.
* Confirm each merchant sees only its own card.

**Task breakdown**

1. Build wallet card list API.
2. Build wallet UI.
3. Add tenant isolation tests.
4. Add paused/empty states.

---

# MS-17 — Merchant Campaigns and Winback

## Goal and user-visible outcomes

A merchant can send simple SMS campaigns only to customers who explicitly opted into marketing for that venue. The merchant can see estimated audience size before sending.

## Blast radius

**In scope**

* `apps/merchant-console/campaigns`
* `packages/messaging`
* `packages/api/campaigns`
* `packages/compliance/consent`

**Out of scope**

* Email campaigns
* Social ad audiences
* Automated segmentation beyond MVP
* AI copy generation
* Cross-merchant campaigns

## Strict constraints and assumptions

Campaigns are disabled unless the venue has opted-in customers.

Every recipient must have valid marketing consent for that venue.

Every campaign must include unsubscribe handling.

Campaign copy must not contradict reward terms.

No campaign may be sent to customers of another tenant.

## Decisions already made

MVP campaigns are one-off SMS messages.

No automated winback until manual campaigns work safely.

Campaign copy is merchant-written or template-based, not AI-generated by default.

## EARS requirements

WHEN a merchant opens campaigns, THE merchant console SHALL show opted-in audience count.

WHEN no opted-in audience exists, THE merchant console SHALL disable campaign sending and explain why.

WHEN a merchant drafts a campaign, THE system SHALL validate length, venue identity, unsubscribe requirement, and consent eligibility.

WHEN a merchant sends a campaign, THE messaging service SHALL send only to customers with valid marketing consent for that venue.

WHEN a recipient opts out, THE system SHALL suppress future campaign sends to that customer for that venue.

WHEN campaign copy mentions a reward, THE system SHALL require selection of the relevant active reward rule or show a warning.

## Verification criteria and task breakdown

**Acceptance criteria**

* Campaign cannot send without opt-in audience.
* Campaign sends only to consented recipients.
* Opt-out suppresses future sends.
* Reward copy warning appears.

**Required tests**

* Consent eligibility tests.
* Tenant isolation tests.
* Opt-out suppression tests.
* Campaign validation tests.

**Manual QA**

* Create one opted-in customer and one non-opted customer.
* Send campaign.
* Confirm only opted-in customer receives it.

**Task breakdown**

1. Build campaign draft model.
2. Build audience eligibility query.
3. Build send validation.
4. Build opt-out suppression.
5. Add tests.

---

# MS-18 — Offline and Degraded Counter Operations

## Goal and user-visible outcomes

When the counter station or customer phone has weak connectivity, the product fails safely, explains what happened, and provides a recovery path without issuing unaudited client-only stamps.

## Blast radius

**In scope**

* `apps/customer-web/error-states`
* `apps/staff-station/error-states`
* `packages/api/health`
* `packages/domain/support`

**Out of scope**

* Fully offline stamp issuance
* Local-only ledgers
* POS integration
* Bluetooth/NFC fallback

## Strict constraints and assumptions

No stamp may be granted purely client-side.

No reward may be redeemed purely client-side.

Weak connectivity must not create duplicate stamps.

Staff and customer screens must explain whether the action succeeded, failed, or is unknown.

## Decisions already made

MVP uses safe failure, not offline stamping.

Manual missing-stamp claim is the recovery path.

Station health is visible to staff.

The approval request's idempotency key is the verification token id (MS-00, AD-05). Retries reuse the same key.

## EARS requirements

WHEN the customer cannot generate a stamp code due to network failure, THE customer web app SHALL show a retry state and missing-stamp guidance.

WHEN staff station loses connectivity before approval, THE staff station SHALL show offline state and disable approve/redeem actions.

WHEN staff submits an approval request, THE request SHALL carry the verification token id as its idempotency key.

WHEN staff submits an approval and response is unknown, THE staff station SHALL show "checking status" before allowing another attempt.

WHEN the system confirms no stamp was created, THE staff station SHALL allow retry with the same valid token if not expired.

WHEN the system confirms a stamp was created, THE staff station SHALL show success and SHALL NOT allow duplicate approval.

WHEN customer and staff disagree on state, THE customer web app SHALL provide a "report missing stamp" action.

## Verification criteria and task breakdown

**Acceptance criteria**

* Offline station cannot approve stamps.
* Unknown state resolves before retry.
* No duplicate stamp from retry.
* Missing-stamp flow is reachable.

**Required tests**

* Network failure tests.
* Unknown response tests.
* Retry idempotency tests (same idempotency key, single stamp).
* Missing-stamp fallback tests.

**Manual QA**

* Simulate network drop during approval.
* Confirm no duplicate stamp appears.
* Confirm customer can report missing stamp.

**Task breakdown**

1. Build health detection.
2. Build customer failure states.
3. Build station failure states.
4. Add idempotency handling.
5. Add tests.

---

# MS-19 — Accessibility and Reduced-Motion Quality Gate

## Goal and user-visible outcomes

Customer, staff, and merchant flows are usable with keyboard, screen readers, high contrast, and reduced motion. Stamp animations are delightful but never required to understand state.

## Blast radius

**In scope**

* `packages/ui`
* `apps/customer-web`
* `apps/staff-station`
* `apps/merchant-console`
* `packages/testing/accessibility`

**Out of scope**

* Full external accessibility audit
* Native app accessibility
* Brand redesign
* Non-English localisation

## Strict constraints and assumptions

Every interactive control must be keyboard reachable.

State changes must not rely on animation alone.

Reduced-motion preference must be respected.

Staff station must prioritize clarity over decorative brand effects.

Colour cannot be the only indicator of status.

## Decisions already made

Wet Ink visual language is allowed, but operational screens are calmer than customer celebration screens.

WCAG 2.2 AA is the target quality bar.

## EARS requirements

WHEN a user has reduced motion enabled, THE UI SHALL reduce or remove stamp slam, confetti, and large movement animations.

WHEN a stamp is added, THE customer web app SHALL show text confirmation in addition to animation.

WHEN a form field has an error, THE UI SHALL expose the error text visually and programmatically.

WHEN a user navigates by keyboard, THE UI SHALL show visible focus states for all controls.

WHEN staff station shows approve/redeem actions, THE primary action SHALL have clear text, state, and disabled reason where applicable.

WHEN colour indicates success, warning, or error, THE UI SHALL also provide text or icon labeling.

## Verification criteria and task breakdown

**Acceptance criteria**

* Keyboard path works across core flows.
* Reduced motion suppresses major animations.
* Screen reader labels exist for primary actions.
* Operational screens remain legible without colour.

**Required tests**

* Automated accessibility checks for key routes.
* Reduced-motion snapshot/manual tests.
* Keyboard navigation tests.
* Form error accessibility tests.

**Manual QA**

* Complete customer stamp flow with keyboard.
* Enable reduced motion.
* Confirm stamp state remains understandable.

**Task breakdown**

1. Define accessibility component rules.
2. Add reduced-motion handling.
3. Add focus/error patterns.
4. Add automated checks.
5. Run manual QA on core flows.

---

# MS-20 — Marketing Site and Demo Mode

## Goal and user-visible outcomes

A UK business owner can understand the product, see how counter verification works, preview the customer/staff journey, and start onboarding without misleading reward or ROI claims.

## Blast radius

**In scope**

* `apps/merchant-console/demo`
* `apps/customer-web/demo`
* `apps/staff-station/demo`
* `apps/public-marketing`
* `packages/compliance/promotions`

**Out of scope**

* Paid ads
* SEO blog
* Case studies without evidence
* AI-generated testimonials
* Pricing experiments beyond approved copy

## Strict constraints and assumptions

Marketing claims must be substantiated.

Demo data must be clearly marked as demo.

The site must explain no app, no plastic, customer-held phones, and recoverable cards.

The site must not promise a specific reward unless the demo configuration uses that exact fixed reward.

## Decisions already made

Primary product differentiator is "customer code, staff confirms."

Wet Ink remains a brand style, not a security mechanic.

Demo mode should show customer and staff side-by-side.

## EARS requirements

WHEN a visitor opens the marketing site, THE site SHALL explain the counter-station handshake in plain language.

WHEN a demo reward is shown, THE site SHALL show whether it is fixed or mystery.

WHEN ROI or uplift claims are shown, THE site SHALL display only approved substantiated claims.

WHEN a visitor starts demo mode, THE system SHALL create non-production demo data and mark all screens as demo.

WHEN a visitor exits demo mode, THE system SHALL prevent demo data from appearing in production merchant records.

WHEN a visitor clicks "Start," THE system SHALL route to merchant onboarding.

## Verification criteria and task breakdown

**Acceptance criteria**

* Marketing explains the redesigned flow.
* Demo does not create real loyalty events.
* Reward copy is consistent.
* No unsupported ROI claims appear.

**Required tests**

* Demo data isolation tests.
* Marketing copy consistency tests.
* Onboarding route tests.
* Reward claim validation tests.

**Manual QA**

* Run demo as business owner.
* Confirm customer and staff sides are understandable.
* Confirm demo events do not appear in merchant production data.

**Task breakdown**

1. Build public explanation page.
2. Build demo customer/staff simulation.
3. Add demo data isolation.
4. Add compliant copy checks.
5. Route to onboarding.

---

# The redesigned core journey

## Customer

1. Scans venue QR.
2. Sees venue and reward promise.
3. Taps **Get today's stamp**.
4. Sees a short-lived code.
5. Shows code to staff.
6. Staff approves from counter station.
7. Stamp lands.
8. Customer saves card by phone.
9. Customer returns and repeats.
10. Reward is issued and redeemed through staff station.

## Staff

1. Opens paired station.
2. Starts named staff session.
3. Scans or enters customer code.
4. Sees customer card state and duplicate warnings.
5. Approves stamp or redeems reward.
6. Can undo recent mistake.
7. Ends session at shift change.

## Merchant

1. Creates venue.
2. Chooses fixed or mystery reward.
3. Reviews exact customer promise.
4. Sets staff and station.
5. Tests QR-to-stamp-to-reward flow.
6. Goes live.
7. Monitors programme health, reward liability, and risk.

## Admin

1. Reviews tenants and billing.
2. Handles risk cases.
3. Supports deletion/export requests.
4. Reverses disputed events with audit trail.
5. Monitors platform health.

---

# The biggest design principle

Do not design Nabaperks as "a prettier digital stamp card."

Design it as:

> **A small-business trust system for repeat visits.**

That means every stamp needs four things:

1. A recoverable customer card.
2. A venue-specific context.
3. A staff/station confirmation.
4. An auditable event.

Everything else — Wet Ink, slam animation, sealed reward, confetti, posters — should sit on top of that trust system, not replace it.

---

[1]: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/ "Right to be informed"
[2]: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/ "Direct marketing and privacy and electronic communications"
[3]: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/ "Cookies and similar technologies"
[4]: https://www.asa.org.uk/advice-online/promotional-marketing-general.html "Promotional marketing: General"
[5]: https://www.asa.org.uk/advice-online/alcohol-the-young.html "Alcohol: Targeting and Appeal to Under 18s - ASA"
[6]: https://www.gov.uk/guidance/record-keeping-for-vat-notice-70021 "Record keeping (VAT Notice 700/21)"
[7]: https://www.gov.uk/guidance/accessibility-requirements-for-public-sector-websites-and-apps "Understanding accessibility requirements for public sector websites and apps"
