---
spec_id: MS-production-index-performance
status: active
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-13
allowed_blast_radius:
  - micro-specs/production/**
  - app/admin/layout.tsx
  - .github/workflows/ci.yml
  - .lighthouserc.json
  - tests/e2e/production-review-closure.spec.ts
implementation_surfaces:
  - app/admin/layout.tsx
  - .github/workflows/ci.yml
  - .lighthouserc.json
  - tests/e2e/production-review-closure.spec.ts
related_tests:
  - tests/e2e/production-review-closure.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --grep "@MS-production-index-performance"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-index-performance — Block private indexing and performance regressions

## 1. Exact Goal and User-Visible Outcomes

Private admin pages cannot be indexed, and production pull requests fail when
the public launch surfaces regress below explicit Lighthouse performance,
accessibility, best-practice, or SEO budgets on the mobile profile.

## 2. Blast Radius

The admin layout metadata, Lighthouse configuration, CI release job, one
focused browser test, and this Micro-Spec may change. Admin authorization,
page content, unrelated visual baselines, and application business logic are
out of scope.

## 3. Strict Constraints and Assumptions

- Preserve the Wet Ink UI and existing admin access control.
- Use Next.js 16 static metadata and the shared private-route contract.
- Lighthouse thresholds must be errors, not warnings, and the CI job must be
  release-blocking.
- Use the mobile Lighthouse profile and multiple runs to reduce single-sample
  noise without weakening the existing minimum scores or timings.

## 4. Decisions Already Made

- `/admin` uses the same `PRIVATE_ROUTE_METADATA` contract as `/app`.
- Lighthouse covers the four existing public acquisition URLs.
- Two mobile runs are the minimum stable release signal for this closure.

## 5. Behavioral Requirements (EARS)

- **IP-1:** WHEN any `/admin` route renders, THE document SHALL emit `noindex, nofollow` metadata.
- **IP-2:** WHEN Lighthouse evaluates the public launch URLs, THE collector SHALL use the mobile profile for at least two runs.
- **IP-3:** IF any declared Lighthouse category or timing budget fails, THEN THE pull-request CI job SHALL fail.

## 6. Verification Criteria and Task Breakdown

1. Add a focused browser assertion for `/admin` robots metadata.
2. Export the shared private-route metadata from the admin layout.
3. Make Lighthouse blocking, mobile-profiled, and multi-run with explicit
   error budgets.
4. Run and record every declared gate, then advance to implemented.
