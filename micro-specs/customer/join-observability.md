---
spec_id: MS-customer-join-observability
status: implemented
risk_class: product-analytics
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/join-observability.md
  - micro-specs/evidence/MS-customer-join-observability.json
  - proxy.ts
  - lib/analytics/funnel-token.ts
  - lib/customer/join-funnel.ts
  - lib/customer/join-observability-contract.ts
  - lib/customer/join-rpc-error.ts
  - lib/customer/experience/load-join.ts
  - lib/customer/experience/load-card.ts
  - lib/analytics/events.ts
  - lib/analytics/privacy-core.ts
  - lib/admin/pilot-report.ts
  - app/m/[merchantSlug]/join/actions.ts
  - app/m/[merchantSlug]/join/page.tsx
  - tests/unit/customer-join-observability.test.mjs
  - tests/unit/customer-join-rpc-error.test.mjs
  - tests/micro-specs/customer-join-observability.test.mjs
  - tests/e2e/customer-join-observability.spec.ts
implementation_surfaces:
  - proxy.ts
  - lib/analytics/funnel-token.ts
  - lib/customer/join-funnel.ts
  - lib/customer/join-observability-contract.ts
  - lib/customer/join-rpc-error.ts
  - lib/customer/experience/load-join.ts
  - lib/customer/experience/load-card.ts
  - lib/analytics/events.ts
  - lib/analytics/privacy-core.ts
  - lib/admin/pilot-report.ts
  - app/m/[merchantSlug]/join/actions.ts
  - app/m/[merchantSlug]/join/page.tsx
  - tests/unit/customer-join-observability.test.mjs
  - tests/unit/customer-join-rpc-error.test.mjs
  - tests/micro-specs/customer-join-observability.test.mjs
  - tests/e2e/customer-join-observability.spec.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/analytics/funnel-identity-privacy.md
  - micro-specs/customer/join-ledger-recovery.md
related_tests:
  - tests/unit/customer-join-observability.test.mjs
  - tests/unit/customer-join-rpc-error.test.mjs
  - tests/micro-specs/customer-join-observability.test.mjs
  - tests/e2e/customer-join-observability.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - First-party product-event readback with PostHog disabled proving the rendered join steps and success milestones remain durable and idempotent.
  - Privacy proof that no phone, OTP, QR public id, referral code, URL, IP, user agent, coordinate, or raw provider/database error crosses the product-event or PostHog boundary.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-join-observability — Durable customer join observability

## 1. Exact Goal and User-Visible Outcomes

Operators can measure the real customer journey from rendered join state through card arrival even when PostHog is disabled, while analytics never delays or breaks the customer’s tap path. Failures are distinguishable in structured logs without exposing customer PII or raw infrastructure details.

## 2. Blast Radius

This spec owns the existing join-funnel adapter, closed event/metadata contract, rendered-step instrumentation, join/card milestone scheduling, first-stamp outcome metrics, pilot-report readback, privacy projection, and focused tests. It does not change database first-stamp recovery writes, alert delivery, customer authorization, or core membership/stamp behavior.

## 3. Strict Constraints and Assumptions

- `product_events` is the first-party source of truth; PostHog is an optional pseudonymous mirror.
- Analytics is fail-open and registered with `after()` only after authoritative state transitions; customer page/action responses never await analytics delivery.
- Event identity is deterministic enough to make reload/replay idempotent without storing phone, OTP, QR public id, referral code, raw URL, IP, user agent, or provider identifiers.
- Step attribution comes from the rendered `CustomerExperience.kind`, never untrusted query strings.
- External analytics receives an explicit closed projection; arbitrary first-party metadata is never forwarded.
- Existing transactional `customer_joined` and `stamp_issued` rows remain authoritative and are not duplicated by app instrumentation.

## 4. Decisions Already Made

- Preserve event names `join_page_viewed`, `join_phone_requested`, `join_otp_verified`, `join_terms_accepted`, and `customer_card_viewed`; add explicit `join_first_stamp_issued` and `join_first_stamp_pending` outcome events.
- `join_phone_requested` means provider send and pending-state persistence succeeded.
- `join_otp_verified` means provider approval, customer resolution, session registration, and cookie persistence succeeded.
- `join_terms_accepted` is recorded only after the join RPC succeeds.
- `customer_card_viewed` requires a ready, owned card.
- Operational logs use stable codes such as `customer_join_context_failed`, `customer_join_rpc_failed`, and `customer_join_event_persist_failed`; customer-facing copy remains generic.

## 5. Behavioral Requirements (EARS)

- WHEN a join state is successfully rendered, THE system SHALL schedule one durable first-party page-view milestone using the derived state and entry type.
- WHEN OTP send, OTP verification, join completion, or first ready-card render succeeds, THE system SHALL schedule the matching durable milestone after the authoritative operation succeeds.
- IF the same semantic milestone is retried or rendered again for the same journey, THEN THE first-party ledger SHALL retain one idempotent row.
- IF product-event persistence or PostHog delivery fails, THEN THE customer page, action, redirect, membership, and stamp behavior SHALL remain unchanged.
- WHERE PostHog is enabled, THE mirror SHALL contain only reviewed enum properties and a pseudonymous identity; it SHALL exclude first-party correlation keys and raw identifiers.
- IF join context loading or the join RPC fails unexpectedly, THEN THE system SHALL emit a structured operational log with request correlation and stable operation/reason fields but no customer PII or raw provider/database body.
- THE system SHALL distinguish invalid/unavailable product state from infrastructure failure in operator evidence while preserving safe customer copy.

## 6. Verification Criteria and Task Breakdown

1. Add failing pure tests for the closed event contract, rendered-state mapping, deterministic idempotency, and external privacy projection.
2. Replace PostHog-only join captures with fail-open first-party persistence followed by the optional mirror, scheduled after responses.
3. Move page attribution after state derivation and align send/verify/terms milestones with confirmed success semantics.
4. Add structured logging at context and RPC failure boundaries with redaction assertions.
5. Prove the full event sequence with external analytics disabled, prove mirror suppression/redaction when enabled, run all gates, record evidence, and advance.
