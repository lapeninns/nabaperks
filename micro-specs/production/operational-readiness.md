---
spec_id: MS-production-operational-readiness
status: implemented
risk_class: migrations
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/production/**
  - app/api/health/route.ts
  - app/api/readiness/route.ts
  - instrumentation.ts
  - lib/observability/readiness.ts
  - lib/observability/logger.ts
  - supabase/migrations/20260713160000_production_readiness_probe.sql
  - supabase/migrations/20260713170000_lock_readiness_probe_service_role.sql
  - .github/workflows/production-smoke.yml
  - docs/operations/production-runbook.md
  - docs/operations/incident-response.md
  - tests/unit/operational-readiness.test.mjs
  - tests/db/production-readiness-probe.test.mjs
  - tests/micro-specs/production-operational-readiness.test.mjs
implementation_surfaces:
  - app/api/health/route.ts
  - app/api/readiness/route.ts
  - instrumentation.ts
  - lib/observability/readiness.ts
  - lib/observability/logger.ts
  - supabase/migrations/20260713160000_production_readiness_probe.sql
  - supabase/migrations/20260713170000_lock_readiness_probe_service_role.sql
  - .github/workflows/production-smoke.yml
  - docs/operations/production-runbook.md
  - docs/operations/incident-response.md
  - tests/unit/operational-readiness.test.mjs
  - tests/db/production-readiness-probe.test.mjs
  - tests/micro-specs/production-operational-readiness.test.mjs
related_tests:
  - tests/unit/operational-readiness.test.mjs
  - tests/db/production-readiness-probe.test.mjs
  - tests/micro-specs/production-operational-readiness.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm governance:check
  - manual:production-health-readiness
  - manual:supabase-backup-readback
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-production-operational-readiness — Production health monitoring and incident readiness

## 1. Exact Goal and User-Visible Outcomes

Operators can distinguish a running deployment from one that can actually
serve database-backed traffic, identify the exact deployed revision, receive a
failed scheduled check when production becomes unavailable, and follow a
tested incident/rollback procedure without exposing secrets or customer data.

## 2. Blast Radius

In scope: public liveness and coarse dependency-readiness response contracts,
server request-error logging, a scheduled production smoke workflow,
production/incident runbooks, backup-state readback, and focused contracts.

Out of scope: a paid third-party APM subscription, legal copy, database schema,
provider writes, staging infrastructure, product UI, and Stripe live mode.

## 3. Strict Constraints and Assumptions

- Liveness stays dependency-free, cheap, dynamic, and non-cached.
- Readiness may reveal only `ok`/`error` states, deployment metadata, and
  timing; it never returns provider errors, keys, hostnames, row data, or PII.
- The readiness database probe uses the server-held service-role key only to
  execute a dedicated data-free RPC; it never reads a customer table or returns
  privileged provider detail.
- Dependency probes have a strict timeout and return HTTP 503 when unavailable.
- Global request-error telemetry records route templates and safe error
  identity only; it never logs raw request paths, query strings, headers,
  bodies, stack traces, or exception messages.
- Scheduled smoke checks must fail visibly on non-2xx or malformed status.
- The build and existing structured logger remain provider-agnostic.

## 4. Decisions Already Made

- `/api/health` is liveness; `/api/readiness` is dependency readiness.
- `VERCEL_GIT_COMMIT_SHA` is the deployed revision when available; package
  version is the stable fallback.
- Next.js `instrumentation.ts` `onRequestError` is the central capture seam and
  writes structured JSON to Vercel runtime logs through the existing logger.
- GitHub Actions performs a scheduled external read of both production probes;
  repository notification policy determines who receives workflow failures.
- Supabase daily-backup readback is documented independently from PITR; PITR is
  not claimed when disabled.

## 5. Behavioral Requirements (EARS)

- **OR-1:** WHEN liveness is requested, THE API SHALL return HTTP 200 with
  service, revision, deployment environment, timestamp, and `scope=liveness`.
- **OR-2:** WHEN database readiness succeeds within the timeout, THE API SHALL
  return HTTP 200 with `status=ready` and `database=ok`.
- **OR-3:** IF readiness configuration is missing, the request times out, or
  Supabase returns non-2xx, THEN THE API SHALL return HTTP 503 with
  `status=not_ready` and no internal error detail.
- **OR-4:** WHEN Next.js captures a server request error, THE instrumentation
  SHALL emit a structured error record containing safe route context and error
  identity only.
- **OR-5:** WHEN the scheduled smoke workflow runs, THE workflow SHALL validate
  production liveness and readiness JSON and fail on any mismatch.
- **OR-6:** THE runbooks SHALL identify deployment verification, rollback,
  incident roles, provider isolation, database recovery, communications, and
  evidence capture steps.
- **OR-7:** THE backup evidence SHALL state the current daily-backup result and
  the truthful PITR-disabled boundary.

## 6. Verification Criteria and Task Breakdown

1. Add red unit contracts for database success, non-2xx, timeout/missing config,
   and safe public result shaping.
2. Add a data-free readiness RPC with execute permission restricted to
   `service_role`; prove the public and user roles remain unable to call it.
3. Add the readiness helper and route; correct liveness revision metadata while
   keeping it independent of providers.
4. Register safe global server-error logging via the supported Next.js
   instrumentation convention.
5. Add the scheduled external smoke workflow and source contract proving its
   endpoint/status assertions.
6. Write operator-ready production and incident runbooks with exact commands,
   decision points, rollback sequence, and evidence boundaries.
7. Read back live health/readiness after deployment and Supabase backup state,
   then run and record the automated gates and manual attestations.
