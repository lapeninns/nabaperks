---
spec_id: MS-customer-loyalty-terms-evidence
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/loyalty-terms-evidence.md
  - micro-specs/evidence/MS-customer-loyalty-terms-evidence.json
  - supabase/migrations/20260713110000_customer_loyalty_terms_evidence.sql
  - tests/db/customer-loyalty-terms-evidence.test.mjs
  - tests/micro-specs/customer-loyalty-terms-evidence.test.mjs
  - tests/e2e/customer-join-live-db.spec.ts
implementation_surfaces:
  - supabase/migrations/20260713110000_customer_loyalty_terms_evidence.sql
  - tests/db/customer-loyalty-terms-evidence.test.mjs
  - tests/micro-specs/customer-loyalty-terms-evidence.test.mjs
  - tests/e2e/customer-join-live-db.spec.ts
related_tests:
  - tests/db/customer-loyalty-terms-evidence.test.mjs
  - tests/micro-specs/customer-loyalty-terms-evidence.test.mjs
  - tests/e2e/customer-join-live-db.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "@MS-customer-loyalty-terms-evidence"
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-loyalty-terms-evidence — Durable customer loyalty terms evidence

## 1. Exact Goal and User-Visible Outcomes

Every successful membership has immutable, server-derived evidence of the loyalty terms accepted at join, independently of optional marketing consent.

## 2. Blast Radius

This spec owns one forward-only terms-evidence table and the current five-argument join-membership function definition plus focused DB/source/browser proof. It does not change terms copy, marketing consent, referral settlement, first-stamp recovery, or customer identity.

## 3. Strict Constraints and Assumptions

- Existing migrations remain immutable and the new migration is replay-safe.
- Acceptance evidence is inserted in the membership transaction and failure rolls back the join.
- Merchant, card, QR, policy version, and terms snapshot come from server/DB authority.
- Marketing opt-in remains optional and stored separately in `consent_records`.
- The evidence table is service-role-only and has no customer-facing raw SQL surface.

## 4. Decisions Already Made

- Store an append-only row per membership and policy version.
- Store every displayed venue-terms section, including stamp threshold, timing, exclusions, fraud/location policy, and contact guidance, plus a SHA-256 digest for durable comparison.
- Replaying the same membership and version is idempotent; a new version appends history.

## 5. Behavioral Requirements (EARS)

- WHEN membership join succeeds, THE transaction SHALL append loyalty-terms acceptance evidence even when marketing is declined.
- THE evidence SHALL reference the customer, merchant, membership, loyalty card, optional QR row, accepted time, policy version, source, authoritative terms snapshot, and digest.
- IF the same membership accepts the same policy version again, THEN THE ledger SHALL retain one row.
- WHEN a later policy version is accepted, THE ledger SHALL preserve both versions.
- IF evidence cannot be inserted, THEN membership creation SHALL not commit.
- THE evidence table and join function SHALL be executable only through the established service-role path.

## 6. Verification Criteria and Task Breakdown

1. Prove marketing-off join still writes terms evidence and no marketing consent row.
2. Prove same-version replay is idempotent and changed-version acceptance appends.
3. Prove snapshot values are DB-derived and ACLs remain service-role-only.
4. Tag the existing QR join browser narrative and verify membership, evidence, and stamp commit together.
5. Run and record every gate before lifecycle advancement.
