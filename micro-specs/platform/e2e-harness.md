---
spec_id: MS-platform-e2e-harness
status: implemented
risk_class: docs-tooling
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - playwright.config.ts
  - tests/e2e/**
  - package.json
  - .github/workflows/ci.yml
  - .gitignore
  - micro-specs/platform/**
implementation_surfaces:
  - playwright.config.ts
  - tests/e2e/helpers/axe.ts
  - tests/e2e/helpers/harness.ts
  - tests/e2e/harness-smoke.spec.ts
  - package.json
  - .github/workflows/ci.yml
related_docs:
  - AGENTS.md
  - micro-specs/README.md
  - micro-specs/GLOBAL_CONTEXT.md
  - Instructions_tdd.md
related_tests:
  - tests/e2e/harness-smoke.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-platform-e2e-harness — Restore the Playwright e2e harness + CI wiring

## Intent

Give the repo a first-class **end-to-end test tier** again. `main` keeps only the
build-facing gates (`pnpm lint`, `pnpm typecheck`, `pnpm build`) plus a
`node --test` unit/micro-spec runner; there is **no browser harness**. The
trust mechanic and every user-facing flow are protected only by mocked unit
tests. This spec restores a Playwright harness — reconciled to current `main` —
so later domain Micro-Specs can attach real e2e coverage, and wires a DB-free
e2e job into CI now.

A developer can run `pnpm test:e2e` and watch Playwright boot the real Next app
and drive the DB-free `/dev` harness routes; CI runs that same tier on every
push and PR and uploads a trace + screenshot when a spec fails.

This spec is the governance carve-out the README requires: the verification
gates are intentionally build-only, and a test/browser/CI harness may be added
**only inside an active Micro-Spec's blast radius**. That blast radius is
declared above and is the foundation every later e2e spec hangs off.

## Scope (in)

- `playwright.config.ts` — restored from history (`94f72d0b^`) and reconciled to
  current `main`.
- `tests/e2e/helpers/axe.ts` — restored from history; the shared axe-core WCAG
  helper for future `MS-platform-a11y` specs.
- `tests/e2e/helpers/harness.ts` — small new helper: base routes + an init
  script that dismisses the PWA install prompt so it never intercepts nav.
- `tests/e2e/harness-smoke.spec.ts` — one smoke spec proving the harness boots
  the real app against a DB-free `/dev/app-harness` route.
- `package.json` — add `@playwright/test` + `@axe-core/playwright` devDeps and
  the `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:visual`, `test:a11y`,
  `qa:e2e` scripts.
- `.github/workflows/ci.yml` — a new `e2e` job (DB-free tier) reusing
  `./.github/actions/setup` + the existing env placeholder block.
- `.gitignore` — ensure `test-results/`, `playwright-report/`, and the Playwright
  browser cache stay untracked (already covers the first two).

## Scope (out)

- **No Vitest.** `main` deliberately abandoned Vitest for `node --test`; the
  restore must NOT reintroduce it. Playwright is the e2e runner only; unit and
  micro-spec tests stay on `node --test`.
- No new product/runtime code. The `/dev/*` harness routes, the
  `NODE_ENV !== "production"` guard, `scripts/customer-flow-demo.mjs`, and the
  trust-mechanic RPCs already exist and are reused, not rebuilt.
- No live-Supabase e2e tier wiring yet, and no reconciliation of the 21 stale
  e2e specs that live in history — those land in the per-domain slices and in
  `MS-platform-a11y` / Phase 3, each behind its own Micro-Spec.

## Decisions already made

- The dev-harness gate is now simply `process.env.NODE_ENV === "production"`
  → `notFound()` (`app/dev/layout.tsx`, `app/dev/app-harness/layout.tsx`). The
  old `CUSTOMER_FLOW_DEV_HARNESS_ENABLED` flag is **vestigial** and is dropped
  from the restored `webServer` command; `CUSTOMER_DEV_OTP_CODE=424242` stays —
  it is still read by `lib/customer/verification.ts` +
  `lib/customer/email-verification.ts`.
- The DB-free surface is the current `/dev/app-harness/*` lanes (dashboard,
  customers, activity, account, qr, scan, reward-scan, launch, onboarding,
  skeletons, states) plus `/dev/design-system` and `/dev/poster-preview`. There
  is no longer a `customer-flow` dev route.
- Projects mirror the historical config: `mobile-safari` (iPhone 14 via
  chromium) is the default mobile project; `chromium` (Desktop Chrome) carries
  the desktop-only specs. `retries:1` / `workers:1` on CI; `trace` and
  `screenshot` `retain-on-failure` / `only-on-failure`.

## EARS requirements

- **H-1 (runner separation):** THE repo SHALL provide a Playwright e2e harness
  (config, devDeps, scripts) and SHALL keep `node --test` as the unit/micro-spec
  runner; `pnpm test` SHALL NOT invoke Playwright and the toolchain SHALL NOT
  depend on Vitest.
- **H-2 (config shape):** THE harness SHALL target `tests/e2e`, expose the
  `mobile-safari` (iPhone 14, chromium) and `chromium` (Desktop Chrome)
  projects, and capture `trace` + `screenshot` only on failure; on CI it SHALL
  run with `retries: 1` and `workers: 1`.
- **H-3 (server reuse):** WHEN a dev server is already listening on the base URL
  and the run is local, THE harness SHALL reuse it; otherwise THE harness SHALL
  boot `pnpm dev` with `CUSTOMER_DEV_OTP_CODE=424242`.
- **H-4 (dev-only surface):** THE DB-free e2e tier SHALL exercise `/dev/*`
  harness routes, which return 404 in a production build; therefore e2e SHALL run
  only against a development server.
- **H-5 (smoke):** WHEN `pnpm test:e2e` runs, a smoke spec SHALL load a
  `/dev/app-harness` route and assert a stable rendered landmark, proving
  Playwright boots the real app end-to-end.
- **H-6 (CI tier):** THE CI workflow SHALL run the DB-free e2e tier on every push
  and pull request in a dedicated job that reuses `./.github/actions/setup` and
  the existing env placeholder block, installs chromium with `--with-deps`, and
  uploads the Playwright trace + screenshot artifacts WHEN a spec fails.
- **H-7 (a11y helper present):** THE harness SHALL ship the shared axe helper so
  a later a11y sweep can assert zero WCAG 2 A/AA violations after hiding the
  Next dev overlay; this spec only restores the helper, it does not add a11y
  specs.
- **H-8 (PWA non-interference):** WHILE an e2e spec drives a harness route, THE
  PWA install prompt and service worker SHALL NOT intercept navigation —
  a shared init script SHALL pre-dismiss the install prompt.

## Verification method

`node --test` stays the unit gate. Restore the config + axe helper from history,
reconcile to current `main`, add the scripts/devDeps, then write the smoke spec
and watch it fail for the right reason (Red: harness absent / route landmark not
asserted) before it goes Green against the running dev server. CI wiring is
proven by the job definition plus a local parity run of `pnpm test:e2e`.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` (node --test, must
stay green and Vitest-free) · `pnpm test:e2e` (smoke green against the DB-free
harness). Final verdict is `READY` or `NOT READY` with exact remaining blockers.

## Verification log — 2026-06-30

Restored `playwright.config.ts` + `tests/e2e/helpers/axe.ts` from `94f72d0b^`
and reconciled to current `main`:

- Dropped the vestigial `CUSTOMER_FLOW_DEV_HARNESS_ENABLED` from the `webServer`
  command (the `/dev` gate is now just `NODE_ENV !== "production"`); kept
  `CUSTOMER_DEV_OTP_CODE=424242`.
- Replaced the stale `high-accuracy-geofence-precision.spec.ts`
  testIgnore/testMatch with a forward-looking `*.desktop.spec.ts` convention:
  the `mobile-safari` (iPhone 14) project ignores `*.desktop.spec.ts`,
  the `chromium` (Desktop Chrome) project matches them. Any future desktop-only
  spec opts in by filename.

Added `@playwright/test@1.61.1` + `@axe-core/playwright@4.12.1` (devDeps) and
the `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:visual` (`@visual`
grep), `test:a11y` (`@a11y` grep), `e2e:install`, and `qa:e2e` scripts.
**Vitest was NOT reintroduced** — `pnpm test` is still `node --test`.

New: `tests/e2e/helpers/harness.ts` (DB-free route map + PWA-install init
script) and `tests/e2e/harness-smoke.spec.ts`.

Results against the changed surface:

- **H-1** ✅ `pnpm test` green — 24 unit + all micro-specs, `node --test` only,
  no Vitest in the chain (`test:unit` runs only because `test:micro-specs`
  passed first under `&&`).
- **H-2/H-3/H-4/H-5/H-8** ✅ `pnpm test:e2e` → **2/2 green**. The smoke spec
  loaded the real `MerchantAppShell` + dashboard body on `/dev/app-harness`
  (DB-free, no Supabase, no auth) and asserted the `<h1>` venue title +
  `Recent activity` / `Do next` `<h2>` landmarks. Server reuse worked
  (`reuseExistingServer` reused a pre-started dev server). Dev-only surface
  confirmed: `/dev/app-harness/dashboard` is **404 on the prod `:3000` server**
  and **200 on the dev server** (`NODE_ENV` guard). PWA init script registered.
- **H-6** ✅ Added the `e2e` CI job (`.github/workflows/ci.yml`) — reuses
  `./.github/actions/setup` + the env placeholder block, installs chromium with
  `--with-deps`, runs `pnpm test:e2e`, uploads `playwright-report/` +
  `test-results/` on failure.
- **H-7** ✅ `tests/e2e/helpers/axe.ts` restored (used by a later a11y sweep).
- Harness files are **TS-clean** (`tsc` reports zero errors in
  `playwright.config.ts` / `tests/e2e/**`) and **ESLint-clean**.

Local-verification note: `:3000` is a foreign **prod** `next start` server that
must be preserved and whose `.next` a `next dev` would clobber. The DB-free
tier was verified by booting a dev server on `:3100` against a **temporary,
env-gated isolated dist dir** (`NABAPERKS_DIST_DIR=.next-e2e`), then reverting
that one-line `next.config.ts` edit and the `tsconfig.json` line `next dev`
auto-adds, and deleting `.next-e2e`. The harness deliverable contains **no**
runtime/config change. In CI there is no `:3000` conflict — the webServer boots
`pnpm dev` on the default port.

Pre-existing, **outside this spec's blast radius** (NOT introduced here): the
uncommitted analytics-audit batch leaves 3 `tsc` errors
(`lib/analytics/events.ts:518`, `app/app/card/actions.ts:329,374`) from
analytics event-name unions, which block repo-wide `pnpm typecheck` / `pnpm
build`. Flagged for that batch's owner.

## Verdict — 2026-06-30

**READY.** The Playwright e2e harness is restored, reconciled to current
`main`, Vitest-free, and proven by a green DB-free smoke spec; the CI `e2e` job
is wired. This is the foundation every per-domain e2e Micro-Spec hangs off.
The only non-green repo gates (`typecheck`/`build`) are pre-existing
analytics-audit-batch errors outside this blast radius.
