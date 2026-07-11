---
spec_id: MS-customer-join-ledger-recovery
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/join-ledger-recovery.md
  - micro-specs/evidence/MS-customer-join-ledger-recovery.json
  - supabase/migrations/20260713100000_customer_join_ledger_recovery.sql
  - app/m/[merchantSlug]/join/actions.ts
  - app/card/[membershipId]/actions.ts
  - app/dev/home-harness/referral-bank/page.tsx
  - components/customer/customer-card-experience.tsx
  - components/customer/join-first-stamp-recovery-panel.tsx
  - lib/customer/join-first-stamp-recovery.ts
  - lib/customer/experience/load-card.ts
  - lib/customer/experience/derive.ts
  - lib/customer/experience/types.ts
  - tests/unit/customer-experience-card.test.mjs
  - tests/db/customer-join-first-stamp-recovery.test.mjs
  - tests/micro-specs/customer-join-ledger-recovery.test.mjs
  - tests/e2e/customer-join-pending-stamp/visual.spec.ts
implementation_surfaces:
  - supabase/migrations/20260713100000_customer_join_ledger_recovery.sql
  - app/m/[merchantSlug]/join/actions.ts
  - app/card/[membershipId]/actions.ts
  - app/dev/home-harness/referral-bank/page.tsx
  - components/customer/customer-card-experience.tsx
  - components/customer/join-first-stamp-recovery-panel.tsx
  - lib/customer/join-first-stamp-recovery.ts
  - lib/customer/experience/load-card.ts
  - lib/customer/experience/derive.ts
  - lib/customer/experience/types.ts
  - tests/unit/customer-experience-card.test.mjs
  - tests/db/customer-join-first-stamp-recovery.test.mjs
  - tests/micro-specs/customer-join-ledger-recovery.test.mjs
  - tests/e2e/customer-join-pending-stamp/visual.spec.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/join.md
  - micro-specs/db/emergency-containment.md
related_tests:
  - tests/db/customer-join-first-stamp-recovery.test.mjs
  - tests/micro-specs/customer-join-ledger-recovery.test.mjs
  - tests/e2e/customer-join-pending-stamp/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-customer-join-ledger-recovery"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Fresh and replayed database proof that recovery state remains idempotent.
  - Browser and database readback showing a failed first stamp survives refresh and resolves to exactly one stamp after a safe retry.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-join-ledger-recovery — Customer join RPC containment and first-stamp recovery

## 1. Exact Goal and User-Visible Outcomes

Joining through a valid QR never leaves a customer in unexplained limbo. Membership creation may survive a blocked first stamp, but the reason and safe next action are durable, customer-owned, and retryable without duplicate stamps.

## 2. Blast Radius

This spec owns one forward-only migration for durable first-stamp recovery, the server adapters/actions that read and retry it, normalized recovery facts in the card loader, and focused DB/browser tests. It does not own RPC privilege containment, join presentation, OTP, referrals, normal later-cycle stamping, reward redemption, or production migration application.

## 3. Strict Constraints and Assumptions

- Existing applied migrations are immutable; all database changes are forward-only and replay-safe.
- Membership creation remains resilient when first-stamp issuance fails.
- Recovery authority comes from the current signed customer session and server-stored QR context, never a client-supplied customer id or display reason.
- Retry is time-bounded, ownership-checked, billing/QR/card revalidated, and protected by existing UK-business-day uniqueness.
- Persisted reason values are a closed vocabulary; raw SQL messages are never returned to the browser.
- Referral settlement and reward-pool invariants must remain unchanged.

## 4. Decisions Already Made

- A failed first stamp does not roll back a valid membership.
- Recovery state is durable database state, not a query-string boolean.
- Retryable transient/rate-limit failures may offer a bounded retry; invalid QR requires a rescan; billing or reward-pool conditions require venue action.
- A completed or already-issued first stamp resolves the recovery record idempotently.
- The application continues to use service-role RPC calls after deriving customer identity from the signed session.

## 5. Behavioral Requirements (EARS)

- WHEN membership creation succeeds but first-stamp issuance fails, THE transaction SHALL retain the membership and persist one customer-owned recovery record with a typed reason, resolution class, attempt time, and bounded retry window.
- THE join RPC SHALL return the typed first-stamp outcome without exposing raw SQL text.
- WHEN the customer reloads the card or opens it on another signed-in device, THE card loader SHALL derive the same unresolved recovery state from the database.
- IF the recovery resolution is retry and the retry window remains open, THEN the current customer SHALL be able to retry through a server action that revalidates ownership, QR, card, merchant, billing, reward pool, and UK business date.
- IF recovery requires rescan or venue action, THEN the system SHALL refuse a futile automatic retry.
- WHEN retry succeeds or the stamp already exists, THE system SHALL resolve the recovery record and SHALL leave exactly one earned stamp for that membership and UK business date.
- IF a foreign or anonymous caller supplies a membership id, THEN the retry path SHALL reveal no recovery or membership facts and perform no mutation.
- WHEN the migration is replayed, THE schema, ACL, and function behavior SHALL remain unchanged.

## 6. Verification Criteria and Task Breakdown

1. Add failing live-DB proof for a deterministic join-first-stamp failure that commits membership plus typed recovery evidence.
2. Add failing DB proof for retry success, retry expiry, foreign ownership, non-retryable reasons, and duplicate/replay safety.
3. Implement the forward-only schema/RPC repair and server-only recovery adapter without changing normal join or referral success.
4. Add card-loader facts and a browser test that proves the pending state survives refresh, retries safely, and resolves to one stamp.
5. Replay the migration on a disposable database, run every gate, record evidence, and advance only with zero DB skips.
