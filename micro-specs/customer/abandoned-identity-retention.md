---
spec_id: MS-customer-abandoned-identity-retention
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/abandoned-identity-retention.md
  - micro-specs/evidence/MS-customer-abandoned-identity-retention.json
  - supabase/migrations/20260713120000_abandoned_customer_identity_retention.sql
  - app/api/cron/privacy-retention/route.ts
  - tests/db/customer-abandoned-identity-retention.test.mjs
  - tests/micro-specs/customer-abandoned-identity-retention.test.mjs
  - tests/e2e/customer-abandoned-identity-retention.spec.ts
implementation_surfaces:
  - supabase/migrations/20260713120000_abandoned_customer_identity_retention.sql
  - app/api/cron/privacy-retention/route.ts
  - tests/db/customer-abandoned-identity-retention.test.mjs
  - tests/micro-specs/customer-abandoned-identity-retention.test.mjs
  - tests/e2e/customer-abandoned-identity-retention.spec.ts
related_tests:
  - tests/db/customer-abandoned-identity-retention.test.mjs
  - tests/micro-specs/customer-abandoned-identity-retention.test.mjs
  - tests/e2e/customer-abandoned-identity-retention.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "@MS-customer-abandoned-identity-retention"
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-abandoned-identity-retention — Abandoned verified identity retention

## 1. Exact Goal and User-Visible Outcomes

Verified phone identities abandoned before membership no longer retain customer PII and live sessions for a year, while customers with loyalty history remain protected by the existing retention policy.

## 2. Blast Radius

This spec owns one narrow service-role purge RPC, its cron invocation, and DB/browser proof. It does not shorten retention for memberships, stamps, rewards, referrals, consent, data requests, or pending reward invites, and it does not solve recycled-number ownership.

## 3. Strict Constraints and Assumptions

- Abandoned means no membership, stamp, reward, consent, referral, invite attachment, or open data request.
- The cutoff is seven days after verified identity creation or last update.
- Purge anonymizes contact/profile fields, revokes all customer sessions, disables push, and cancels queued notifications.
- The RPC self-guards service role and reveals aggregate count only.
- Existing 365-day historical-customer retention remains unchanged.

## 4. Decisions Already Made

- Use a separate narrow RPC instead of weakening `admin_purge_stale_customer_pii`.
- Seven days balances accidental abandonment recovery with data minimization.
- Cron runs abandoned purge before the existing historical purge and reports both aggregate counts.

## 5. Behavioral Requirements (EARS)

- WHEN a verified customer remains abandoned beyond seven days, THE retention job SHALL anonymize PII and revoke every active customer session.
- IF a customer has any loyalty, consent, referral, invite, or privacy-request record, THEN THE abandoned-identity purge SHALL leave the customer unchanged.
- IF join and purge target the same customer concurrently, THEN THE shared customer transaction lock and protected-history recheck SHALL prevent anonymizing the newly joined member.
- WHEN the RPC is replayed, THE already-anonymized customer SHALL not be counted again.
- IF a non-service-role caller invokes the RPC, THEN it SHALL fail without revealing candidate rows.
- THE cron response and logs SHALL expose aggregate counts only.

## 6. Verification Criteria and Task Breakdown

1. Prove an old membership-less verified identity is anonymized and its session revoked.
2. Prove recent identities and every protected-history category remain untouched.
3. Prove replay idempotency and service-role-only invocation.
4. Prove a browser session belonging to a purged disposable identity no longer authenticates.
5. Run and record every declared gate before lifecycle advancement.
