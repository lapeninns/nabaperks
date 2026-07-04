# Plan 005: Extract a pure activity-display core and characterization-test it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/merchant/activity.ts lib/merchant/customer-identity-display.ts`
> On any change, re-verify the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests / tech-debt
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`lib/merchant/activity.ts` is the largest file in the repo (1389 lines), feeds
six merchant UI surfaces, and recently took a **data-exposure-sensitive** change
(scoping service-role reads to a masked view) — yet it has **zero tests** in any
tier. The core risk lives in a ~445-line `toActivityDisplayRow` switch that maps
15+ event types to display rows, plus the summary/formatting helpers. Because the
module does `import "server-only"` and constructs a Supabase service-role client,
it **cannot be imported by the unit-test tier** (which only runs pure modules via
the `@/` alias loader). This repo's established fix for exactly this situation is
to extract the pure logic into a `*-core`/pure module and unit-test that (see
`lib/customer/activity-core.ts` + `tests/unit/customer-activity.test.mjs`, and
`lib/merchant/launch-readiness-core.ts` + `tests/unit/launch-readiness-core.test.mjs`).
This plan does that extraction for the display/formatting logic and adds
characterization tests, which also unblocks the safe split in plan 009.

## Current state

- `lib/merchant/activity.ts:1` — `import "server-only"` (this is why the module
  can't be unit-tested as-is).
- `lib/merchant/activity.ts:11,137,316,1055,...` — constructs
  `createSupabaseServiceRoleClient()` (server IO).
- Pure-ish transformation + helpers that should move to a pure module:
  - `toActivityDisplayRow(row, staffById, rewardById): ActivityDisplayRow`
    (`:411-856`, **not currently exported**) — the 445-line event switch.
  - `summarizeActivity(rows: ActivityDisplayRow[]): ActivitySummary`
    (`:375`, already `export`ed, pure).
  - Local helpers it calls: `activityCategory(eventName)`, `activityBaseFields(...)`,
    `first(...)`, `isDetail(...)`, and the date/relative-time/search-index
    formatting functions in the `:948-1389` range.
  - The display **types**: `ActivityEventName`, `ActivityCategory`,
    `ActivityDetail`, `ActivityAction`, `ActivityDisplayRow`, `ActivitySummary`
    (`:31-77`), plus the internal `RawActivityRow` type.
- `toActivityDisplayRow` calls `formatMerchantCustomerIdentifier` from
  `@/lib/merchant/customer-identity-display`. **Verify that module is pure**
  (no `server-only` import) before moving code that depends on it — see STOP
  conditions.

Exemplars to match (this repo's pure-core convention):
- Pure core + its unit test: `lib/customer/activity-core.ts` +
  `tests/unit/customer-activity.test.mjs`.
- Unit-test file shape: `tests/unit/launch-readiness-core.test.mjs`
  (`node:test` + `node:assert/strict` + `@/`-alias imports; run via
  `pnpm test:unit`).

## Commands you will need

| Purpose          | Command                    | Expected |
|------------------|----------------------------|----------|
| Typecheck        | `pnpm typecheck`           | exit 0   |
| Lint             | `pnpm lint`                | exit 0   |
| Unit tests       | `pnpm test:unit`           | all pass |
| Micro-spec tests | `pnpm test:micro-specs`    | all pass |
| Build            | `pnpm build`               | exit 0   |

## Scope

**In scope**:
- `lib/merchant/activity-display.ts` (create — pure: types + `toActivityDisplayRow`
  + `summarizeActivity` + the display/formatting helpers they use). No
  `server-only` import.
- `lib/merchant/activity.ts` (re-export the moved symbols from the new module and
  delete the moved definitions; keep the server-side fetch/enrichment functions).
- `tests/unit/merchant-activity-display.test.mjs` (create).

**Out of scope** (do NOT touch):
- The Supabase fetch/enrichment bodies of `getEnrichedMerchantActivity`
  (`:130`) and `getMerchantActivitySummary` (`:295`) — leave them in
  `activity.ts`; plan 009 handles the fetch-layer split.
- Any of the six UI consumers of these exports — the public export surface of
  `activity.ts` must stay identical (re-export, don't rename).
- `lib/merchant/customer-identity-display.ts` — reference only.

## Git workflow

- Branch: `advisor/005-activity-pure-core`
- Commit style: `refactor(merchant): extract pure activity-display core` then
  `test(merchant): characterize activity display mapping`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm the dependency is pure

`grep -n "server-only" lib/merchant/customer-identity-display.ts` → expect **no
match**. If it imports `server-only`, STOP (see STOP conditions) — the extraction
needs a different seam.

### Step 2: Create the pure module

Create `lib/merchant/activity-display.ts` with **no** `server-only` import. Move
into it, unchanged in behavior:
- the display types (`ActivityEventName`, `ActivityCategory`, `ActivityDetail`,
  `ActivityAction`, `ActivityDisplayRow`, `ActivitySummary`, `RawActivityRow`);
- `toActivityDisplayRow` (add `export`);
- `summarizeActivity`;
- the pure helpers they call (`activityCategory`, `activityBaseFields`, `first`,
  `isDetail`, and the date/relative-time/search-index formatters).

Keep names identical. Import `formatMerchantCustomerIdentifier` from its module.

### Step 3: Re-export from `activity.ts`

In `lib/merchant/activity.ts`, delete the moved definitions and re-export from
the new module so every existing import path keeps working:
```ts
export {
  toActivityDisplayRow,
  summarizeActivity,
  type ActivityDisplayRow,
  type ActivitySummary,
  // ...every symbol other files import from "@/lib/merchant/activity"
} from "./activity-display"
```
Keep the server-side fetchers (`getEnrichedMerchantActivity`,
`getMerchantActivitySummary`) in `activity.ts`, now importing the moved helpers
from `./activity-display`.

**Verify**: `pnpm typecheck` → exit 0; `pnpm build` → exit 0 (proves no consumer
broke).

### Step 4: Characterization tests for the transformation

Create `tests/unit/merchant-activity-display.test.mjs`, modeled on
`tests/unit/customer-activity.test.mjs`. Build a small `RawActivityRow` fixture
factory and assert `toActivityDisplayRow` output for the highest-value cases:
- a `stamp_issued` row → correct title/category/customer label;
- a `reward_redeemed` / `reward_unlocked` row → reward name resolved from
  `metadata.reward_name` AND from the `rewardById` pool map fallback;
- a `qr_scanned` / QR lifecycle row → QR-category mapping;
- a staff-actor row → the "Staff" detail is populated from `staffById`;
- a masked customer identifier is used (no raw email/phone leaks into the display
  row) — this is the security-sensitive characterization.
Then assert `summarizeActivity([...])` totals/threading for a mixed set.

**Verify**: `pnpm test:unit` → all pass, including the new file.

### Step 5: Reconcile any source-grep micro-spec

`pnpm test:micro-specs` — if a spec greps `activity.ts` for a symbol you moved,
update it to point at `activity-display.ts` (test files are in scope). If green,
leave it.

**Verify**: `pnpm test:micro-specs` → all pass.

## Test plan

- New `tests/unit/merchant-activity-display.test.mjs` with the cases in Step 4.
- Pattern: `tests/unit/customer-activity.test.mjs`.
- Full verification: `pnpm test:unit && pnpm test:micro-specs && pnpm typecheck && pnpm build` all green.

## Done criteria

ALL must hold:

- [ ] `lib/merchant/activity-display.ts` exists, is pure (no `server-only`),
      and exports `toActivityDisplayRow` + `summarizeActivity`
- [ ] `activity.ts` re-exports the moved symbols; its public import surface is unchanged
- [ ] `tests/unit/merchant-activity-display.test.mjs` exists and covers the Step-4 cases
- [ ] `pnpm test:unit`, `pnpm test:micro-specs`, `pnpm typecheck`, `pnpm build` all exit 0/pass
- [ ] `grep -rn "server-only" lib/merchant/activity-display.ts` → no match
- [ ] No UI consumer file was modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `lib/merchant/customer-identity-display.ts` imports `server-only` (the
  transformation's dependency isn't pure — needs a different extraction seam).
- Moving a helper drags in a `server-only`/Supabase import you can't leave behind
  (the boundary is wrong — report which symbol).
- A UI consumer fails to typecheck after the re-export (an import path or type
  name changed — do not rename to fix; restore the exact export).
- The transformation's behavior would change to make a test pass (characterization
  tests must capture *current* behavior, even if it looks wrong — report the
  suspicious behavior instead of "fixing" it here).

## Maintenance notes

- New event types get a case in `toActivityDisplayRow` in `activity-display.ts`
  **and** a test case in the characterization suite.
- This plan intentionally leaves the fetch/enrichment layer in `activity.ts`;
  plan 009 completes the split now that the pure core is testable.
- Reviewer: confirm no raw customer PII (email/phone) can appear in an
  `ActivityDisplayRow` — the masked-identifier test guards this.
