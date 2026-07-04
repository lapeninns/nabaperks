# Plan 009: Finish splitting `activity.ts` — extract the fetch/enrichment layer

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/merchant/activity.ts lib/merchant/activity-display.ts`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/005 (the pure display core must be extracted and tested first)
- **Category**: tech-debt
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

After plan 005 moves the pure display/formatting logic out, `lib/merchant/activity.ts`
still mixes the Supabase fetch, the enrichment (staff/reward map building), and
the summary query in one server module. Extracting the fetch/enrichment layer
leaves `activity.ts` as a thin orchestrator over two clearly named modules,
shrinking the repo's largest file and making future event/query changes local.
This is polish, not correctness — do it only after 005 has landed the
characterization tests that protect the transformation.

## Current state (post-005)

- `lib/merchant/activity.ts` retains the `server-only` import and the server IO:
  - `getEnrichedMerchantActivity(...)` (`:130`) — Supabase reads + builds
    `staffById` / `rewardById` maps + calls `toActivityDisplayRow` (now imported
    from `./activity-display`).
  - `getMerchantActivitySummary(...)` (`:295`) — summary read.
  - `createSupabaseServiceRoleClient()` used at `:137,316` (and previously at
    1055/1079/1103 — confirm which remain after 005).
- Pure logic now lives in `lib/merchant/activity-display.ts` (from plan 005).

## Commands you will need

| Purpose          | Command                 | Expected |
|------------------|-------------------------|----------|
| Typecheck        | `pnpm typecheck`        | exit 0   |
| Build            | `pnpm build`            | exit 0   |
| Unit tests       | `pnpm test:unit`        | all pass |
| Micro-spec tests | `pnpm test:micro-specs` | all pass |

## Scope

**In scope**:
- `lib/merchant/activity-fetching.ts` (create — the Supabase fetch + enrichment;
  keeps `server-only`).
- `lib/merchant/activity.ts` (becomes a thin re-export/orchestrator).

**Out of scope**:
- `lib/merchant/activity-display.ts` (owned by plan 005).
- Any UI consumer — public export surface of `@/lib/merchant/activity` stays identical.
- Query behavior — this is a move, not a rewrite.

## Git workflow

- Branch: `advisor/009-activity-fetch-split`
- Commit: `refactor(merchant): split activity fetch layer out of activity.ts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Move fetch/enrichment into `activity-fetching.ts`

Create `lib/merchant/activity-fetching.ts` (`import "server-only"`). Move
`getEnrichedMerchantActivity`, `getMerchantActivitySummary`, and their private
Supabase helpers there, importing display symbols from `./activity-display`.

### Step 2: Reduce `activity.ts` to re-exports

`lib/merchant/activity.ts` re-exports the public surface from
`./activity-fetching` and `./activity-display` so every existing
`@/lib/merchant/activity` import keeps resolving. No consumer edits.

**Verify**:
- `pnpm typecheck` → exit 0.
- `pnpm build` → exit 0 (all six consumers still compile).
- `pnpm test:unit && pnpm test:micro-specs` → all pass.
- `wc -l lib/merchant/activity.ts` → now a small file (target < 60 lines of
  re-exports; the number isn't a hard gate, but it should be dramatically smaller).

## Done criteria

ALL must hold:

- [ ] `lib/merchant/activity-fetching.ts` holds the Supabase fetch/enrichment
- [ ] `lib/merchant/activity.ts` is re-exports only; public import surface unchanged
- [ ] `pnpm typecheck`, `pnpm build`, `pnpm test:unit`, `pnpm test:micro-specs` all pass
- [ ] No UI consumer file changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- Plan 005 has NOT landed (no `activity-display.ts`) — do that first.
- A consumer imports a private helper you're moving (report the coupling).
- The split forces a query/behavior change to compile (it should not).

## Maintenance notes

- Keep the three-file shape: `activity-display.ts` (pure) · `activity-fetching.ts`
  (IO) · `activity.ts` (facade).
- Reviewer: diff should be pure code motion — no query or transformation logic
  changed.
