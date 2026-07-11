---
spec_id: MS-db-join-rpc-containment
status: implemented
risk_class: migrations
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/db/join-rpc-containment.md
  - micro-specs/evidence/MS-db-join-rpc-containment.json
  - supabase/migrations/20260713090000_repair_join_rpc_privileges.sql
  - tests/db/rpc-execute-privilege-containment.test.mjs
  - tests/micro-specs/customer-join-ledger-recovery.test.mjs
implementation_surfaces:
  - supabase/migrations/20260713090000_repair_join_rpc_privileges.sql
  - tests/db/rpc-execute-privilege-containment.test.mjs
  - tests/micro-specs/customer-join-ledger-recovery.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/db/emergency-containment.md
related_tests:
  - tests/db/rpc-execute-privilege-containment.test.mjs
  - tests/micro-specs/customer-join-ledger-recovery.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for every declared gate with zero DB skips.
  - Catalog readback and real invocation proof that PUBLIC, anon, and authenticated cannot execute either join/stamp wrapper while service_role can.
  - Disposable-database replay proof for the forward-only migration.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-db-join-rpc-containment — Restore customer join RPC privilege containment

## 1. Exact Goal and User-Visible Outcomes

Customer join and QR-stamp behavior remains unchanged through server actions, while no browser-facing database role can invoke either security-definer wrapper directly. The service-role server boundary remains the sole execution path.

## 2. Blast Radius

This spec owns one forward-only privilege-repair migration and the existing exhaustive ACL proof. It does not change function bodies, customer UX, OTP, membership/stamp semantics, referrals, RLS policies, or production deployment.

## 3. Strict Constraints and Assumptions

- Never edit an applied migration.
- Repair every live signature/overload of `join_customer_membership_with_first_stamp` and the QR-proof `issue_self_service_stamp` wrapper.
- Revoke before granting; PUBLIC, anon, and authenticated must hold no execute privilege.
- service_role must retain execute privilege.
- The migration is idempotent and safe on fresh replay and an already-migrated database.
- Existing user-JWT allowlisted functions remain untouched.

## 4. Decisions Already Made

- These wrappers are service-role-only because customer identity comes from the signed app session and server actions use the service-role client.
- Function-body ownership checks remain defence in depth, not a reason to widen EXECUTE.
- The exhaustive catalog test and direct role invocation are both required proof.

## 5. Behavioral Requirements (EARS)

- WHEN the remediation migration is applied, THE database SHALL revoke EXECUTE on every join wrapper and QR-proof stamp wrapper signature from PUBLIC, anon, and authenticated.
- THE database SHALL grant EXECUTE on those signatures only to service_role.
- IF PUBLIC, anon, or authenticated attempts to call either wrapper, THEN THE database SHALL reject the invocation before function execution.
- WHEN service_role calls the wrappers with valid inputs, THE existing behavior SHALL remain available.
- WHEN the migration is replayed, THE resulting privileges SHALL remain identical and no error SHALL occur.

## 6. Verification Criteria and Task Breakdown

1. Extend the existing exhaustive ACL test so both wrapper names are explicitly locked and direct authenticated invocation fails.
2. Observe the focused DB test fail against the current schema for the intended privilege reason.
3. Add the forward-only revoke/regrant migration without changing function bodies.
4. Apply and replay it locally, run the catalog and direct-invocation proof with zero skips, then run and record every declared gate.
