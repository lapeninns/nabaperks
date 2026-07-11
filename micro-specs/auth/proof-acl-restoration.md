---
spec_id: MS-auth-proof-acl-restoration
status: closed
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/auth/proof-acl-restoration.md
  - micro-specs/evidence/MS-auth-proof-acl-restoration.json
  - tests/e2e/helpers/merchant-auth-recovery-live-db.ts
  - tests/micro-specs/auth-recovery-ux.test.mjs
implementation_surfaces:
  - micro-specs/auth/proof-acl-restoration.md
  - micro-specs/evidence/MS-auth-proof-acl-restoration.json
  - tests/e2e/helpers/merchant-auth-recovery-live-db.ts
  - tests/micro-specs/auth-recovery-ux.test.mjs
related_tests:
  - tests/e2e/merchant-auth-recovery.spec.ts
  - tests/e2e/merchant-auth-recovery.desktop.spec.ts
  - tests/db/rpc-execute-privilege-containment.test.mjs
  - tests/micro-specs/auth-recovery-ux.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-auth-recovery-ux"
  - pnpm test:db
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - A red local-Postgres containment run proving the existing auth fault-restoration path leaves enforce_rate_limit executable by PUBLIC, anon, and authenticated.
  - Source-contract output proving the helper restores the exact service_role-only ACL and cannot grant PUBLIC, anon, or authenticated.
  - Mobile and desktop local-Supabase auth-recovery output covering the rate-limit infrastructure-failure branch and suite cleanup.
  - A post-auth complete local-Postgres pass proving no public function is executable by PUBLIC or anon and authenticated retains only its allowlist.
approved_exceptions:
  - "evidence-waiver: the three mutually dependent audit-proof waves share one reviewed working tree and will ship atomically (expires: 2026-07-18)"
---

# MS-auth-proof-acl-restoration — Restore the auth proof RPC to service-role-only

## Why It Exists

The local merchant-auth fault harness restored `enforce_rate_limit` with a
broader ACL than the authoritative migrations, contaminating later database
proof. The application migration was already correct; the test helper needed to
converge cleanup to the same service-role-only state after every success,
failure, and suite teardown.

## Invariants

- The available cleanup path revokes PUBLIC, `anon`, and `authenticated`
  before granting execution only to `service_role`.
- The unavailable cleanup path revokes PUBLIC, `anon`, `authenticated`, and
  `service_role`.
- Cleanup runs only against explicitly opted-in loopback Supabase and Postgres
  services.
- Browser recovery proof covers provider, cooldown, invalid, expired, used,
  superseded, infrastructure-failure, and safe-continuation states.
- The complete catalog oracle retains no PUBLIC or `anon` executable function;
  `authenticated` remains limited to its explicit allowlist.
- No production database, customer identity, notification, or provider state is
  mutated by this local proof helper.

## Code Pointers

- `tests/e2e/helpers/merchant-auth-recovery-live-db.ts`
- `tests/micro-specs/auth-recovery-ux.test.mjs`
- `tests/db/rpc-execute-privilege-containment.test.mjs`
- `micro-specs/evidence/MS-auth-proof-acl-restoration.json`

## Dead Ends

- Changing the authoritative migration was rejected because catalog evidence
  showed it already enforced the intended ACL.
- Granting through PUBLIC as a shortcut was rejected because PostgreSQL PUBLIC
  membership widens execution to every role.
- Relying on suite success without post-suite catalog readback was rejected
  because the original contamination appeared only in later database tests.
- Swallowing cleanup failures was rejected; aggregate cleanup errors remain
  visible and the next local suite start converges the ACL again.
