---
spec_id: MS-production-release-controls
status: active
risk_class: docs-tooling
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/production/**
  - micro-specs/README.md
  - .github/workflows/ci.yml
  - vercel.json
  - package.json
  - scripts/check-env.mjs
  - tests/micro-specs/production-release-controls.test.mjs
implementation_surfaces:
  - micro-specs/README.md
  - .github/workflows/ci.yml
  - vercel.json
  - package.json
  - scripts/check-env.mjs
  - tests/micro-specs/production-release-controls.test.mjs
related_tests:
  - tests/micro-specs/production-release-controls.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - manual:github-branch-protection
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-release-controls — Production release gates and deployment controls

## 1. Exact Goal and User-Visible Outcomes

Every production deployment is built only from a commit whose repository gates
passed, and Vercel validates the real hosted environment contract before it can
publish that commit. Production customer-OTP bypasses cannot survive the build
boundary, and protected `main` cannot be updated without the required review and
status checks.

## 2. Blast Radius

In scope: the hosted environment-profile resolver, the Vercel build command,
the main CI environment-contract gate, package-script wiring, governance-index
command parity, focused source contracts, this spec, its evidence ledger, and
the external GitHub `main` branch-protection settings proved by manual
attestation.

Out of scope: provider credential values, Supabase schema, application routes,
UI behavior, Stripe live-mode configuration, preview/staging provider setup,
and Vercel production promotion of this branch.

## 3. Strict Constraints and Assumptions

- Secret values never enter source, logs, evidence ledgers, or test fixtures.
- `CUSTOMER_OTP_BYPASS_MODE` and `CUSTOMER_DEV_OTP_CODE` remain local-only;
  hosted preview and production fail closed if either has a value.
- The existing environment contract remains the single source of required key
  names and visibility; the release gate does not fork a second key list.
- CI uses explicit non-secret fixtures and does not contact production
  providers.
- `main` keeps code-owner review, stale-review dismissal, linear history,
  conversation resolution, and force-push/deletion protection.
- Stripe stays out of this wave and is implemented last by user instruction.

## 4. Decisions Already Made

- `pnpm env:check` automatically chooses the production profile when
  `VERCEL_ENV=production`; explicit CLI profiles remain authoritative.
- Vercel runs environment validation before `pnpm build` for every hosted
  deployment. Preview validates the base hosted contract; production also
  enforces production-only keys.
- The CI build job runs the environment check before lint, governance, tests,
  and build, using safe fixture values that satisfy the same public/server
  visibility contract.
- GitHub required checks cover typecheck/build, DB, DB-free E2E, accessibility,
  visual regression, ZAP baseline, and CodeQL. Lighthouse remains informative
  because its workflow is explicitly non-blocking.
- Protection applies to administrators so a direct privileged push cannot
  bypass the release gate.

## 5. Behavioral Requirements (EARS)

- **RC-1:** WHEN `VERCEL_ENV` is `production` and no explicit profile is
  supplied, THE environment checker SHALL enforce the production profile.
- **RC-2:** IF a hosted preview or production environment configures either
  customer OTP bypass, THEN THE environment checker SHALL exit non-zero.
- **RC-3:** WHEN Vercel builds the app, THE build command SHALL complete the
  environment check before invoking the Next.js production build.
- **RC-4:** WHEN CI evaluates a release commit, THE build job SHALL validate
  the environment contract before the remaining repository gates.
- **RC-5:** WHILE `main` is protected, THE repository SHALL require code-owner
  approval, conversation resolution, linear history, administrator enforcement,
  and the selected release checks before update.
- **RC-6:** THE release-control tests SHALL prove production auto-profile,
  explicit-profile precedence, hosted bypass rejection, Vercel command order,
  and CI gate order without reading or emitting real secrets.

## 6. Verification Criteria and Task Breakdown

1. Add a failing source/CLI contract proving the current checker leaves a
   hosted production invocation on the default profile and the hosted build
   does not invoke the checker.
2. Make hosted profile selection explicit while preserving local/default and
   explicit CLI behavior; prove both bypass variables fail closed.
3. Put the environment gate before the Vercel and CI builds, using non-secret CI
   fixtures that exercise the complete production-required key set.
4. Update GitHub `main` protection through the authenticated API and read it
   back, recording only policy names and booleans.
5. Run and record the declared gates, attest the branch-protection readback,
   then advance this spec through implementation and verification.
