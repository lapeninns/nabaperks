# Plan 007: Cover the weekly-digest dedupe window with a pure core + test

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/notifications/merchant-digest.ts`
> On any change, re-verify the excerpt below before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`runMerchantWeeklyDigest` is a **live production cron** (Mondays 08:00, wired in
`vercel.json`) that emails every trial/active merchant. Its safety hinges on a
6-day dedupe window (`hasRecentMerchantWeeklyDigest`) that must prevent a
re-run or overlapping invocation from double-emailing the whole roster. Today the
only coverage is a source-grep micro-spec plus a unit test of the email
*builder* — the dedupe-window arithmetic and boundary are unexercised, so a
change from 6 days to, say, 3 (or an off-by-one on the cutoff) would ship green.
Because the module does `import "server-only"`, the fix follows this repo's
proven pattern: extract the pure window logic into a `*-core` module (like
`merchant-digest-email.ts`) and unit-test the boundary.

## Current state

```ts
// lib/notifications/merchant-digest.ts:1  -> import "server-only"  (blocks unit import)
// :27-28
const DEDUPE_WINDOW_DAYS = 6
const DEDUPE_WINDOW_MS = DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000
// :141-160
export async function hasRecentMerchantWeeklyDigest(merchantId, now = new Date()) {
  const supabase = createSupabaseServiceRoleClient()
  const since = new Date(now.getTime() - DEDUPE_WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from("product_events")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("event_name", DIGEST_EVENT_NAME)     // "merchant_weekly_digest_sent"
    .gte("created_at", since)
    .limit(1)
  // ... returns (data ?? []).length > 0
}
```

Exemplar of the repo's pure-core + unit-test pattern for this same file family:
`lib/notifications/merchant-digest-email.ts` + `tests/unit/merchant-digest-email.test.mjs`.
DB-tier exemplar (rolled-back txn, live Postgres): `tests/db/notifications.test.mjs`
and the helpers in `tests/db/helpers/db.mjs` (`inRolledBackTxn`, `isLiveDbReady`).

## Commands you will need

| Purpose    | Command            | Expected |
|------------|--------------------|----------|
| Unit tests | `pnpm test:unit`   | all pass |
| Typecheck  | `pnpm typecheck`   | exit 0   |
| DB tests (optional Step 3) | `pnpm test:db` | pass, or skips cleanly if no local Supabase |

## Scope

**In scope**:
- `lib/notifications/merchant-digest-core.ts` (create — pure, no `server-only`)
- `lib/notifications/merchant-digest.ts` (import + use the pure helper)
- `tests/unit/merchant-digest-core.test.mjs` (create)
- `tests/db/merchant-digest-dedupe.test.mjs` (create — optional, Step 3)

**Out of scope**:
- The send loop / Resend transport / dashboard fetch — do not refactor.
- `vercel.json`, cron routes.

## Git workflow

- Branch: `advisor/007-digest-dedupe-test`
- Commit: `test(notifications): cover weekly-digest dedupe window`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Extract the pure dedupe-window logic

Create `lib/notifications/merchant-digest-core.ts` (no `server-only` import):

```ts
export const MERCHANT_WEEKLY_DIGEST_EVENT_NAME = "merchant_weekly_digest_sent"
export const MERCHANT_WEEKLY_DIGEST_DEDUPE_WINDOW_DAYS = 6

const DAY_MS = 24 * 60 * 60 * 1000

/** ISO cutoff: digests sent at/after this instant count as "recent". */
export function merchantWeeklyDigestDedupeCutoff(now: Date = new Date()): string {
  return new Date(
    now.getTime() - MERCHANT_WEEKLY_DIGEST_DEDUPE_WINDOW_DAYS * DAY_MS
  ).toISOString()
}

/** True when a prior send at `lastSentAt` still suppresses a new digest. */
export function isWithinMerchantWeeklyDigestWindow(
  lastSentAt: Date,
  now: Date = new Date()
): boolean {
  return lastSentAt.toISOString() >= merchantWeeklyDigestDedupeCutoff(now)
}
```

Then in `merchant-digest.ts`: import `merchantWeeklyDigestDedupeCutoff` and
`MERCHANT_WEEKLY_DIGEST_EVENT_NAME` from the core module, replace the local
`DEDUPE_WINDOW_*` constants and the inline `since = new Date(...)` with the
helper, and use the shared event-name constant (replace the local
`DIGEST_EVENT_NAME`). Behavior must stay identical.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test:unit` (existing digest-email
test still green).

### Step 2: Unit-test the boundary

Create `tests/unit/merchant-digest-core.test.mjs` (pattern:
`tests/unit/merchant-digest-email.test.mjs`). Assert, with a fixed `now`:
- a send at `now - 5 days` → `isWithinMerchantWeeklyDigestWindow` is **true**
  (still suppressed);
- a send at `now - 7 days` → **false** (eligible again);
- the exact boundary (`now - 6 days`) behaves as the code defines (document
  whichever side it falls on — this is a characterization assertion);
- `merchantWeeklyDigestDedupeCutoff(now)` equals `now` minus 6×86_400_000 ms.

**Verify**: `pnpm test:unit` → new file passes.

### Step 3 (optional, stronger — do if a local Supabase is available): DB proof

Create `tests/db/merchant-digest-dedupe.test.mjs` modeled on
`tests/db/notifications.test.mjs`. Guard with `isLiveDbReady()` so it skips
cleanly when no DB. Inside `inRolledBackTxn`, reuse an existing merchant fixture
(see `tests/db/helpers/reward-pool-fixture.mjs` for how disposable merchants are
created), insert two `product_events` rows with
`event_name='merchant_weekly_digest_sent'` at `now-5d` and `now-7d`, then run the
same filtered query the loader uses and assert only the in-window row is
returned. If creating a merchant fixture is non-trivial, keep Step 3 as a
follow-up note and rely on Steps 1–2 (report that you deferred it).

**Verify**: `pnpm test:db` → passes or skips cleanly.

## Test plan

- Primary: `tests/unit/merchant-digest-core.test.mjs` (window boundary, cutoff
  arithmetic) — fast, deterministic, catches a window-length regression.
- Optional: `tests/db/merchant-digest-dedupe.test.mjs` (real `product_events`
  query semantics).
- Verification: `pnpm test:unit` (+ `pnpm test:db` if Step 3 done) all pass.

## Done criteria

ALL must hold:

- [ ] `lib/notifications/merchant-digest-core.ts` exists, pure, and is imported by
      `merchant-digest.ts` (no duplicated window constant remains)
- [ ] `grep -n "DEDUPE_WINDOW_MS" lib/notifications/merchant-digest.ts` → no match
      (the inline arithmetic was replaced by the helper)
- [ ] `tests/unit/merchant-digest-core.test.mjs` covers the 5-day/7-day/boundary cases
- [ ] `pnpm test:unit` and `pnpm typecheck` pass
- [ ] `pnpm test:db` passes or skips (if Step 3 attempted)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Replacing the inline cutoff changes `hasRecentMerchantWeeklyDigest`'s query
  result for a fixed input (extraction must be behavior-preserving).
- `merchant-digest-email.ts`'s existing test breaks (you touched a shared symbol).
- Step 3 requires guessing NOT-NULL columns on `merchants`/`product_events` you
  can't derive from the fixture helper — defer Step 3 and report.

## Maintenance notes

- Any change to the dedupe window must go through
  `MERCHANT_WEEKLY_DIGEST_DEDUPE_WINDOW_DAYS` and is now guarded by the unit test.
- Deferred: full send-loop accounting (attempted/sent/skipped/failed) needs the
  transport + fetch mocked; extract the loop's reducer into the core module and
  test it as a follow-up if that logic grows.
