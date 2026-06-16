---
spec_id: MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS
status: active
risk_class: auth-session
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - app/**
  - components/**
  - config/**
  - docs/**
  - lib/env/**
  - lib/supabase/**
  - micro-specs/01-foundation/01-project-shell-and-environments.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
implementation_surfaces:
  - app/**
  - components/**
  - lib/env/**
  - lib/supabase/**
  - config/**
  - docs/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - tests/micro-specs/foundation.test.ts
  - tests/micro-specs/vercel-env-guard.test.ts
  - tests/micro-specs/health-endpoint.test.ts
  - tests/micro-specs/full-app-pwa.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm security:verify
  - pnpm build
approved_exceptions: []
---

# Micro-Spec: Project Shell and Environments

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

The app foundation is ready for MVP development and deployment. A developer can run the Next.js app locally, configure environment variables for Supabase, Stripe, PostHog, and Resend, and deploy the same route structure to Vercel without hidden setup.

## Blast Radius

In scope:

- `app/`, `components/`, `lib/`, `hooks/`, and configuration files required for Next.js app foundation.
- Environment variable examples and validation helpers.
- Vercel, Supabase, Stripe, PostHog, and Resend integration placeholders where needed.
- Project documentation updates when setup requirements change.

Out of scope:

- Implementing full business workflows.
- Creating production Supabase projects or Stripe products manually.
- Adding new UI libraries without approval.
- Changing the MVP product scope.

## Strict Constraints and Assumptions

- Use Next.js App Router patterns for pages, layouts, Server Actions, and Route Handlers.
- Read local Next.js docs before coding APIs affected by Next.js 16.2.6 changes.
- Required secrets must be read server-side unless they are intentionally public client keys.
- Missing or invalid required environment variables must fail clearly in development and deployment checks.
- Do not expose Supabase service-role, Stripe webhook secret, or Resend API key to client bundles.

## Decisions Already Made

- Vercel hosts the app.
- Supabase is the database and auth provider.
- Stripe handles subscriptions and customer portal.
- PostHog handles funnels and product analytics.
- Resend handles transactional email.
- The design system is `DESIGN.md`.

## Behavioral Requirements

- **MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-001** WHEN a developer runs the local app with valid environment variables, THE app SHALL start without setup-specific runtime errors.
- **MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-002** WHEN a required server-only secret is missing, THE app SHALL fail with a clear configuration error before a sensitive workflow is used.
- **MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-003** WHEN client code is bundled, THE bundle SHALL not include service-role or webhook secrets.
- **MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-004** WHEN the app is deployed to Vercel, THE configured route families SHALL be compatible with the App Router structure.
- **MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS-005** WHEN setup documentation is followed, THE developer SHALL know which variables are required for local development, preview, and production.

## Verification Criteria

Acceptance criteria:

- `pnpm typecheck` passes.
- `pnpm lint` passes.
- Environment validation covers Supabase URL/keys, Stripe keys/webhook secret, PostHog key/host, Resend key, and app URL.
- Public keys and server secrets are separated by naming and runtime usage.

Manual QA:

- Start the app locally and visit `/`.
- Confirm a missing critical server variable produces an actionable error.
- Inspect client-accessible config and confirm no service-role or webhook secret appears.

Task breakdown:

- Read relevant Next.js local docs.
- Define environment contract.
- Add or update configuration helpers.
- Verify local start, typecheck, and lint.
