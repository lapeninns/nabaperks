# Plan 014: Upgrade `@supabase/ssr` 0.10 → 0.12 behind the auth test surface

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- package.json pnpm-lock.yaml lib/supabase`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (runtime auth cookie handling; pre-1.0 dep so breaking changes are expected)
- **Depends on**: plan 006 recommended (a session-refresh test makes this safer)
- **Category**: dependencies
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`@supabase/ssr` is the only runtime dependency with a real major-ish gap
(`0.10.3 → 0.12.0`) and it sits on the auth cookie path (`createServerClient` in
`lib/supabase/update-session.ts` and the server/client factories in
`lib/supabase/*`). It is pre-1.0, so minor bumps can carry breaking changes;
staying current keeps the auth layer supported. This is the dependency worth
scheduling deliberately (unlike the dev-only eslint 10 / `@types/node` 26 bumps,
which can wait). It must land behind the auth behavioral tests, not on a version
bump alone.

## Current state

- `package.json:59` — `"@supabase/ssr": "^0.10.3"`.
- Consumers to re-verify after the bump:
  - `lib/supabase/update-session.ts` — `createServerClient(...)` with the
    `cookies: { getAll, setAll }` adapter (the API most likely to shift between
    0.10 and 0.12).
  - `lib/supabase/server.ts` / client factory files (grep
    `grep -rln "@supabase/ssr" lib app`).
- Behavioral safety nets: `tests/db/customer-session.test.mjs`,
  `tests/db/tenant-rls.test.mjs` (auth context), the e2e login flows
  (`tests/e2e/customer-login*.spec.ts`, `tests/e2e/merchant-safe-redirect*.spec.ts`),
  and — if plan 006 landed — `tests/unit/refresh-supabase-session.test.mjs`.

## Commands you will need

| Purpose    | Command                | Expected |
|------------|------------------------|----------|
| Bump+relock| `pnpm add @supabase/ssr@^0.12.0` | lockfile updates; exit 0 |
| Typecheck  | `pnpm typecheck`       | exit 0   |
| Build      | `pnpm build`           | exit 0   |
| Unit tests | `pnpm test:unit`       | pass     |
| DB tests   | `pnpm test:db`         | pass (run locally — auth context proof) |

## Suggested executor toolkit

- Read the `@supabase/ssr` CHANGELOG / release notes for 0.11 and 0.12 before
  bumping — specifically any change to the `cookies` adapter (`getAll`/`setAll`
  vs the older `get`/`set`/`remove`) and `createServerClient`/`createBrowserClient`
  signatures.

## Scope

**In scope**:
- `package.json` (the one dependency), `pnpm-lock.yaml` (regenerated).
- `lib/supabase/*` — only the minimal edits the new API requires.

**Out of scope**:
- Any other dependency bump.
- Auth business logic beyond adapting to the new `@supabase/ssr` API surface.

## Git workflow

- Branch: `advisor/014-upgrade-supabase-ssr`
- Commit: `chore(deps): upgrade @supabase/ssr to 0.12`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the changelog, then bump

Review 0.11/0.12 release notes. Run `pnpm add @supabase/ssr@^0.12.0`.

### Step 2: Adapt consumers to any API change

If `createServerClient`'s cookie adapter changed, update
`lib/supabase/update-session.ts` and the other factories to the new shape,
preserving identical behavior (getAll/setAll semantics, options passthrough).

**Verify**: `pnpm typecheck && pnpm build` → exit 0.

### Step 3: Prove auth still works

- `pnpm test:unit` (incl. the session-refresh test if present) → pass.
- `pnpm test:db` (run locally with Supabase up) → `customer-session` and
  `tenant-rls` pass (auth context intact).
- Manual login smoke (strongly recommended): run the app, sign in as a merchant,
  soft-navigate, confirm the session persists (this is the real regression risk —
  token rotation writing cookies).

## Test plan

- No new tests required if 006 landed; otherwise consider adding it first.
- Verification: `pnpm typecheck`, `pnpm build`, `pnpm test:unit`, `pnpm test:db`
  all pass, plus a manual login+soft-nav smoke.

## Done criteria

ALL must hold:

- [ ] `@supabase/ssr` is `^0.12.x` in `package.json`; lockfile relocked
- [ ] `pnpm typecheck`, `pnpm build`, `pnpm test:unit` pass
- [ ] `pnpm test:db` passes (executed, not skipped) for the auth-context suites
- [ ] Manual merchant login + soft-nav keeps the session (no random logout)
- [ ] Only `@supabase/ssr` changed in the lockfile diff (no incidental bumps)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- The cookie adapter API changed in a way that isn't a mechanical adaptation
  (report the new contract before guessing).
- `pnpm test:db` auth suites fail after the bump (a real regression — do not ship).
- You cannot run a manual login smoke or the DB tier (auth is too load-bearing to
  bump blind — hand back with the changelog notes).

## Maintenance notes

- Defer eslint 9→10 and `@types/node` 25→26 to a separate quiet-window chore;
  they are dev-only and unrelated to runtime auth.
- Reviewer: scrutinize `update-session.ts` — the setAll/response-rebuild is the
  regression-prone seam.
