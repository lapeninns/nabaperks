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
| Alerting configured           | Scheduled production probes create or update incident issues       |
| Profiling instrumentation     | `pnpm profile:server` writes Node CPU profiles                     |
| Issue templates               | Structured bug, feature, debt, and incident forms                  |
| Error-to-insight pipeline     | Production monitor failures become labelled GitHub issues          |

## Proof boundaries

- `pnpm quality:check` proves repository configuration and local static/runtime
  contracts.
- `pnpm test:db` proves live Postgres/RLS/RPC behavior against the configured
  disposable database.
- Pull-request CI proves the clean Linux build and sharded browser matrix.
- The production smoke workflow proves deployed liveness and database
  readiness, then creates a deduplicated incident issue on failure.
- Sentry capture and source-map upload are active only when the documented
  Sentry environment values are supplied in the deployment environment.

Factory evaluates repository state from GitHub. After these controls merge,
refresh the report and inspect every binary criterion rather than inferring a
score from the local checkout.
