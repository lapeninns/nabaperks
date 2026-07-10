---
spec_id: MS-db-emergency-containment
status: implemented
risk_class: migrations
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/db/emergency-containment.md
  - micro-specs/evidence/MS-db-emergency-containment.json
  - supabase/migrations/20260711090000_rpc_execute_privilege_containment.sql
  - supabase/migrations/20260711091000_merchant_business_state_protection.sql
  - supabase/migrations/20260711092000_reconcile_customers_email_hmac.sql
  - supabase/migrations/20260710095000_remove_legacy_seed_signup_duplicate.sql
  - scripts/check-supabase-migrations.mjs
  - tests/db/rpc-execute-privilege-containment.test.mjs
  - tests/db/merchant-business-state-protection.test.mjs
  - tests/db/live-schema-reconciliation.test.mjs
  - tests/unit/check-supabase-migrations.test.mjs
implementation_surfaces:
  - supabase/migrations/20260711090000_rpc_execute_privilege_containment.sql
  - supabase/migrations/20260711091000_merchant_business_state_protection.sql
  - supabase/migrations/20260711092000_reconcile_customers_email_hmac.sql
  - supabase/migrations/20260710095000_remove_legacy_seed_signup_duplicate.sql
  - scripts/check-supabase-migrations.mjs
  - tests/db/rpc-execute-privilege-containment.test.mjs
  - tests/db/merchant-business-state-protection.test.mjs
  - tests/db/live-schema-reconciliation.test.mjs
  - tests/unit/check-supabase-migrations.test.mjs
related_docs:
  - AGENTS.md
  - micro-specs/README.md
related_tests:
  - tests/db/rpc-execute-privilege-containment.test.mjs
  - tests/db/merchant-business-state-protection.test.mjs
  - tests/db/live-schema-reconciliation.test.mjs
  - tests/unit/check-supabase-migrations.test.mjs
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
  - Fresh-database double-replay proof (supabase db reset applied twice) confirming all four migrations are idempotent and order-safe.
  - ACL/column/index readback from the rehearsal database proving PUBLIC/anon/authenticated hold no unlisted function EXECUTE and customers.email_hmac exists with its index.
approved_exceptions: []
---

# MS-db-emergency-containment — Emergency DB containment: RPC ACL lockdown, billing-state protection, live-schema reconciliation

## 1. Exact Goal and User-Visible Outcomes

The 2026-07-10 database audit blocked release on three defects. When this ships:

- **No ordinary caller can execute a privileged RPC.** An `authenticated`
  session (a logged-in merchant, customer, or admin acting through the
  anon-key client) can call only the small allowlist of functions the app
  actually invokes with a user token, plus the RLS policy-helper functions
  the planner must run to evaluate row policies. `anon` and the implicit
  `PUBLIC` pseudo-role can execute none of the project's `public`-schema
  functions. Service-role callers (cron, webhooks, billing, notifications,
  pre-auth customer flows) are unaffected. Destructive service-role RPCs
  additionally self-check that they are running as `service_role`.
- **A merchant owner cannot flip their own business state to dodge billing.**
  Direct `UPDATE public.merchants` by a non-privileged session can no longer
  change `requires_billing` or `status`; those columns move only through
  `service_role` / internal-admin paths. Attempting it raises, so
  `loyalty_availability_reason` can no longer be short-circuited from the
  client.
- **The live schema and the migration source agree, and drift is detectable.**
  `customers.email_hmac` (which `lib/customer/profile.ts` reads and writes)
  exists in every database, restored by a forward-only idempotent migration;
  the lost live-applied migration `20260710095000` is re-introduced as a
  fresh-safe bridge; and `pnpm smoke:supabase:migrations` fails on duplicate
  version numbers and on applied-migration edits that are not recorded as
  sanctioned, not only on version-number set differences.

This is containment, not a redesign. Notification durability, migration-tool
ledger safety, privacy lifecycle, loyalty concurrency, FK indexes, and scaled
performance are explicitly deferred to their own later Micro-Specs.

## 2. Blast Radius

In scope — four new forward-only migrations, the parity checker, and their
tests, all listed in the frontmatter:

- `supabase/migrations/20260711090000_rpc_execute_privilege_containment.sql`
  — revoke + default-privilege + allowlist regrant + destructive-RPC guards.
- `supabase/migrations/20260711091000_merchant_business_state_protection.sql`
  — trigger protecting `merchants.requires_billing` and `merchants.status`.
- `supabase/migrations/20260711092000_reconcile_customers_email_hmac.sql`
  — idempotent repair of `customers.email_hmac` + partial index.
- `supabase/migrations/20260710095000_remove_legacy_seed_signup_duplicate.sql`
  — fresh-safe re-introduction of the lost `20260710095000` repair.
- `scripts/check-supabase-migrations.mjs` — duplicate-version and
  edited-applied-migration detection.
- `tests/db/*` behavioral proofs and
  `tests/unit/check-supabase-migrations.test.mjs` pure-function proof.

Explicitly out of scope: editing any already-applied migration file (the
append-only rule is the point — every repair is forward-only); application
TypeScript under `app/**` or `lib/**` (the app already reads `email_hmac` and
uses the service-role client for the pre-auth paths, so no client change is
required); the notification, privacy, loyalty-concurrency, FK-index, and
performance waves; `scripts/run-supabase-sql.mjs` (its ledger-bypass is a
separate wave-2 tooling spec). `supabase/seed.sql` is out of scope — the
email_hmac reconciliation is a column/index repair, not a seed-data change.

## 3. Strict Constraints and Assumptions

- **Forward-only.** No migration file that has ever been applied to a live
  database may be edited. All three defects are repaired by NEW dated
  migrations. This is both a governance rule and the mechanism that keeps
  fresh replay and live state convergent.
- **Fresh-safe and idempotent.** Every new migration must be a no-op-safe
  re-run: guarded `add column if not exists`, `create index if not exists`,
  `create or replace function`, `drop trigger if exists` then `create`, and
  candidate-counted DO blocks that fail closed. A brand-new database replaying
  the full chain, and the linked database applying only the new tail, must
  both converge to the same schema.
- **Allowlist is the exact app surface, verified, not guessed.** The
  `authenticated` EXECUTE allowlist equals the set of RPCs the RPC-to-role
  mapping confirmed are called through the anon-key (user-JWT) client, plus
  the `SECURITY DEFINER` RLS policy-helper functions the row policies
  reference (e.g. `is_internal_admin`, `is_merchant_owner`,
  `is_customer_owner`, `is_staff_for_merchant`, `customer_has_membership`,
  `merchant_can_access_customer`). Every other `public` function is
  service-role-only. If a function is missed, its user-facing feature breaks
  loudly in rehearsal — fail visible, never silently widen the allowlist.
- **Destructive service-role RPCs self-guard.** `admin_purge_stale_customer_pii`
  and the notification-claim / reward-expiry mutators assert
  `current_setting('request.jwt.claim.role', true) = 'service_role'` (or the
  equivalent `auth.role()` check already used in the codebase) and raise
  otherwise, so a future ACL regression cannot re-expose them silently.
- **Billing-state protection must not break sanctioned writers.** The trigger
  distinguishes privileged writers (service_role, and internal-admin sessions
  via the same helper the RLS policies use) from ordinary owners. Onboarding,
  Stripe webhook sync, and admin tools keep working; only a bare owner
  `UPDATE` of the protected columns is refused.
- **`test:db` is the primary proof.** DB behavioral tests assert the actual
  privilege/trigger/column outcomes against a live local database via the
  established `tests/db/helpers` harness (GUC role-switching, rolled-back
  transactions). Node unit tests cover the pure parity-checker functions.
- Assumption: the local live schema dump at
  `/tmp/nabaperks-live-public-schema-audit.sql` and the RPC-to-role mapping
  are accurate as of 2026-07-10; the implementer re-confirms the allowlist
  against live code before writing the regrant list.

## 4. Decisions Already Made

- Three defects, four migrations, one spec — they share a blast radius
  (privileges + schema on the same tables) and must ship and be proven as one
  reconciliation. Do not split.
- Containment strategy is **revoke-then-allowlist**, not patch-by-patch:
  `revoke execute on all functions in schema public from public, anon,
  authenticated`; `alter default privileges ... revoke execute ... from
  public` (belt-and-braces against future `create function` defaults);
  `grant execute on all functions in schema public to service_role`; then an
  explicit per-signature `grant execute ... to authenticated` allowlist.
- Billing-state protection is a **BEFORE UPDATE trigger**, not a column
  privilege grant alone — column privileges do not exist for the fine-grained
  "owner may edit business_name but not requires_billing" split cleanly under
  the existing broad table grant, and a trigger gives an auditable raise with
  a clear message. The trigger is additive to the existing RLS policy.
- The lost migration is **restored at its original version** (`20260710095000`)
  with **fresh-safe content**, NOT resurrected verbatim. Restoring the exact
  version is deliberate: the live ledger already carries `20260710095000`, so
  re-adding that version realigns `supabase migration list --linked` (otherwise
  it reports remote-only drift) while a live push skips the already-applied
  version. The original was a one-shot DO block that asserted exactly one
  candidate and would fail on a fresh database; the replacement is a re-runnable
  function with fresh-safe semantics: zero candidates → no-op, exactly one →
  repair, more than one → fail closed.
- Parity checker gains duplicate-version detection and edited-applied
  detection **as pure exported functions with unit tests**; it does not gain
  full ACL/column/function-body diffing (that is a heavier live-introspection
  tool deferred to the tooling wave). The edited-applied check compares the
  committed migration files against `origin/main` content hashes and treats a
  changed already-applied file as a failure unless paired in a sanctioned-edit
  ledger.
- Prod application is **owner-owed**, not performed here. This spec proves the
  migrations on a disposable/local database; the session has no prod
  credentials and prod `supabase db push` per migration stays with the owner.

## 5. Behavioral Requirements (EARS)

- THE rpc-containment migration SHALL revoke EXECUTE on all `public`-schema functions from `public`, `anon`, and `authenticated`.
- THE rpc-containment migration SHALL alter default privileges in schema `public` to revoke EXECUTE on functions from `public`, `anon`, and `authenticated`.
- THE rpc-containment migration SHALL grant EXECUTE on all `public`-schema functions to `service_role`.
- THE rpc-containment migration SHALL grant EXECUTE to `authenticated` only on the confirmed user-token RPC allowlist plus the RLS policy-helper functions.
- IF a session whose role is `anon` or `authenticated` attempts to execute a `public` function outside the allowlist, THEN THE database SHALL deny execution with insufficient-privilege.
- WHEN `admin_purge_stale_customer_pii` is invoked by any role other than `service_role`, THE function SHALL raise and perform no anonymisation.
- THE merchant-business-state migration SHALL install a BEFORE UPDATE trigger on `public.merchants` that raises when a non-privileged session changes `requires_billing` or `status`.
- WHEN `service_role` or an internal-admin session updates `merchants.requires_billing` or `merchants.status`, THE trigger SHALL allow the change.
- IF an ordinary merchant owner updates `merchants.requires_billing` or `merchants.status` directly, THEN THE trigger SHALL raise and leave both columns unchanged.
- WHILE a merchant owner updates non-protected columns such as `business_name`, THE trigger SHALL allow the update.
- THE email-hmac reconciliation migration SHALL add `customers.email_hmac` if it does not exist and create its partial index if it does not exist, without error on a database that already has them.
- THE legacy-seed bridge migration SHALL delete exactly one superseded production-seed signup event when exactly one qualifying candidate exists, no-op when zero candidates exist, and raise without deleting when more than one candidate exists.
- WHEN two local migration files share one 14-digit version, THE parity checker SHALL report a duplicate-version failure.
- IF an already-applied migration file's committed content differs from its `origin/main` content and the change is not recorded as a sanctioned edit, THEN THE parity checker SHALL report an edited-applied-migration failure.

## 6. Verification Criteria and Task Breakdown

Observable outcomes to verify:

- Under a rolled-back transaction with `set role authenticated`, calling an
  off-allowlist function (e.g. `claim_due_notification_events`,
  `enqueue_notification_event`, `admin_purge_stale_customer_pii`) raises
  `permission denied`; calling an on-allowlist function (e.g.
  `save_loyalty_card`, `is_merchant_owner`) does not raise on privilege
  grounds. Under `set role service_role` all of them are executable on
  privilege grounds.
- `admin_purge_stale_customer_pii` invoked as `authenticated` raises before
  touching any customer row.
- As an owner session, `update merchants set requires_billing = false` and
  `update merchants set status = 'active'` both raise; `update merchants set
  business_name = '...'` succeeds; as `service_role` all three succeed.
- After replaying the chain on a fresh database, `customers.email_hmac` and
  `customers_email_hmac_idx` exist; replaying the whole chain a second time
  (`supabase db reset` twice) errors nowhere.
- The bridge migration's three cardinalities (0 / 1 / >1 candidates) behave as
  specified against seeded fixtures.
- `check-supabase-migrations.mjs` pure functions flag a duplicate version and
  an unsanctioned applied-file edit; `pnpm smoke:supabase:migrations` still
  passes on the real aligned tree.

Task breakdown (implement one at a time, red → green → refactor; run the
narrowest `tests/db` / `tests/unit` file per task, then the full recorded gate
floor at the lifecycle boundary):

1. `tests/db/rpc-execute-privilege-containment.test.mjs` red, then migration
   `20260711090000` green: revoke, default-privileges, service_role grant,
   authenticated allowlist, destructive-RPC self-guards.
2. `tests/db/merchant-business-state-protection.test.mjs` red, then migration
   `20260711091000` green: BEFORE UPDATE trigger with privileged-writer bypass.
3. `tests/db/live-schema-reconciliation.test.mjs` red, then migrations
   `20260711092000` (email_hmac) and `20260710095000` (seed bridge) green.
4. `tests/unit/check-supabase-migrations.test.mjs` red, then extend
   `scripts/check-supabase-migrations.mjs` with duplicate-version and
   edited-applied detection as pure exported functions.
5. Fresh-DB rehearsal: `supabase db reset` twice, `pnpm test:db`, ACL/column
   readback; record with `governance:run-gates --spec
   MS-db-emergency-containment --record` and advance the lifecycle with
   `governance:advance`.
