# Plan 016: Make the join RPC fail loud on unexpected result shape

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- app/m/[merchantSlug]/join/actions.ts supabase/migrations`

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (defensive hardening)
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

The customer-join server action checks the RPC's `error`, but then reads
`data?.[0]?.membership_id` with no shape validation and branches the entire join
outcome on its truthiness. If the RPC's OUT columns ever drift (a real risk given
the dependent, idempotent migration chain), `membershipId` becomes `undefined`,
a **successful DB write** silently skips analytics + the success path, and the
user sees "nothing happened" with nothing logged. This is fail-quiet on the core
join path. The goal is to make an unexpected shape **loud** (logged, surfaced),
without changing any legitimate branch. It is LOW confidence — there is no current
drift — so the executor must first confirm whether a missing `membership_id` is
ever a legitimate outcome before adding a hard failure.

## Current state

```ts
// app/m/[merchantSlug]/join/actions.ts:256-281
const supabase = createSupabaseServiceRoleClient()
const { data, error } = await supabase.rpc("join_customer_membership_with_first_stamp", {
  p_customer_id: customer.id, p_merchant_slug: merchantSlug, p_qr_id: qrId || null,
  p_marketing_opt_in: marketingOptIn, p_policy_version: policyVersion,
})
if (error) {
  return { errors: { form: "Rewards could not be joined. Try again or ask the venue team." } }
}
const row = data?.[0]
const membershipId = row?.membership_id           // <-- undefined on shape drift → silent skip
const firstStampIssued = row?.first_stamp_issued === true
const geoFlagged = row?.geo_flagged === true
if (membershipId) { /* analytics + success path */ }
// ...falls through when membershipId is missing
```
- Similar unguarded `data?.[0]?.…` reads exist in `app/app/card/actions.ts` and
  `app/app/qr/actions.ts` — out of scope here (see Maintenance).
- `logger` is available in the codebase (`@/lib/observability/logger`).

## Commands you will need

| Purpose    | Command          | Expected |
|------------|------------------|----------|
| Typecheck  | `pnpm typecheck` | exit 0   |
| Micro-specs| `pnpm test:micro-specs` | pass |
| DB tests   | `pnpm test:db`   | pass (or skip) — the join RPC contract lives here |

## Scope

**In scope**:
- `app/m/[merchantSlug]/join/actions.ts` (this one action).
- `tests/micro-specs/customer-join-contract.test.mjs` (extend if it exists).

**Out of scope**:
- The `join_customer_membership_with_first_stamp` RPC/migration (do NOT change
  DB behavior — this is app-layer hardening).
- The `card`/`qr` action callsites (a follow-up, not this plan).

## Git workflow

- Branch: `advisor/016-join-fail-loud`
- Commit: `fix(customer): surface unexpected join RPC result shape`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Determine whether a missing `membership_id` is ever legitimate

Read the RPC body (`grep -rn "join_customer_membership_with_first_stamp"
supabase/migrations` → open the defining migration). Confirm: on a successful
call (no error), does it **always** return a row with `membership_id`, or can it
return an empty set / null membership for a legitimate case (e.g. already a
member)? This decides Step 2.

### Step 2: Add the guard

- **If `membership_id` is always present on success**: after `if (error) {...}`,
  add:
  ```ts
  const row = data?.[0]
  const membershipId = row?.membership_id
  if (!membershipId) {
    logger.error("customer_join_unexpected_rpc_shape", {
      merchantSlug, hasRow: Boolean(row),
    })
    return { errors: { form: "Rewards could not be joined. Try again or ask the venue team." } }
  }
  ```
  (Log the shape problem and surface the same generic error the `error` branch
  uses — no raw PII in the log; use `merchantSlug`/booleans only.)
- **If a missing `membership_id` IS legitimate** for some outcome: do NOT add a
  hard failure. Instead add a `logger.warn` on the unexpected-shape case only
  (distinguish it from the legitimate no-membership outcome), preserving all
  current control flow. Document which case is legitimate.

**Verify**: `pnpm typecheck` → exit 0; `pnpm test:micro-specs` → pass;
`pnpm test:db` → pass or skip (join contract intact).

## Test plan

- If `tests/micro-specs/customer-join-contract.test.mjs` exists, extend it to
  assert the action logs/surfaces on a missing-membership result (source-grep is
  acceptable here since the behavior is a log + error return).
- Verification: `pnpm test:micro-specs` + `pnpm typecheck` pass.

## Done criteria

ALL must hold:

- [ ] The join action no longer silently continues when `error` is null but
      `membership_id` is missing — it either fails loud (logged + generic error)
      or, if that outcome is legitimate, logs a distinct warning without changing
      the legitimate branch
- [ ] No raw customer PII appears in the new log call
- [ ] `pnpm typecheck`, `pnpm test:micro-specs` pass; `pnpm test:db` passes or skips
- [ ] Only `app/m/[merchantSlug]/join/actions.ts` (+ its test) changed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- The RPC legitimately returns no `membership_id` in a case you can't
  distinguish from drift (then a hard failure would break a real path — log only
  and report).
- Changing this action would require touching the RPC/migration (out of scope).

## Maintenance notes

- Follow-up (separate plan): apply the same fail-loud guard to the `data?.[0]?.…`
  reads in `app/app/card/actions.ts` and `app/app/qr/actions.ts`.
- Reviewer: confirm the guard doesn't swallow a legitimate outcome and that the
  log carries no PII.
