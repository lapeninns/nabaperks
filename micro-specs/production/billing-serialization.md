---
spec_id: MS-production-billing-serialization
status: verified
risk_class: migrations
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/production/**
  - supabase/migrations/20260713190000_serialize_billing_entitlement.sql
  - tests/db/architecture-moat.test.mjs
  - micro-specs/production/billing-serialization.md
implementation_surfaces:
  - supabase/migrations/20260713190000_serialize_billing_entitlement.sql
  - tests/db/architecture-moat.test.mjs
  - micro-specs/production/billing-serialization.md
related_tests:
  - tests/db/architecture-moat.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm governance:check
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-billing-serialization — Serialize billing entitlement with Stripe state

## 1. Exact Goal and User-Visible Outcomes

When Stripe billing state and a loyalty value movement overlap, they serialize
on the same merchant lock so no stamp, reward issue, or redemption can commit
after an earlier-ordered billing lapse.

## 2. Blast Radius

In scope: one forward-only migration that replaces the stamp and reward
entitlement trigger functions, a two-connection database race proof, and this
record. Out of scope: Stripe products, prices, webhooks, checkout UX, historical
reward rows, and the already-applied `20260713180000` migration.

## 3. Strict Constraints and Assumptions

- Use the exact `billing-state:<merchant-id>` transaction advisory-lock key
  already used by Stripe state application.
- Acquire the lock before reading `billing_customers` and retain the current
  fail-closed active/trialing rule.
- Keep trigger functions `security definer`, pinned to the existing search
  path, and unavailable to `public`, `anon`, and `authenticated`.
- The migration is additive, replay-safe, and safe for production application.
- The race proof uses independent database connections and authoritative row
  readback; timing-only evidence is insufficient.

## 4. Decisions Already Made

- Serialize loyalty transitions with Stripe state instead of adding a second
  billing-status cache or an application-layer mutex.
- The transaction that acquires the merchant advisory lock first defines the
  valid ordering. A loyalty transaction ordered first may complete; a billing
  lapse ordered first must block later loyalty value.
- Lock both stamp and reward trigger functions so every current RPC crosses the
  same concurrency boundary.

## 5. Behavioral Requirements (EARS)

- **BS-1:** WHEN a loyalty value transition begins, THE database SHALL acquire
  the merchant billing-state transaction lock before reading entitlement.
- **BS-2:** WHEN a billing lapse owns the lock first, THE database SHALL reject
  a concurrent later stamp, reward issue, or reward redemption after the lapse
  commits.
- **BS-3:** WHEN a loyalty transition owns the lock first while billing is
  active, THE billing update SHALL wait and both transactions SHALL commit in
  that serial order.
- **BS-4:** THE trigger functions SHALL preserve their security-definer, ACL,
  search-path, and replay contracts.

## 6. Verification Criteria and Task Breakdown

1. Reproduce the race with two database connections by holding the existing
   billing-state lock, committing `past_due`, and attempting a loyalty value
   transition concurrently.
2. Replace both entitlement trigger functions in a forward migration so they
   take the shared advisory transaction lock before status readback.
3. Prove the blocked transaction writes no stamp/reward/product ledger state
   and that a valid lock-first ordering remains possible.
4. Prove migration replay, function ACL, search path, and trigger bindings.
5. Record every declared gate and advance the machine-owned lifecycle.
