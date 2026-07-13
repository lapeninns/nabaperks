---
spec_id: MS-production-ci-e2e-isolation
status: implemented
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-13
allowed_blast_radius:
  - micro-specs/production/**
  - micro-specs/README.md
  - .github/workflows/ci.yml
  - tests/micro-specs/pr97-ci-recovery.test.mjs
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - micro-specs/README.md
  - .github/workflows/ci.yml
  - tests/micro-specs/pr97-ci-recovery.test.mjs
  - tests/micro-specs/production-release-controls.test.mjs
related_tests:
  - tests/micro-specs/pr97-ci-recovery.test.mjs
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

# MS-production-ci-e2e-isolation — Isolate long-running browser CI servers

## 1. Exact Goal and User-Visible Outcomes

The production pull-request browser gate completes without a Next.js dev-server
memory restart interrupting an active browser navigation, while retaining the
full Chromium, mobile Safari, desktop Firefox, and desktop Safari matrix.

## 2. Blast Radius

Only the CI workflow, current verification-gate index, the existing CI-recovery
source-contract test, and this Micro-Spec may change. Product behavior,
Playwright assertions, browser coverage, retry policy, and release-gate
strictness are out of scope.

## 3. Strict Constraints and Assumptions

- Keep all four existing Playwright projects release-blocking.
- Keep `failOnFlakyTests` enabled in CI; do not convert infrastructure restarts
  into accepted retries.
- Each project invocation must own a fresh Next dev-server process and isolated
  `.next-e2e` output lifecycle.
- Do not raise Node heap limits or suppress Next.js memory warnings.

## 4. Decisions Already Made

- The CI artifact proved the Next dev server crossed its heap threshold and
  restarted while WebKit was loading `/dev/poster-preview`.
- The restart caused connection-reset/refused responses for all CSS and JS;
  the post-restart retry passed.
- The E2E job remains one required branch-protection context, with four
  sequential project-specific Playwright invocations.

## 5. Behavioral Requirements (EARS)

- **CI-1:** WHEN the DB-free browser gate runs, THE workflow SHALL invoke each required Playwright project separately so every project receives a fresh Next dev-server lifetime.
- **CI-2:** THE workflow SHALL retain Chromium, mobile Safari, desktop Firefox, and desktop Safari coverage.
- **CI-3:** IF any project reports a flaky or failing test, THEN THE single required E2E job SHALL fail.

## 6. Verification Criteria and Task Breakdown

1. Add a failing source-contract assertion that rejects a single multi-project
   E2E invocation and requires all four project-specific invocations.
2. Split the E2E workflow into four sequential steps without changing the job
   name, project list, grep filter, or failure behavior.
3. Run and record every declared gate, then advance to implemented.
