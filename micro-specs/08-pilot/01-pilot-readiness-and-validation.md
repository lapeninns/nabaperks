---
spec_id: MS-PILOT-READINESS-VALIDATION
status: active
risk_class: product-analytics
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/admin/pilot/**
  - docs/**
  - lib/admin/pilot-report*.ts
  - lib/merchant/dashboard*.ts
  - micro-specs/**
  - micro-specs/08-pilot/01-pilot-readiness-and-validation.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
implementation_surfaces:
  - app/admin/pilot/**
  - lib/admin/pilot-report*.ts
  - lib/merchant/dashboard*.ts
  - docs/**
  - micro-specs/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/analytics-dashboard-pilot.test.ts
  - tests/micro-specs/perf-rpc-consolidation.test.ts
  - manual:billing/admin micro-spec Vitest evidence in retained legacy filename
  - tests/micro-specs/admin-console-redesign.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm test:coverage
approved_exceptions: []
---

# Micro-Spec: Pilot Readiness and Validation

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

Nabaperks is ready to run a 60-90 day pilot with 10-20 UK local businesses and measure whether merchants launch, customers scan, staff use the flow, rewards redeem, and merchants are willing to pay GBP 29/month after the trial.

## Blast Radius

In scope:

- Pilot readiness checklist.
- Pilot reporting dashboard or admin report.
- Merchant setup/training materials surfaced in product where needed.
- Event and metric readback for pilot targets.
- Support workflow for pilot merchants.

Out of scope:

- Broad public launch.
- Complex sales CRM.
- Multi-region expansion plan.
- Discount ladders beyond the approved pilot offer.

## Strict Constraints and Assumptions

- Pilot size is 10-20 businesses.
- Recommended mix: 6-8 cafes, 3-5 dessert/bubble tea shops, 2-4 barbers/salons, 1-3 takeaways or quick-service food businesses.
- Pilot duration is 60-90 days.
- Pilot offer is first 30 days free, then GBP 29/month, no long-term contract.
- Product-market fit signal is merchants continuing after novelty period and agreeing to pay without heavy discounting.

## Decisions Already Made

Pilot success targets:

- Merchant setup time under 5 minutes.
- Staff training time under 3 minutes.
- QR scan to customer join conversion 40%+.
- First stamp to second stamp conversion 25%+.
- Active merchants after 30 days 70%+.
- Pilot merchants willing to pay 50%+.
- Trial-to-paid conversion 40-60%.
- Support tickets under 2 per merchant/month.
- Reward redemption disputes low.

## Behavioral Requirements

- **MS-PILOT-READINESS-VALIDATION-001** WHEN a merchant starts pilot onboarding, THE system SHALL support setup completion in under 5 minutes.
- **MS-PILOT-READINESS-VALIDATION-002** WHEN staff are trained, THE instructions SHALL be short enough to complete in under 3 minutes.
- **MS-PILOT-READINESS-VALIDATION-003** WHEN staff training is timed for pilot readiness, THE admin report SHALL store the proof as a structured audited note with a 1-3 minute duration.
- **MS-PILOT-READINESS-VALIDATION-004** WHEN pilot metrics are reviewed, THE report SHALL show launch, scan, join, repeat, redemption, support, and paid-conversion metrics.
- **MS-PILOT-READINESS-VALIDATION-005** WHEN paid pilot proof is reviewed, THE report SHALL count only active-billing merchants that also have source-of-truth launch, join, stamp, and redemption events.
- **MS-PILOT-READINESS-VALIDATION-006** WHEN a merchant cancels or declines payment, THE team SHALL be able to record cancellation reason or interview notes.
- **MS-PILOT-READINESS-VALIDATION-007** WHEN reward disputes occur, THE admin console SHALL expose reward, stamp, and audit history needed for support.
- **MS-PILOT-READINESS-VALIDATION-008** WHEN pilot results are exported or summarized, THE report SHALL distinguish source-of-truth event counts from estimates and interview notes.

## Verification Criteria

Acceptance criteria:

- End-to-end pilot path works for at least one test merchant from signup to paid billing.
- Self-service launch checks are audited and appear in the pilot readiness checklist.
- Paid pilot proof is backed by active billing state plus product-event evidence, not a manual claim.
- Pilot metrics are backed by Supabase product events.
- Merchant-facing setup and staff instruction surfaces exist.
- Admin/support has enough readback for disputes, QR issues, consent questions, and billing state.

Manual QA:

- Time a clean merchant setup from signup to QR download.
- Time a staff training walkthrough.
- Run full customer loop: scan, join, first stamp, second stamp, reward unlock, redemption.
- Generate or view pilot metrics for the test merchant.
- Record a support scenario and verify audit/event evidence.

Task breakdown:

- Define pilot checklist.
- Add pilot reporting metrics.
- Verify full merchant/customer/admin/billing loop.
- Prepare interview, timed training, payment-objection, and cancellation-reason capture.
