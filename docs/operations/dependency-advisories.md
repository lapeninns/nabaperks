# Accepted dependency advisories

`pnpm security:audit` fails the CI fast lane on any advisory. The advisories listed here are
accepted deliberately, recorded in `pnpm.auditConfig.ignoreGhsas` in `package.json`, and
reviewed on the date below. Every entry is named individually — the audit's severity threshold
is never lowered, so a new advisory in any package still fails the build.

**Reviewed: 2026-08-04. Next review: 2026-11-04.**

## Why these are accepted

All eleven arrive through three development tools — `vercel`, `@lhci/cli` and
`@stryker-mutator/core` — plus `shadcn`, a scaffolding CLI. None is reachable from code served
to a customer.

Two of them also appear in a production-tree audit, and that needs stating plainly rather than
hiding behind the dev/prod split: `fast-uri` and `brace-expansion` reach `dependencies` through
`@sentry/nextjs`. They arrive via `@sentry/webpack-plugin` and `@sentry/bundler-plugin-core`,
which run during `next build` and are not part of the served runtime bundle. They are build-time
exposure, not request-path exposure.

Nothing here is fixable today, which is the other half of the decision:

- `@lhci/cli` (0.15.1) and `@stryker-mutator/core` (9.6.1) are **already at their latest
  release**. There is no patched version to move to.
- `pnpm.overrides` was measured and rejected: forcing the patched versions invalidates the
  lockfile's resolutions and triggers a full re-resolve, taking the total from 14 advisories to
  between 36 and 55 and introducing a critical one. Every grouping tested made it worse.
- Bumping `vercel` (56.5.0 → 58.5.1) and `shadcn` was measured and rejected: 32 advisories, and
  it did not fix `undici` or `hono` anyway.

`shadcn` was moved from `dependencies` to `devDependencies` at the same time. It is a
scaffolding CLI that nothing imports at runtime, and the move took the production-tree count
from six advisories to two.

## The list

| GHSA                  | Severity | Package           | Arrives via                                                 |
| --------------------- | -------- | ----------------- | ----------------------------------------------------------- |
| `GHSA-rgw5-rvv9-x895` | high     | `brace-expansion` | `@lhci/cli`, and `@sentry/nextjs` at build time             |
| `GHSA-7p8r-x3mc-p8w7` | high     | `fast-uri`        | `@stryker-mutator/core`, and `@sentry/nextjs` at build time |
| `GHSA-mwp4-54f8-5fhr` | high     | `ip-address`      | `@lhci/cli`                                                 |
| `GHSA-4xrf-jv44-h6hh` | moderate | `ip-address`      | `@lhci/cli`                                                 |
| `GHSA-22jq-vg5j-6vgg` | moderate | `ip-address`      | `@lhci/cli`                                                 |
| `GHSA-4cwx-7wf7-3272` | high     | `undici`          | `vercel`                                                    |
| `GHSA-8xcm-r25x-g524` | moderate | `undici`          | `vercel`                                                    |
| `GHSA-m8rv-5g2x-5cg5` | moderate | `undici`          | `vercel`                                                    |
| `GHSA-jr45-8vmc-qm54` | moderate | `undici`          | `vercel`                                                    |
| `GHSA-v3r7-h72x-cjcm` | moderate | `undici`          | `vercel`                                                    |
| `GHSA-8j4g-w8fx-2239` | moderate | `hono`            | `shadcn`                                                    |

## What should end this

Remove entries as upstream publishes fixes — re-run `pnpm audit --ignore-registry-errors` and
drop any GHSA it no longer reports. The list should shrink, never quietly grow.

Reconsider the acceptance entirely if any of these becomes reachable from served code, if one
gains a known exploit in the wild, or if the tool that carries it can be dropped. `@lhci/cli`
and `@stryker-mutator/core` are both optional quality tooling rather than build requirements,
so removing them is a live option if these advisories persist unpatched.
