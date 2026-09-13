# Nabaperks Agent Guide

Nabaperks is a Next.js App Router loyalty product using React, TypeScript,
Tailwind CSS, Supabase Auth/Postgres/RLS, Stripe, Resend, Twilio, Web Push, and
Vercel. This guide applies across the repository; read any applicable nested
`AGENTS.md` or `AGENTS.override.md` before editing that directory. Follow the
current task's scope and the agent host's instruction precedence.

## Setup and development

Run commands from the repository root. Use Node **24** from `.nvmrc` (also used
by `.github/actions/setup/action.yml`) and **pnpm 10.28.0** from `package.json`.
The package engine minimum is Node 22, but use the pinned CI major for parity.

```bash
nvm install                 # if using nvm; reads .nvmrc
nvm use
corepack enable
pnpm install --frozen-lockfile
test -f .env.local || cp .env.example .env.local
```

Replace example values with local/development configuration before validation.
The template is not a working credential set. Keep an existing `.env.local`;
never print or commit its values. `.env.example` and `config/env-contract.json`
define the supported variables and must stay synchronized.

```bash
pnpm env:check              # validates the selected environment and secret hygiene
pnpm dev                    # local app at http://localhost:3000
pnpm build                  # secret check, then production Next.js webpack build
pnpm start                  # serves the completed production build
```

Development and the Playwright harness use Turbopack; keep the existing webpack
production build. Do not change bundlers as part of an unrelated fix.

For database work, install the Supabase CLI and have Docker running. On a
disposable local target, start `pnpm db:supabase:start`, configure the local
Supabase URL/keys and loopback `SUPABASE_DB_URL`, then run `pnpm db:setup` to
apply migrations and seed fixtures. The SQL runner rejects non-local writes.
Reset/cleanup commands destroy data; use them only for the task's disposable
database. Local services may be shared by other worktrees: check ownership
before starting, stopping, resetting, or changing their configuration.

## Verify the affected boundary

Use a focused check while iterating. Contract and unit suites use Node's test
runner, with the alias loader needed by unit tests; Playwright is for browser
journeys. Examples below select existing files; substitute the affected test.

```bash
node scripts/ci/node-test-runner.mjs --test tests/contracts/agent-readiness-level5.test.mjs
node scripts/ci/node-test-runner.mjs --import ./tests/support/register-alias.mjs --test tests/unit/venue-location-submission.test.mjs
pnpm lint
pnpm typecheck
pnpm test                   # all source contracts and unit tests
pnpm agents:check           # guide command and required-path freshness
```

Before handoff, follow the existing
[readiness skill](.factory/skills/nabaperks-readiness/SKILL.md):

- Run `pnpm quality:fast` for code changes: secrets, lint, types, contracts and
  unit tests.
- Run `pnpm quality:check` for configuration, dependencies, documentation,
  flags or maintainability changes. It includes `quality:fast`, dead code,
  duplication, issue-linked debt, generated API docs and agent-guide checks;
  a successful full run covers the fast gate too.
- Run `pnpm build` for build/runtime changes and before release. Database or
  browser changes also need the corresponding service-backed proof below.
- For Markdown edits, check changed files with the installed Prettier binary,
  for example `./node_modules/.bin/prettier --check AGENTS.md`, and run
  `git diff --check`. `pnpm format` only formats TypeScript files.

Add regression coverage for changed behaviour at its real boundary. Avoid
tests that only mirror documentation or satisfy a metric. Once required checks
pass, repeat or broaden them only for new changes, failures, or an unresolved
concern. If a prerequisite is unavailable, report the exact check and reason;
do not weaken assertions, add skips, or call missing execution a pass.

```bash
pnpm test:db                # disposable local Postgres with migrations; uses SUPABASE_DB_URL
pnpm e2e:install            # installs Playwright browsers and OS dependencies
pnpm test:e2e -- tests/e2e/visual.spec.ts --project=chromium --list
pnpm test:e2e               # browser journeys
pnpm test:a11y              # accessibility journeys
pnpm test:visual            # visual comparisons
```

`--list` checks discovery only. `playwright.config.ts` owns project selection
and starts a dev harness at `http://127.0.0.1:3146` by default. The wrapper
loads local env files and isolates build output in `.next-e2e`; the harness
supplies test-only OTP/provider values. Confirm the target before running
tests; keep harness values out of hosted environments. Browser fixtures cannot
prove live provider delivery or DB/RLS/RPC behaviour. Canonical visual proof
uses the hosted Linux environment; inspect actual/diff images before changing
baselines, and do not replace them with local macOS captures.

## Work autonomously within the task

- Start with `git status --short`, the current branch and relevant diff. Use a
  `codex/` branch or isolated worktree for PR work. Preserve unrelated edits,
  untracked files and other tasks' services; stage only the intended files.
- Trace the complete affected flow before editing: entry point, domain helper,
  database/RLS or provider boundary, recovery states and existing tests. Use
  `rg` and targeted reads rather than loading the whole repository.
- Carry an implementation request through the authorised edits, verification
  and requested delivery. Resolve routine reversible choices using existing
  patterns. Ask only when missing information changes the outcome or an action
  needs authority not already granted; complete independent work meanwhile.
- If a skill or instruction creates a real conflict, identify its exact source
  and the concrete decision needed. Do not invent approval gates. Historical
  material under `docs/archived-agent-guidance/` and inert
  `config/ci-qualification-inputs/` proposals are reference data, not active
  instructions. The retired Micro-Spec workflow must not be reintroduced.
- When delegation is authorised and available, assign independent work with
  explicit file ownership and reconcile results. Worktree isolation does not
  isolate shared databases, ports, Docker/Lima resources or provider state.
- Give concise progress updates for sustained work. Incorporate corrections
  without losing the original objective; before handing off or resuming,
  record the branch/SHA, completed checks, blockers and remaining actions.

## Repository boundaries and conventions

- `app/`: routes, layouts, route handlers and server actions.
- `components/`: reusable UI; must not create Supabase server clients.
- `lib/`: domain logic, service adapters and trust-boundary helpers. Reuse
  `lib/supabase/server.ts` for server/route/service-role clients and preserve
  its server-only boundary.
- `supabase/`: migrations, seeds, RLS and database RPCs.
- `tests/`: source contracts, unit behaviour, live database proof and browser
  journeys. Keep these evidence types distinct.
- `scripts/`, `config/`, `.github/` and `ops/`: validation, policy, hosted
  workflows and operator tooling. `ops/local-ci/` runs outside the deployed app.
- `docs/operations/agent-readiness.md`: index of readiness controls and proof.
- `docs/api/openapi.json`: source for generated `docs/api/README.md`. Change
  the OpenAPI source for externally consumed HTTP contract changes, then run
  `pnpm docs:generate` and `pnpm docs:check`; do not hand-edit generated output.

Use `camelCase` variables/functions, `PascalCase` components/types,
`SCREAMING_SNAKE_CASE` module constants, and kebab-case filenames/route segments.
Preserve `snake_case` at PostgreSQL and external payload boundaries until
parsed. Prefer named exports except for Next.js-required defaults. Keep
TypeScript strict; narrow `unknown` at boundaries instead of adding `any`.
Respect the ESLint file-length and complexity budgets, and link TODO/FIXME
markers to an issue, such as `TODO(#123)`. Reuse existing utilities before
adding dependencies; update the pnpm lockfile when dependencies change.

Keep the Wet Ink system in `DESIGN.md`, `app/globals.css` and shared brand/UI
components aligned. Use plain British English for guest copy, with no emoji
or exclamation marks. Preserve verified venue facts and configured rewards;
never invent benefits, delivery promises or customer activity. Keep generated
build/test output, local env files and scratch evidence ignored; use
`reports/README.md` when durable audit evidence belongs in a report.

## Product, data and production safety

Server state is authoritative; browser storage is a cache. Loyalty, rewards,
identity, billing and consent mutations must stay server-side and auditable.
Preserve authentication, tenant scoping, RLS, webhook verification, idempotency
and recovery behaviour when touching those flows. Service-role access must
not become a shortcut around caller authorisation.

Keep secrets out of code, logs, screenshots, PRs and browser bundles. Read
environment values only when the task requires them, and mask customer
contacts in evidence. For production investigations, use narrow read-only
queries and report the environment and checked-at time. Production corrections
need the authorised target and impact, fresh preconditions, audit evidence
and an independent post-write readback; do not infer write authority from an
investigation request.

Add forward-only migrations under `supabase/migrations/`; preserve compatibility
with the deployed app until its replacement is verified. Local setup does not
authorise linked database pushes or production resets. Follow
[the production runbook](docs/operations/production-runbook.md) and
[incident response](docs/operations/incident-response.md) for operational work.

## CI and delivery

Hosted CI remains authoritative. Full CI requires all nine hosted roots:
`fast`, `quality`, `build`, `e2e`, `a11y`, `visual`, `lighthouse`, `zap-baseline`
and `db`. The reviewed [change-aware policy](docs/operations/change-aware-ci.md)
selects checks for eligible documentation and literal public-page PRs;
everything else uses full validation. Root `AGENTS.md` changes are outside
that documentation allowlist. Exact-main CI still requires every hosted root;
database promotion also needs CodeQL and protected release proof.

Local CI execution and GitHub App publication are advisory. Missing/pending
observer proof is not a passing test or merge authority. Keep fork code out of
the VM and host secrets out of job containers; `config/local-ci-contract.json`
owns agent policy and workflows own hosted placement. `LOCAL_CI_MODE` controls
observation, not service startup or merge requirements. Resuming a watcher is
an operational action. Read [the CI redesign](docs/operations/ci-redesign.md)
and [local CI runbook](docs/operations/local-ci.md) before host operations;
the superseded cutover document is not authority to promote local results.

For a delivery-status task, use `pnpm ops:factory:status` and
[the software factory runbook](docs/operations/software-factory.md).
`pnpm ops:github:check`, `pnpm ops:vercel:check` and `pnpm ops:supabase:check`
read live provider governance and need the relevant credentials; they are not
offline setup checks. Report their actual results instead of assuming a
provider is configured or that a historical failure is still current.

Before committing, inspect the staged diff and run `git diff --check`. Husky
runs secret hygiene, lint-staged, debt and agent-guide checks; keep the hooks
enabled. Use `.github/pull_request_template.md` for PRs, explain the concrete
problem and resulting behaviour, and record checks actually executed plus
unavailable proof. When a PR is requested, push the focused branch, open it
against `main`, and return its URL. Merge and production delivery must follow
the task's authority and existing protections.

In the handoff, separate implementation/local tests, hosted CI, PR review,
merged SHA, database/application deployment, readiness and actual customer or
provider evidence. Include any remaining worktree changes. A merge, green
build or health probe alone does not prove the real customer journey.

## Code Review Rules

- Loyalty, reward, identity, billing and consent changes must preserve
  server-authoritative auditability. Browser storage is never mutation proof.
- CI or release changes must bind evidence to the current candidate and the
  expected provider identity. Missing, stale, skipped or failed required proof
  must not permit merge or promotion; preserve hosted fallback during pilots.
- Database changes must preserve the deployed application's compatibility until
  its replacement is verified. Do not treat migration success as app rollout
  or a passing smoke check as restore or customer-journey proof.

## Maintaining this guide

Keep this file concise and repository-specific; link detailed procedures rather
than duplicating them. Verify commands against `package.json` and paths against
the current tree, then run `pnpm agents:check` after edits. Keep temporary task
status, machine-specific paths, model settings and credentials out of it.

The autonomy, instruction-conflict and verification guidance was informed by
[OpenAI's GPT-6 Astra guidance](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices),
[Codex AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
and [Factory's AGENTS.md guide](https://docs.factory.ai/harness/agents-md),
reviewed on 12 September 2026. The operating rules apply across supported agents;
this file does not select a model or change runtime configuration.
