---
spec_id: MS-governance-ai-delivery-framework
status: active
risk_class: docs-tooling
owner: codex
last_reviewed: 2026-06-30
allowed_blast_radius:
  - .github/workflows/**
  - AGENTS.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
  - README.md
  - app/**
  - components/**
  - docs/architecture-flows/**
  - eslint.config.mjs
  - lib/**
  - next.config.ts
  - micro-specs/**
  - package.json
  - playwright.config.ts
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - proxy.ts
  - reports/architecture-audit/**
  - scripts/**
  - scripts/check-governance.mjs
  - scripts/governance-constants.mjs
  - scripts/governance-io.mjs
  - scripts/governance-rules.mjs
  - scripts/run-playwright.mjs
  - scripts/run-governance-gates.mjs
  - supabase/migrations/**
  - tests/db/**
  - tests/e2e/**
  - tests/micro-specs/**
  - tests/support/**
  - tests/unit/**
  - tsconfig.json
  - vercel.json
implementation_surfaces:
  - .github/workflows/ci.yml
  - AGENTS.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
  - README.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - package.json
  - playwright.config.ts
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - scripts/check-governance.mjs
  - scripts/governance-constants.mjs
  - scripts/governance-io.mjs
  - scripts/governance-rules.mjs
  - scripts/run-playwright.mjs
  - scripts/run-governance-gates.mjs
  - tests/db/governance-db.test.mjs
  - tests/e2e/governance-smoke.spec.ts
  - tests/micro-specs/governance-enforcement.test.mjs
related_docs:
  - AGENTS.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/db/governance-db.test.mjs
  - tests/e2e/governance-smoke.spec.ts
  - tests/micro-specs/governance-enforcement.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:e2e
  - pnpm test:a11y
  - pnpm test:visual
  - pnpm tokens:check
  - pnpm claims:check
  - pnpm build
  - pnpm jsonld:check
required_playwright_projects:
  - chromium
  - mobile-chromium
evidence_required:
  - CI output for lint, typecheck, governance, node tests, Playwright e2e, Playwright a11y smoke, Playwright visual smoke, token checks, claims checks, build, and JSON-LD checks.
  - Governance checker output proving metadata, risk gates, docs drift, blast-radius rules, and safe gate-command parsing.
  - Live DB proof from pnpm test:db when SUPABASE_DB_URL is available; DB-free browser harnesses do not count as RLS, billing, webhook, or ledger proof.
approved_exceptions: []
---

# MS-governance-ai-delivery-framework

## Intent

Move the AI governance spine from documented guidance to an enforceable
repo-native delivery contract for future AI-led changes.

## Scope

In scope:

- Micro-Spec metadata, lifecycle, risk, verification, and evidence rules.
- A Node governance checker and node:test coverage for its enforcement paths.
- CI wiring that runs the governance checker and active Micro-Spec gate runner
  automatically.
- Playwright package scripts, config, browser smoke coverage, a11y smoke, visual
  smoke, and CLI workflow guidance.
- A live-DB-only `test:db` harness that fails clearly without
  `SUPABASE_DB_URL`.

Out of scope:

- Product runtime behavior, Supabase schema, RLS/RPC logic, Stripe behavior,
  customer/merchant/auth flows, and Wet Ink runtime styling.
- Product-specific browser journeys beyond the public governance smoke.
- Running DB/RLS/billing/webhook proof without a real disposable Supabase
  database URL.

## EARS Requirements

- THE governance system SHALL reject Micro-Spec files that omit required
  metadata or use an unknown lifecycle status or risk class.
- THE governance system SHALL reject active Micro-Specs whose verification gates
  do not satisfy the risk-class matrix.
- THE governance system SHALL reject active browser-evidence specs that omit
  Playwright projects or related e2e/a11y/visual tests.
- THE governance system SHALL reject active DB/webhook/RLS/migration specs that
  omit DB behavioral gates.
- THE governance system SHALL reject changed files outside the active
  Micro-Spec allowed blast radius.
- THE governance system SHALL reject CI/docs drift when
  `micro-specs/README.md` omits commands run by CI.
- THE governance system SHALL run active Micro-Spec gates through a repo-native
  runner without a shell.
- THE browser harness SHALL expose Playwright CLI scripts for e2e, headed, UI,
  a11y, and visual smoke gates.
- THE DB harness SHALL require a live database URL and SHALL NOT treat static SQL
  inspection or browser-only proof as RLS, billing, webhook, or ledger evidence.

## Verification

Required gates:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm governance:check`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:a11y`
- `pnpm test:visual`
- `pnpm tokens:check`
- `pnpm claims:check`
- `pnpm build`
- `pnpm jsonld:check`

Status transition notes stay in this Micro-Spec. No tracked screenshot evidence
folders or generated planning packs are required for this docs-tooling change.

## Verification Log - 2026-06-30

Governance-specific evidence:

- `corepack pnpm governance:check` passed: 2 Micro-Spec files, 8 CI commands,
  13 changed files.
- `node --test tests/micro-specs/governance-enforcement.test.mjs` passed:
  metadata/CI contract, missing Playwright gate failure, and blast-radius failure
  paths.
- Targeted ESLint over the new governance scripts and test passed.
- `git diff --check` passed.

Repo-wide gates:

- `corepack pnpm typecheck` passed.
- `corepack pnpm tokens:check` passed.
- `corepack pnpm claims:check` passed.
- `corepack pnpm build` passed.
- `corepack pnpm jsonld:check` passed after build generated `.next`.
- `corepack pnpm lint` failed on pre-existing issues in `.design-sync/**` and
  `components/ui/sidebar.tsx`.
- `corepack pnpm test` failed on the pre-existing
  `tests/micro-specs/qr-a4-poster-templates.test.mjs` poster assertions.
- Follow-up implementation added `test:e2e`, `test:e2e:ui`,
  `test:e2e:headed`, `test:a11y`, `test:visual`, and `test:db` package
  scripts; the next verification pass must prove the browser gates and classify
  `test:db` as passed or blocked by missing `SUPABASE_DB_URL`.
