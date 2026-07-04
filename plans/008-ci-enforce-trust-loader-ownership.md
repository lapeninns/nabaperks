# Plan 008: CI-enforce the QR/reward ownership filters with a DB behavioral test

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/merchant/qr-code.ts tests/micro-specs/launch-qr-readiness.test.mjs`
> On any change, re-verify the excerpts below before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

The QR-image loader's ownership guard is a moat-adjacent invariant: a merchant
must only be able to render an owned, **active**, **join**-type QR. Today the
CI-enforced coverage of that guard is a **source-grep** micro-spec
(`assert.match(readFileSync(...), /\.eq\("merchant_id"/)`) — it verifies the
filter *string exists in the source*, not that a wrong-owner or inactive request
is actually rejected. A refactor that rewords the query (e.g. `.match({...})` or
a shared filter helper) breaks the grep as a false negative; conversely an IDOR
regression that keeps the substring passes green. A behavioral live-DB spec
(`tests/e2e/merchant-qr-image-route.desktop.spec.ts`) does exist, but the CI
e2e job only runs `--grep "@governance|@a11y|PWA offline fallback|architecture
remediation harness gate"`, so that proof does **not** run in CI. This plan adds
a DB-tier test — which **does** run in CI's `db` job — asserting the ownership
filter behaviorally, so the invariant is protected by an executing test, not a
string match.

## Current state

```ts
// lib/merchant/qr-code.ts:182-194 — the ownership filter to prove
async function loadOwnedQrImageContext({ qrCodeId, merchant }) {
  const supabase = createSupabaseServiceRoleClient()
  const { data: qrCode } = await supabase
    .from("qr_codes")
    .select("id, qr_id, destination_type, is_active, location_id, loyalty_card_id")
    .eq("id", qrCodeId)
    .eq("merchant_id", merchant.id)      // ownership
    .eq("destination_type", "join")      // join-only
    .eq("is_active", true)               // active-only
    .maybeSingle()
  // ... returns null when no row
}
```
- Source-grep spec today: `tests/micro-specs/launch-qr-readiness.test.mjs:99-128`
  (matches the `.eq(...)` substrings — keep it as a cheap doc-anchor).
- The loader itself is app code coupled to `getCurrentMerchant()` + the
  service-role client, so it can't be called directly from the DB tier; instead
  assert the **equivalent query semantics** against seeded rows (this is exactly
  how the DB moat proves RLS/ownership — see `tests/db/tenant-rls.test.mjs`).
- DB-tier helpers: `tests/db/helpers/db.mjs` (`inRolledBackTxn`, `isLiveDbReady`);
  fixture creation pattern: `tests/db/helpers/reward-pool-fixture.mjs`.
- CI runs the DB tier in the `db` job (`.github/workflows/ci.yml`:
  `supabase start` → `pnpm db:seed` → `pnpm test:db`).

## Commands you will need

| Purpose  | Command         | Expected |
|----------|-----------------|----------|
| DB tests | `pnpm test:db`  | pass; skips cleanly if no local Supabase reachable |
| Typecheck| `pnpm typecheck`| exit 0   |

To run the DB tier locally you need a local Supabase (`supabase start`) and
`SUPABASE_DB_URL` (`.env.local` points at `127.0.0.1:54322`). If unavailable,
the tier **skips** — write the test to skip via `isLiveDbReady()` and note that
CI will execute it.

## Scope

**In scope**:
- `tests/db/qr-image-ownership.test.mjs` (create)

**Out of scope**:
- `lib/merchant/qr-code.ts` — do NOT change the loader; you are proving current
  behavior.
- `tests/micro-specs/launch-qr-readiness.test.mjs` — leave the source-grep spec
  as-is (cheap doc-anchor).
- Reward-detail loader coverage — see Maintenance notes (deferred to keep this
  plan single-invariant and reviewable).

## Git workflow

- Branch: `advisor/008-qr-ownership-db-test`
- Commit: `test(db): behaviorally enforce QR image ownership filter`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the DB behavioral test

Create `tests/db/qr-image-ownership.test.mjs` modeled on
`tests/db/tenant-rls.test.mjs` + the fixture helper. Guard the suite so it skips
when `isLiveDbReady()` is false. Inside `inRolledBackTxn`:
1. Create (or reuse the fixture helper to create) **two** merchants A and B, each
   with a primary location and an active loyalty card.
2. Insert a `qr_codes` row owned by A: `destination_type='join'`, `is_active=true`.
3. Run the same `select ... from qr_codes where id = $1 and merchant_id = $2 and
   destination_type = 'join' and is_active = true` used by the loader and assert:
   - as owner A → returns the row;
   - as merchant B (wrong owner) → returns **no** row;
   - flip `is_active=false` → returns **no** row;
   - set `destination_type` to a non-join value → returns **no** row.

Use raw parameterized SQL through the `postgres` tx (this mirrors the loader's
`.eq(...)` chain); do not import the app loader.

**Verify**: `pnpm test:db` → the new suite passes (or skips cleanly if no DB).

### Step 2: Confirm the source-grep spec still passes

`pnpm test:micro-specs` → all pass (you didn't touch it; this confirms the
loader source is unchanged).

## Test plan

- New `tests/db/qr-image-ownership.test.mjs` proving owner/active/join filtering
  behaviorally, executed by CI's `db` job.
- Pattern: `tests/db/tenant-rls.test.mjs` + `tests/db/helpers/reward-pool-fixture.mjs`.
- Verification: `pnpm test:db` passes or skips; `pnpm test:micro-specs` passes.

## Done criteria

ALL must hold:

- [ ] `tests/db/qr-image-ownership.test.mjs` exists and asserts all four cases
      (owner ✓, wrong-owner ✗, inactive ✗, non-join ✗)
- [ ] It skips cleanly via `isLiveDbReady()` when no DB is present
- [ ] `pnpm test:db` passes locally (or skips) and the file is included by the
      `tests/db/*.test.mjs` glob
- [ ] `pnpm test:micro-specs` still passes (loader source untouched)
- [ ] `lib/merchant/qr-code.ts` is unchanged (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The loader's filter set no longer matches the "Current state" excerpt (the
  invariant changed — re-derive the assertions from the live code).
- Creating merchant/location/card/qr fixtures requires NOT-NULL columns you can't
  derive from `reward-pool-fixture.mjs` (report the schema gap; consider
  extending the fixture helper rather than guessing).
- The DB tier cannot start locally AND you cannot confirm the test at least
  imports/loads (report that CI will be the first real run).

## Maintenance notes

- Deferred (a natural follow-up plan): the reward-detail loader's `customer_id`
  ownership + redeemability gate is likewise pinned by a source-grep spec
  (`tests/micro-specs/customer-reward-detail-contract.test.mjs`); the redemption
  *RPC* is already behaviorally covered in `tests/db/reward-redemption-edges.test.mjs`,
  so add loader-level behavioral coverage only if a refactor is planned there.
- Reviewer: the value is that this test **executes in CI** (unlike the local-only
  Playwright lane), so an ownership regression fails the build.
