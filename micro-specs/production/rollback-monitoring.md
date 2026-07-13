---
spec_id: MS-production-rollback-monitoring
status: active
risk_class: docs-tooling
owner: codex
last_reviewed: 2026-07-13
allowed_blast_radius:
  - micro-specs/production/**
  - .github/workflows/production-smoke.yml
  - docs/operations/production-runbook.md
  - docs/operations/incident-response.md
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - .github/workflows/production-smoke.yml
  - docs/operations/production-runbook.md
  - docs/operations/incident-response.md
  - tests/micro-specs/production-release-controls.test.mjs
related_tests:
  - tests/micro-specs/production-release-controls.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-rollback-monitoring — Keep rollback monitoring truthful

## 1. Exact Goal and User-Visible Outcomes

Scheduled production monitoring remains green after an intentional rollback,
while promotion-time verification still proves the exact deployed revision
and the runbooks define executable Stripe and incident-recovery acceptance.

## 2. Blast Radius

Only the production smoke workflow, production and incident runbooks, focused
release-control tests, and this Micro-Spec may change. Deployment code,
provider configuration, observability vendors, and rollback mechanics are out
of scope.

## 3. Strict Constraints and Assumptions

- Scheduled smoke always checks liveness and privileged readiness.
- Exact revision comparison remains mandatory for explicit promotion checks.
- Rollbacks to older healthy Vercel deployments are supported.
- Runbook acceptance must name observable commands/readbacks without exposing
  secrets or requiring an unimplemented metric.

## 4. Decisions Already Made

- `workflow_dispatch` accepts an optional expected revision; scheduled runs do
  not assume default-branch HEAD equals production.
- Recovery is proven by two successful scheduled probe intervals, not an
  undefined error-rate claim.
- Stripe acceptance covers live prices/product, portal, signed webhook
  delivery, durable DB ledger, and entitlement readback.

## 5. Behavioral Requirements (EARS)

- **RM-1:** WHEN the scheduled smoke runs, THE workflow SHALL check health and readiness without requiring production to equal default-branch HEAD.
- **RM-2:** WHEN an operator supplies an expected revision to a manual smoke run, THE workflow SHALL require the live revision to match it.
- **RM-3:** THE production runbook SHALL define executable live Stripe acceptance criteria for prices, portal, signed webhook delivery, durable ledger, and entitlement state.
- **RM-4:** THE incident runbook SHALL require two successful scheduled probe intervals and SHALL NOT claim an unmeasured error-rate threshold.

## 6. Verification Criteria and Task Breakdown

1. Add failing source-contract assertions for scheduled/manual revision
   semantics and the two runbook acceptance contracts.
2. Add optional manual expected-revision input and make the scheduled default
   availability-only.
3. Amend the production and incident runbooks with executable criteria.
4. Run and record every declared gate, then advance to implemented.
