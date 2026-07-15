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
pnpm quality:check  # plus dead code, duplication, debt, flags, and docs
pnpm build          # production Next.js build
```

Database and browser proof are separate because they require real services:

```bash
pnpm test:db
pnpm test:e2e
pnpm test:a11y
pnpm test:visual
```

## Repository boundaries

- `app/` owns routes, layouts, route handlers, and server actions.
- `components/` owns reusable UI and must not create Supabase server clients.
- `lib/` owns domain logic, service adapters, and trust-boundary helpers.
- `supabase/` owns migrations, seeds, RLS, and database RPCs.
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
- Every feature flag needs an owner, expiry, runtime usage, and passing
  `pnpm flags:check` lifecycle validation.
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
