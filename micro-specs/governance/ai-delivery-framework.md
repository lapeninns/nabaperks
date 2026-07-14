---
spec_id: MS-governance-ai-delivery-framework
status: active
risk_class: docs-tooling
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - .factory/skills/**
  - .env.example
  - .github/workflows/**
  - .lighthouserc.json
  - .zap/**
  - AGENTS.md
  - DESIGN.md
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
  - README.md
  - app/**
  - ai-governance-starter-kit/**
  - components/**
  - config/**
  - docs/architecture-flows/**
  - docs/product/**
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
  - stryker.conf.json
  - supabase/migrations/**
  - tests/db/**
  - tests/e2e/**
  - tests/load/**
  - tests/micro-specs/**
  - tests/support/**
  - tests/unit/**
  - tsconfig.json
  - vercel.json
implementation_surfaces:
  - .factory/skills/**
  - .factory/skills/ai-governance-starter-kit/SKILL.md
  - .env.example
  - .github/workflows/ci.yml
  - .github/workflows/nightly.yml
  - .lighthouserc.json
  - .zap/rules.tsv
  - AGENTS.md
  - DESIGN.md
  - ai-governance-starter-kit/install-ai-governance.mjs
  - ai-governance-starter-kit/CHANGELOG.md
  - ai-governance-starter-kit/.claude-plugin/plugin.json
  - ai-governance-starter-kit/skills/implement-micro-spec/SKILL.md
  - ai-governance-starter-kit/templates/Instructions_tdd.md
  - ai-governance-starter-kit/templates/AGENTS.md.template
  - ai-governance-starter-kit/templates/micro-specs/README.md
  - ai-governance-starter-kit/templates/scripts/advance-spec.mjs
  - ai-governance-starter-kit/templates/scripts/governance-gate-selection.mjs
  - ai-governance-starter-kit/templates/scripts/governance-rules.mjs
  - ai-governance-starter-kit/templates/scripts/governance-version.mjs
  - ai-governance-starter-kit/templates/scripts/run-governance-gates.mjs
  - ai-governance-starter-kit/templates/tests/micro-specs/advance-spec.test.mjs
  - ai-governance-starter-kit/templates/tests/micro-specs/governance-enforcement.test.mjs
  - ai-governance-starter-kit/templates/tests/micro-specs/governance-gate-selection.test.mjs
  - Instructions_MircroSpecsCreation.md
  - Instructions_tdd.md
  - README.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - config/bundle-budget.json
  - package.json
  - playwright.config.ts
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - scripts/check-bundle-size.mjs
  - scripts/check-governance.mjs
  - scripts/advance-spec.mjs
  - scripts/governance-constants.mjs
  - scripts/governance-io.mjs
  - scripts/governance-rules.mjs
  - scripts/governance-frontmatter.mjs
  - scripts/governance-gate-selection.mjs
  - scripts/governance-glob.mjs
  - scripts/governance-commands.mjs
  - scripts/run-playwright.mjs
  - scripts/run-governance-gates.mjs
  - stryker.conf.json
  - tests/db/card-stamp-display-dates.test.mjs
  - tests/db/reward-billing-moat.test.mjs
  - tests/db/governance-db.test.mjs
  - tests/e2e/governance-smoke.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/load/public-routes.js
  - tests/load/stamp-redeem-race.js
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/micro-specs/governance-gate-selection.test.mjs
  - tests/micro-specs/advance-spec.test.mjs
  - tests/support/server-only-stub.mjs
  - tests/unit/block-reasons.test.mjs
  - tests/unit/phone-pii.property.test.mjs
  - tests/unit/rate-limit-core.test.mjs
  - tests/unit/scanner.property.test.mjs
  - tests/unit/session-cookie-core.property.test.mjs
  - tests/unit/uk-calendar.test.mjs
  - tests/unit/uk-date.test.mjs
related_docs:
  - AGENTS.md
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/ai-governance-starter-kit.test.mjs
  - tests/micro-specs/governance-evidence.test.mjs
  - tests/micro-specs/governance-gate-selection.test.mjs
  - tests/db/governance-db.test.mjs
  - tests/db/card-stamp-display-dates.test.mjs
  - tests/db/reward-billing-moat.test.mjs
  - tests/e2e/governance-smoke.spec.ts
  - tests/e2e/visual.spec.ts
  - tests/micro-specs/governance-enforcement.test.mjs
  - tests/unit/block-reasons.test.mjs
  - tests/unit/phone-pii.property.test.mjs
  - tests/unit/rate-limit-core.test.mjs
  - tests/unit/scanner.property.test.mjs
  - tests/unit/session-cookie-core.property.test.mjs
  - tests/unit/uk-calendar.test.mjs
  - tests/unit/uk-date.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --grep "@governance"
  - pnpm test:a11y
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - pnpm tokens:check
  - pnpm claims:check
  - pnpm build
  - pnpm bundle:check
  - pnpm jsonld:check
required_playwright_projects:
  - chromium
  - mobile-safari
  - desktop-firefox
  - desktop-safari
evidence_required:
  - CI output for lint, typecheck, governance, node tests, coverage, Playwright governance e2e smoke, Playwright a11y smoke, Playwright visual smoke, token checks, claims checks, build, bundle budget, and JSON-LD checks.
  - The dedicated isolated `Lighthouse CI` job output and uploaded report for the unchanged route, category, paint, and total-blocking-time budgets. Lighthouse is intentionally not repeated at the end of this long governance bundle because shared-runner timing variance produced a false red while the isolated performance job passed the same revision and thresholds.
  - Governance checker output proving metadata, risk gates, docs drift, blast-radius rules, and safe gate-command parsing.
  - Live DB proof from pnpm test:db when SUPABASE_DB_URL is available; DB-free browser harnesses do not count as RLS, billing, webhook, or ledger proof.
  - Nightly workflow output for full cross-browser Playwright, Stryker mutation, k6 load checks, and ZAP full scan.
approved_exceptions:
  - "broad-blast-radius: the repo-wide governance framework spec deliberately owns the engine, docs, CI, and every governed surface (expires: 2026-10-05)"
---

# MS-governance-ai-delivery-framework

## Intent

Move the AI governance spine from documented guidance to an enforceable
repo-native delivery contract for future AI-led changes.

## Scope

In scope:

- Micro-Spec metadata, lifecycle, risk, verification, and evidence rules.
- Lifecycle-aware branch attribution for sequential Micro-Specs completed on
  one delivery branch.
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
- WHEN one delivery branch contains sequential governed changes, THE
  governance system SHALL retain attribution for an implemented, verified, or
  closed Micro-Spec only when that spec's machine evidence ledger is part of
  the same changed-file set, and SHALL restrict that retained ownership to the
  spec's declared implementation surfaces plus its own bookkeeping files.
- THE lifecycle CLI and standalone checker SHALL use the same attribution
  rule, so a branch accepted before gate execution cannot fail its embedded
  governance gate for a different ownership model.
- A historical implemented, verified, or closed Micro-Spec whose evidence
  ledger is absent from the current change set SHALL NOT grant permission to
  edit its old radius; merely touching its prose is insufficient, and draft or
  superseded specs SHALL never grant changed-file attribution.
- THE governance system SHALL reject CI/docs drift when
  `micro-specs/README.md` omits commands run by CI.
- THE governance system SHALL run active Micro-Spec gates through a repo-native
  runner without a shell.
- WHEN several Micro-Specs require proof at the same delivery boundary, THE
  governance runner SHALL accept repeatable explicit spec selections, execute
  their exact-command union once, and record only each spec's declared results
  in that spec's own evidence ledger.
- WHILE implementation is still converging, THE delivery workflow SHALL use
  requirement-focused tests for Red -> Green -> Refactor and SHALL reserve a
  complete recorded gate run for a meaningful proof or lifecycle boundary,
  rather than requiring the complete suite after every Git commit.
- WHEN a lifecycle advance already executes and records the complete declared
  gates, THE delivery workflow SHALL treat that advance as the proof boundary
  and SHALL NOT require an identical recorded pre-run.
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
- `pnpm test:coverage`
- `pnpm test:e2e -- --grep "@governance"`
- `pnpm test:a11y`
- `pnpm test:visual`
- `pnpm tokens:check`
- `pnpm claims:check`
- `pnpm build`
- `pnpm bundle:check`
- Dedicated isolated `Lighthouse CI` workflow job (`pnpm lighthouse`)
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
