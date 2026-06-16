---
spec_id: MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS
status: active
risk_class: webhooks
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/admin/**
  - app/api/stripe/**
  - lib/admin/**
  - lib/customer/**
  - lib/security/**
  - micro-specs/07-observability-compliance/03-security-fraud-and-rate-limits.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
  - supabase/tests/**
implementation_surfaces:
  - lib/security/**
  - app/api/stripe/**
  - app/admin/**
  - lib/admin/**
  - lib/customer/**
  - supabase/migrations/**
  - supabase/tests/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/customer.test.ts
  - tests/micro-specs/self-service-stamping.test.ts
  - manual:billing/admin micro-spec Vitest evidence in retained legacy filename
  - tests/micro-specs/admin-console-redesign.test.ts
  - supabase/tests/tenant_isolation.sql
  - supabase/tests/reward_redemption_cycles.sql
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm security:verify
  - pnpm db:verify
approved_exceptions: []
---

# Micro-Spec: Security, Fraud, and Rate Limits

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

Nabaperks's MVP has baseline abuse protection for QR scans, soft GPS check attempts, stamp issuing, reward redemption, admin access, and Stripe webhooks. Legitimate merchants and customers can use the product quickly, while obvious fraud and unsafe access paths are blocked and logged.

## Blast Radius

In scope:

- Rate limits for QR scans, stamp issuing, auth-sensitive endpoints, and redemption attempts.
- Fraud flags for abnormal stamp/reward activity.
- Admin fraud review page support.
- Webhook signature verification checks.
- Audit logging for sensitive actions.
- Security-focused tests around access and mutation boundaries.

Out of scope:

- Full fraud machine-learning.
- Device fingerprinting unless explicitly approved.
- Sentry integration.
- SMS/WhatsApp abuse controls.

## Strict Constraints and Assumptions

- Soft GPS review is a known fraud signal and must be protected by rate limits and audit logs.
- Duplicate reward redemption must be impossible through normal and concurrent requests.
- QR codes can be disabled when compromised.
- Admin access requires RBAC and MFA before production.
- Runtime rate-limit buckets must use server-side durable storage rather than process-local memory.
- Service-role keys never reach client code.
- Input validation is required for all mutation endpoints.

## Decisions Already Made

Must-have controls:

- HTTPS.
- Supabase RLS.
- RBAC.
- Admin MFA.
- Rate limits.
- Audit logs.
- Service-role isolation.
- Stripe webhook verification.
- Input validation.
- Data minimisation.
- Supabase daily backups.
- PostHog Error Tracking/Logs, Sentry later if needed.

## Behavioral Requirements

- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-001** WHEN self-service stamp attempts are repeated too quickly, THE system SHALL rate-limit further attempts.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-002** WHEN QR scans or customer identity requests are rate-limited, THE system SHALL store hashed bucket keys in durable server-side storage.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-003** WHEN a customer requests multiple stamps inside the cooldown window, THE system SHALL reject duplicates.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-004** WHEN stamp volume is unusually high for a merchant or time window, THE system SHALL create a fraud flag for admin review.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-005** WHEN reward redemption is attempted concurrently, THE system SHALL allow at most one successful redemption.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-006** WHEN a QR code is disabled, THE system SHALL block future scan-to-join flows and keep historical scan data.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-007** WHEN admin MFA enforcement is enabled, THE system SHALL require a Supabase AAL2 session before serving internal admin routes or actions.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-008** WHEN an unauthorised role attempts a privileged action, THE system SHALL deny it and record a security-relevant audit event where appropriate.
- **MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS-009** WHEN a Stripe webhook signature is invalid, THE system SHALL reject the webhook without mutating billing state.

## Verification Criteria

Acceptance criteria:

- Stamp issuing and redemption attempts are rate-limited.
- QR scan and customer identity request limits survive serverless instance rotation.
- Duplicate redemption is prevented under repeated/concurrent attempts.
- Fraud flags appear for configured abnormal activity thresholds.
- Privileged server-only secrets are not available to client code.
- Security tests cover tenant isolation and role denial.

Manual QA:

- Trigger PIN rate limit.
- Attempt duplicate stamp inside cooldown.
- Attempt duplicate redemption from two sessions.
- Disable QR and confirm customer-facing block.
- Submit invalid Stripe webhook signature and confirm no data change.

Task breakdown:

- Define rate-limit and fraud thresholds for MVP.
- Implement enforcement around sensitive flows.
- Add fraud flag persistence and admin readback.
- Verify concurrent and unauthorized failure paths.
