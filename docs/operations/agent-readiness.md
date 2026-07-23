# Agent Readiness Controls

This document maps the repository controls used by autonomous agents and by
Factory's readiness evaluation. It is an operating index, not a second source
of implementation truth.

## Current controls

| Readiness criterion           | Repository evidence                                                |
| ----------------------------- | ------------------------------------------------------------------ |
| Pre-commit hooks              | Husky `.husky/pre-commit` and lint-staged                          |
| Naming consistency            | Naming rules in `AGENTS.md`                                        |
| Cyclomatic complexity         | ESLint `complexity` budgets                                        |
| Large file detection          | ESLint `max-lines` budget for production TypeScript                |
| Dead code detection           | Knip configuration and `pnpm deadcode:check`                       |
| Duplicate code detection      | jscpd configuration and `pnpm duplicates:check`                    |
| Technical debt tracking       | Issue-linked TODO/FIXME policy enforced by `pnpm debt:check`       |
| N+1 query detection           | Live `EXPLAIN ANALYZE` loop-count proof in the RLS DB suite        |
| Fast CI feedback              | Playwright project/shard matrix plus the fast quality lane         |
| Feature flag infrastructure   | Typed runtime flag reader and lifecycle registry                   |
| Dead feature flag detection   | Owner, expiry, and runtime-usage validation                        |
| Release notes automation      | Release Drafter workflow and label categories                      |
| Unused dependencies           | Knip dependency analysis                                           |
| AGENTS.md                     | Root agent guide with commands and product boundaries              |
| Automated documentation       | OpenAPI-to-Markdown generation checked in CI                       |
| Skills configuration          | Focused Factory readiness skill                                    |
| API schema docs               | OpenAPI 3 contract under `docs/api/openapi.json`                   |
| AGENTS.md freshness           | `pnpm agents:check` validates commands and referenced paths        |
| Error tracking contextualized | Sentry request, route, release, source-map, and navigation context |
| Alerting configured           | Signed external page plus deduplicated incident issue              |
| Profiling instrumentation     | `pnpm profile:server` writes Node CPU profiles                     |
| Issue templates               | Structured bug, feature, debt, and incident forms                  |
| Error-to-insight pipeline     | Production monitor failures become labelled GitHub issues          |
| Stable release gate           | One CI check aggregates all release-critical repository proof      |
| Exact-revision verification   | Successful main CI triggers production revision/readiness proof    |
| Isolated staging gate         | Protected staging migration, webhook and rollback-only journey     |
| Recovery verification         | Read-only physical-backup drill against a disposable project       |
| Availability objective        | 30-day SLO, coverage floor, error budget and retained daily report |

## Proof boundaries

- `pnpm quality:check` proves repository configuration and local static/runtime
  contracts.
- `pnpm test:db` proves live Postgres/RLS/RPC behavior against the configured
  disposable database.
- Pull-request CI proves the clean Linux build and sharded browser matrix.
- `pnpm smoke:staging` is intentionally fail-closed and proves only the
  configured isolated staging target; the workflow supplies its exact revision,
  immutable deployment URL and protected staging credentials.
- `pnpm ops:restore:verify` proves a selected completed physical backup was
  restored into a fresh, protected, non-production Supabase target, then checks
  its as-of-backup migration ledger, forced RLS, RPCs, constraints, indexes and
  core counts inside a read-only transaction.
- The production smoke workflow proves deployed liveness and database
  readiness, sends a signed, retrying, deduplicated external page, and creates
  a durable incident issue. Recovery requires two consecutive scheduled green
  probes and resolves the external page before closing that issue.
- `pnpm ops:slo:check` derives the rolling 99.9% availability objective and
  error budget from completed scheduled Production smoke runs. It treats failed
  probes as unavailable, reports missing post-activation probes as a separate
  fail-closed coverage breach, requires seven observed days and 95% evidence
  coverage, and retains a daily report. Because both signals are GitHub-hosted,
  this is not proof of independent external monitoring.
- Sentry capture, exact-SHA release verification, source-map upload and
  production deploy readback are active only when the documented Sentry
  environment values are supplied in the protected deployment environment.

Factory evaluates repository state from GitHub. After these controls merge,
refresh the report and inspect every binary criterion rather than inferring a
score from the local checkout.
