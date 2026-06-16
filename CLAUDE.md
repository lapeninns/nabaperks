# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The operating model — an AI software company

Treat this repo as a small **AI software company**. Work moves through two disciplines, and you may be wearing either hat:

- **Product (curator of intent).** A change starts as a _Micro-Spec_ — a small, declarative statement of the desired end state, blast radius, settled decisions, EARS requirements, and verification criteria. It says **what must be true when the work is done**, never line-by-line _how_. The authoring rules live in [Instructions_MircroSpecsCreation.md](Instructions_MircroSpecsCreation.md).
- **Engineering (disciplined TDD).** A Micro-Spec is implemented test-first, Red → Green → Refactor. The workflow is in [Instructions_tdd.md](Instructions_tdd.md) and is **binding**.

The binding cross-cutting rules live in [micro-specs/GLOBAL_CONTEXT.md](micro-specs/GLOBAL_CONTEXT.md) — they apply to all work, so do not restate them in code, rely on them. The [micro-specs/README.md](micro-specs/README.md) AI governance contract defines the source-of-truth hierarchy, lifecycle status vocabulary, risk_class rubric, risk-to-gate mapping, and CLI-first/browser evidence policy. The [micro-specs/](micro-specs) folder is the intent backlog. For what the product actually does today, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (the as-built map) and [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) are the source of truth. [AGENTS.md](AGENTS.md) is the stack/governance index; [DESIGN.md](DESIGN.md) is the design system.

### How to execute a slice

1. **Narrow the work first.** The micro-specs folder is a backlog, not a fixed plan. Before implementing, inspect live code — much is already built. Reduce the task to _what is still missing_, and never widen a Micro-Spec's blast radius (the files/dirs it may touch) without approval.
2. **Red.** Write a failing test for each in-scope EARS requirement before production code. Tests live in `tests/micro-specs/` (Vitest, fast, mock the Supabase client) and `supabase/tests/` (SQL against real Postgres for invariants mocks cannot exercise — RLS, atomicity, tenant isolation).
3. **Green.** Write the _smallest_ code that passes. **Fake It** (hardcode) when the algorithm is unclear, then add a second test with a different input to **Triangulate** and force generalization. Use **Obvious Implementation** only for trivial, low-risk behavior. Don't optimize or generalize ahead of a test.
4. **Refactor** only under green; preserve behavior. Remove duplication by the **Rule of Three** (wait for the third occurrence) — premature abstraction is a defect here.
5. **Step size scales with uncertainty.** Baby steps (1–3 lines, run tests) for unclear problems; larger steps (4–7 lines) for obvious ones.

**Definition of Done:** all in-scope Micro-Specs pass; production code satisfies only the required behavior; fakes have been triangulated away; refactors changed structure not behavior; no untested behavior, speculative abstraction, or out-of-scope functionality added.

## Commands

```bash
pnpm dev                  # Next.js dev server (http://localhost:3000)
pnpm build                # production build
pnpm test                 # Vitest run (tests/micro-specs/**; tests/e2e excluded)
pnpm lint                 # ESLint (eslint-config-next)
pnpm typecheck            # tsc --noEmit (strict)
pnpm format               # Prettier write **/*.{ts,tsx}
```

Run a single Vitest file or test by name:

```bash
pnpm vitest run tests/micro-specs/self-service-stamping.test.ts
pnpm vitest run -t "issues a customer-owned daily stamp"
pnpm vitest tests/micro-specs/customer.test.ts   # watch mode (no `run`)
```

Database (Supabase Postgres — see [supabase/README.md](supabase/README.md)):

```bash
pnpm db:verify            # static migration checks (no DB needed)
pnpm db:setup             # apply + seed + RLS tests against a live DB
pnpm db:migrate           # apply migrations
pnpm db:seed              # seed fixtures
pnpm db:test:rls          # run supabase/tests tenant-isolation SQL
```

> `db:migrate` re-applies every non-initial migration on each run, so **all migration SQL must be idempotent**. The connection comes from `SUPABASE_DB_URL`, or from `supabase/.temp/pooler-url` + `SUPABASE_DB_PASSWORD` when the project is linked locally.

Environment, security, and customer-flow demo helpers:

```bash
pnpm env:check            # validate required env vars against config/env-contract.json
pnpm env:keys             # provider key status/setup guidance (see docs/ENV_KEYS.md)
pnpm security:verify      # static security checks (scripts/verify-security.mjs)
pnpm customer-flow:status # inspect/seed the local customer-flow demo state
npx playwright test       # e2e/screenshot specs (tests/e2e; iPhone 14 chromium)
```

Repository-quality and operability gates (also run in CI — see `.github/workflows/ci.yml`):

```bash
pnpm quality              # aggregate: naming, debt, N+1, AGENTS.md, complexity, routes, dead/dup code
pnpm test:coverage        # Vitest with v8 coverage thresholds (lib/**)
pnpm test:flaky           # repeat-run shuffled suite to surface flakiness
pnpm lint:quality         # complexity / file-size / depth ratchet (warnings, pinned count)
pnpm deadcode             # knip — unused files, exports, dependencies
pnpm duplication          # jscpd — copy-paste detection (<3%)
pnpm docs:routes          # regenerate docs/ROUTES.md route contract (--check in CI)
pnpm bundle:size          # client bundle-size budget (after pnpm build)
pnpm deps:analyze         # installed footprint per production dependency
```

Observability is documented in [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md): request/trace
ids (`proxy.ts`), structured logging and error tracking (`lib/observability/*`,
`instrumentation.ts`), the `/api/health` probe, and retry/circuit-breaker policy. The
route contract is [docs/ROUTES.md](docs/ROUTES.md).

## Architecture

Single Next.js 16 App Router app (React 19, TypeScript strict, Tailwind 4) that **maps the spec pack's monorepo domains onto one codebase**:

| Spec domain                   | Here                                                     |
| ----------------------------- | -------------------------------------------------------- |
| customer-web                  | `app/q`, `app/m`, `app/card`, `app/reward`, `app/wallet` |
| merchant-console              | `app/app/*`                                              |
| admin-console                 | `app/admin/*`                                            |
| api / server actions          | `app/api`, route `actions.ts`                            |
| domain / db                   | `lib/*`, `supabase/migrations`                           |
| risk / compliance / analytics | `lib/security`, `lib/analytics`, `lib/notifications`     |

### The trust mechanic (the product's core)

A customer keeps their own phone and self-serves from the **permanent venue QR**. `/q/[qrId]` resolves to **join** for new visitors or **stamp-confirm** for existing members. Postgres enforces **one stamp per UK business day** (`Europe/London`, GBP). Optional GPS checks never block — they write `fraud_flags` for review. There are no shared staff PINs as primary verification; the v3 design replaced the handed-phone staff PIN with a **counter handshake** (code → paired station). Customer identity is **phone-first** (accept `07…`, store E.164) via Twilio Verify + a signed first-party session cookie; merchant/admin auth is Supabase Auth + RLS.

### The mutation boundary (most important architectural rule)

Every loyalty-affecting action is an auditable, attributable, server-side event; card state is always recoverable from server state. Writes go through three layers — pick the right one:

1. **RLS reads / constrained writes** — Supabase _server client_ (`createSupabaseServerClient`, carries the user's cookies). Used for merchant/admin reads where RLS scopes the tenant.
2. **Security-definer RPC writes** — high-risk business mutations run as Postgres functions that validate ownership, billing, rate limits, idempotency, and ledger invariants: `create_merchant_onboarding`, `join_customer_membership`, `issue_self_service_stamp`, `redeem_self_service_reward`. Self-service stamp/redeem actions **must** go through these RPCs, not direct table writes.
3. **Service-role server writes** — `createSupabaseServiceRoleClient` for trusted server-only code (product events, admin readbacks, QR resolution, Stripe webhook sync). **Never reaches a client bundle** — service-role modules start with `import "server-only"`.

`lib/supabase/server.ts` is the only place these clients are constructed. In Vitest, `server-only` is aliased to a stub (`tests/helpers/server-only.ts`) and Supabase is mocked via `tests/helpers/supabase.ts`.

### Data model & events

Core tables: `merchants`, `merchant_locations`, `loyalty_cards`, `reward_pool_items`, `qr_codes`, `customers`, `customer_memberships`, `stamp_events`, `reward_events`, `fraud_flags`, `product_events`, `audit_logs`, billing/consent tables. `product_events` is the analytics source of truth (PostHog is a mirror); `audit_logs` covers admin/support/security mutations. See `docs/ARCHITECTURE.md` §5–8 for the full route catalog, module map, and flows.

## Conventions that bite if missed

- **Next.js 16 is not the version in your training data.** APIs, conventions, and file structure differ. Before writing routes, Server Actions, Route Handlers, auth, or data mutations, read the relevant guide under `node_modules/next/dist/docs/01-app/` and heed deprecation notices.
- **Design system = Wet Ink (Honey & Ink v2).** Do **not** edit the shadcn primitives in `components/ui/` for visual styling. Theme through `app/globals.css` tokens (the `--w-*` palette) and the unlayered "Wet Ink layer" that targets `data-slot` attributes; wrap with `components/brand`, `components/customer`, etc. **Icons use the `@hugeicons` free set** via the brand `Icon` wrapper (`components/brand/icon.tsx`) — pull glyphs from `@hugeicons/core-free-icons` and reuse the `STATUS_ICON` / `ACTIVITY_CATEGORY_ICON` maps in `components/brand/icons.ts`. The `✱` disc stays the wordmark/logo signature only. **No emoji, no exclamation marks.** Copy is plain, warm, British (en-GB): "Save my card", never "register"/"create an account". Full rules in `DESIGN.md`.
- **No legacy product naming.** `tests/micro-specs/no-legacy-naming.test.ts` greps active source for retired names — keep new code clean of them.
- **Customer flows are mobile-first** (≈410px thumb column, ≥44px tap targets). The `app/dev/customer-flow/preview` harness re-implements join/card screens with mock forms (dev OTP `424242`) — mirror real-component UI fixes there too.
