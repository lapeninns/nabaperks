---
spec_id: MS-production-ci-chromium-pdf-isolation
status: draft
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-13
allowed_blast_radius:
  - micro-specs/production/**
  - .github/workflows/ci.yml
  - micro-specs/README.md
  - tests/micro-specs/pr97-ci-recovery.test.mjs
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - .github/workflows/ci.yml
  - micro-specs/README.md
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

# MS-production-ci-chromium-pdf-isolation — Isolate Chromium PDF generation in CI

## 1. Exact Goal and User-Visible Outcomes

The production pull-request browser gate completes without a long-lived
Chromium process crashing during native PDF generation, while retaining every
poster-print assertion and the full non-visual browser matrix.

## 2. Blast Radius

Only the CI workflow, current verification-gate index, the existing CI source-
contract tests, and this Micro-Spec may change. Product code, Playwright test
assertions, browser coverage, retry policy, and release-gate strictness are out
of scope.

## 3. Strict Constraints and Assumptions

- Keep poster-print coverage release-blocking and run it in Chromium.
- Keep `failOnFlakyTests` enabled in CI; do not accept a browser crash as a
  retry or flaky success.
- The general Chromium invocation must exclude exactly the poster-print suite
  already executed by the isolated invocation, so no test is run twice or
  omitted.
- Do not raise memory limits, pin an older browser, or weaken PDF assertions.

## 4. Decisions Already Made

- GitHub's artifact proves the Chromium headless-shell process received
  `SIGSEGV` while opening the Northstar PDF test context after the broader
  Chromium suite had been running for roughly nine minutes.
- The exact Northstar PDF path passed five consecutive fresh-process runs
  locally, so product behavior is not deterministically failing.
- Poster printing receives its own fresh Chromium and Next dev-server lifetime
  before the remaining Chromium suite.

## 5. Behavioral Requirements (EARS)

- **CI-1:** WHEN the DB-free browser gate starts, THE workflow SHALL run the complete poster-print suite in a dedicated Chromium invocation.
- **CI-2:** WHEN the general Chromium invocation runs, THE workflow SHALL exclude the poster-print suite already proven by CI-1.
- **CI-3:** THE workflow SHALL retain the existing mobile Safari, desktop Firefox, and desktop Safari invocations unchanged.
- **CI-4:** IF either Chromium invocation reports a flaky test, failed assertion, or browser crash, THEN THE single required E2E job SHALL fail.

## 6. Verification Criteria and Task Breakdown

1. Add a failing source-contract assertion that requires the isolated poster-
   print command and rejects poster-print execution in the general Chromium
   command.
2. Split Chromium into a poster-print invocation and the remaining non-visual
   invocation without changing the required E2E job or other projects.
3. Update the current gate index, run the focused contract tests, and advance
   the spec only after every declared gate passes.
