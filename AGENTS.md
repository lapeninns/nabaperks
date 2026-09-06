# Nabaperks Agent Guide

Nabaperks is a Next.js App Router loyalty product backed by Supabase, Stripe,
Resend, Twilio, Web Push, and Vercel. This file is intentionally lightweight:
it gives autonomous agents the commands and boundaries needed to work safely
without imposing a separate planning methodology.

## Start and verify

From a fresh clone:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm env:check
pnpm dev
```

Use the smallest relevant check while iterating, then run the repository gate:

```bash
pnpm quality:fast   # lint, typecheck, contract tests, and unit tests
pnpm quality:check  # plus dead code, duplication, debt, and docs
pnpm build          # production Next.js build
```

Database and browser proof are separate because they require real services:

```bash
pnpm test:db
pnpm test:e2e
pnpm test:a11y
pnpm test:visual
```

Live GitHub governance is a separate provider readback and intentionally fails
until every protected-environment credential and independent reviewer exists:

```bash
pnpm ops:github:check
```

Vercel governance is also a live, non-decrypting provider readback. It checks
the Git connection and security settings, custom staging target, cron parity,
blocking deployment checks, and environment-variable names/scopes:

```bash
pnpm ops:vercel:check
```

Supabase governance reads project, migration-ledger and physical-backup metadata
without printing database credentials. It intentionally fails until production
is source-aligned and PITR-backed:

```bash
pnpm ops:supabase:check
```

## Local CI execution plane

`ops/local-ci/` runs CI lanes on an operator's Mac inside a Lima VM and
publishes the outcome through a GitHub App. The advisory observer is in
`.github/workflows/local-ci-shadow.yml`, separate from `CI`: it reads once with
`LOCAL_CI_OBSERVE_ONCE=true` and has a two-minute job timeout. Missing or pending
proof is observational, never a passing local test result or merge authority.
`config/local-ci-contract.json` owns agent policy; the workflows own hosted
placement. `Release gate` requires all nine hosted roots: `fast`, `quality`,
`build`, `e2e`, `a11y`, `visual`, `lighthouse`, `zap-baseline` and `db`.

```bash
pnpm ops:ci:agent          # one-shot: --profile <pr|main|nightly> --sha <sha>
pnpm ops:ci:agent:watch    # the long-running poll loop launchd starts
pnpm ops:ci:nightly-proof  # fail when the newest nightly proof is stale
```

Two boundaries are enforced in code rather than by convention:

- Fork code never reaches the VM. `ops/local-ci/core/allowlist.mjs` admits work
  only when the head repository equals the contract's allowed repository by
  exact string comparison, so a fork pull request stays on the hosted plane.
- Host secrets never enter a job container. `ops/local-ci/core/job-env.mjs`
  builds each job environment from a passthrough allowlist plus reviewed profile
  values, then asserts that no host-secret name or credential-shaped host value
  survived.

`LOCAL_CI_MODE` controls observation, not host-service startup or merge
requirements. Installing the host service starts its poll loop independently;
resuming a paused watcher is a separate operational action. Local execution and
App publication remain advisory. Database promotion still requires successful
whole exact-main CI and CodeQL, followed by protected release proof.

Read `docs/operations/ci-redesign.md` for the current phased redesign and
`docs/operations/local-ci.md` for host operations. The historical
`docs/operations/local-ci-cutover.md` is superseded: do not promote local proof
by flipping its variables or contract fields. Future local authority needs
separately reviewed isolation, trusted verification and equivalent fallback.

## Repository boundaries

- `app/` owns routes, layouts, route handlers, and server actions.
- `components/` owns reusable UI and must not create Supabase server clients.
- `lib/` owns domain logic, service adapters, and trust-boundary helpers.
- `supabase/` owns migrations, seeds, RLS, and database RPCs.
- `ops/` owns operator tooling that runs outside the deployed app, currently the
  local CI execution plane in `ops/local-ci/`.
- `tests/` separates source contracts, unit behavior, live database proof, and
  Playwright journeys.
- `docs/operations/agent-readiness.md` maps the autonomous-readiness controls.
- `docs/api/openapi.json` is the source for generated API documentation.

Server state is authoritative. Browser storage is a cache only. Loyalty,
billing, reward, identity, and consent mutations must remain server-side and
auditable. Browser-only proof cannot substitute for DB/RLS/webhook proof.

## Naming and structure

- Use `camelCase` for variables and functions.
- Use `PascalCase` for React components and TypeScript types.
- Use `SCREAMING_SNAKE_CASE` for module constants.
- Use kebab-case filenames and route segments.
- Preserve `snake_case` at PostgreSQL and external payload boundaries; map it
  to application names only after the boundary is parsed.
- Prefer named exports except where Next.js requires a default export.
- Keep TypeScript strict, avoid `any`, and narrow `unknown` at boundaries.
- Keep production TypeScript files below the ESLint line budget and refactor
  branch-heavy logic before it exceeds the configured complexity ceiling.

## Product and operations rules

- Preserve the Wet Ink system in `DESIGN.md`, `app/globals.css`, and shared
  brand/UI components when visual work is in scope.
- Keep copy in plain British English. Avoid invented product or venue claims.
- Treat `.env.example` and `config/env-contract.json` as a synchronized pair.
- Link TODO/FIXME debt markers to an issue, such as `TODO(#123)`.
- Update `docs/api/openapi.json` when an externally consumed HTTP contract
  changes, then run `pnpm docs:generate`.
- For incidents and production checks, follow
  `docs/operations/incident-response.md` and
  `docs/operations/production-runbook.md`.

## Before handing off

Report which checks ran, which service-backed checks were unavailable, and the
exact remaining worktree state. Do not claim production/provider readiness from
local source alone.
