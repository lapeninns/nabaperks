# Plan 001: Cron routes authorize via a single timing-safe helper

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- app/api/cron lib/security lib/notifications/standard-webhook.ts`
> If any listed file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / tech-debt
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

The three Vercel cron endpoints each gate privileged, side-effecting work: bulk
merchant email (`merchant-digest`), the push-delivery worker (`notifications`),
and a **destructive** stale-PII purge (`privacy-retention`, calls
`admin_purge_stale_customer_pii`). All three authorize the caller by comparing
the `Authorization` header against `Bearer ${CRON_SECRET}` with JavaScript `===`,
which short-circuits on the first differing byte and therefore leaks timing
about the secret. The same repo already does this correctly elsewhere with
`crypto.timingSafeEqual` (Standard Webhook verification, customer session
cookies). Separately, the identical guard is **copy-pasted into all three route
files**, so any future hardening must be made in three places or the routes
drift. This plan replaces the three copies with one shared, timing-safe helper.
Practical remote exploitability is low (network jitter dominates), so this is
hardening, not an active breach — but the blast radius on the retention route is
high, so it is worth doing cheaply and correctly.

## Current state

- `app/api/cron/notifications/route.ts` — push-delivery cron. Local guard at the
  bottom:
  ```ts
  // app/api/cron/notifications/route.ts:24-29
  function isAuthorizedCronRequest(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim()
    if (!secret) return false

    return request.headers.get("authorization") === `Bearer ${secret}`
  }
  ```
- `app/api/cron/merchant-digest/route.ts:25-30` — **byte-for-byte identical**
  `isAuthorizedCronRequest`.
- `app/api/cron/privacy-retention/route.ts:48-53` — **byte-for-byte identical**
  `isAuthorizedCronRequest`.
- Each route calls it the same way at the top of its `GET`:
  ```ts
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }
  ```
- The fail-closed check (`if (!secret) return false`) is **correct** — keep it.
- Exemplar of the timing-safe pattern to match — `lib/notifications/standard-webhook.ts`:
  ```ts
  // top of file
  import { createHmac, timingSafeEqual } from "node:crypto"
  // inside signaturesMatch(...)
  const candidate = Buffer.from(signature)
  const expectedBuf = Buffer.from(expected)
  return (
    candidate.length === expectedBuf.length &&
    timingSafeEqual(candidate, expectedBuf)
  )
  ```
  (`lib/customer/session-cookie-core.ts:135` uses the same idiom.)

Repo conventions: helpers live under `lib/<domain>/`; security helpers under
`lib/security/` (e.g. `lib/security/csp.ts` already exists). Imports use the
`@/` path alias. Files are ESM/TypeScript, 2-space indent, no semicolons at
statement ends is **not** the style — this repo omits semicolons (Prettier
config). Match the surrounding files exactly.

## Commands you will need

| Purpose        | Command                                        | Expected on success |
|----------------|------------------------------------------------|---------------------|
| Install        | `pnpm install`                                 | exit 0              |
| Typecheck      | `pnpm typecheck`                               | exit 0, no errors   |
| Lint           | `pnpm lint`                                    | exit 0              |
| Unit tests     | `pnpm test:unit`                               | all pass            |
| Micro-spec tests | `pnpm test:micro-specs`                      | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `lib/security/cron-auth.ts` (create)
- `app/api/cron/notifications/route.ts`
- `app/api/cron/merchant-digest/route.ts`
- `app/api/cron/privacy-retention/route.ts`
- `tests/unit/cron-auth.test.mjs` (create)

**Out of scope** (do NOT touch):
- The body/behavior of any cron `GET` handler beyond swapping the guard call.
- `CRON_SECRET` wiring in `vercel.json`, `.env.example`, or `config/` — unchanged.
- `standard-webhook.ts` / `session-cookie-core.ts` — reference only, do not edit.

## Git workflow

- Branch: `advisor/001-cron-auth-timing-safe`
- Commit message style (match `git log`, conventional commits):
  `refactor(security): centralize cron auth behind a timing-safe helper`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the shared timing-safe helper

Create `lib/security/cron-auth.ts`:

```ts
import { timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"

/**
 * Authorizes a Vercel cron request by comparing the Authorization header
 * against `Bearer ${CRON_SECRET}` in constant time. Fail-closed: an unset or
 * empty CRON_SECRET rejects every request (crons only run when the secret is
 * configured in the environment).
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (!header) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(header)
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  )
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Replace the three local guards with the shared import

In each of `app/api/cron/notifications/route.ts`,
`app/api/cron/merchant-digest/route.ts`,
`app/api/cron/privacy-retention/route.ts`:

1. Add the import near the other `@/lib/...` imports:
   `import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"`
2. Delete the local `function isAuthorizedCronRequest(request: NextRequest) { ... }`
   definition entirely.
3. Leave the `if (!isAuthorizedCronRequest(request))` call site unchanged.

**Verify**:
- `pnpm typecheck` → exit 0.
- `grep -rn "function isAuthorizedCronRequest" app/api/cron` → **no matches**
  (all three local copies gone).
- `grep -rln "@/lib/security/cron-auth" app/api/cron` → **three files**.

### Step 3: Add a behavioral unit test for the helper

Create `tests/unit/cron-auth.test.mjs`. Model its structure on an existing unit
test in `tests/unit/` (e.g. `tests/unit/safe-next-path.test.mjs` — same
`node:test` + `node:assert/strict` + `@/`-alias import via the alias loader).
Cover:
- rejects when `CRON_SECRET` is unset/empty (set `delete process.env.CRON_SECRET`);
- rejects a missing `Authorization` header;
- rejects a wrong token of the **same length** (proves the compare runs, not
  just a length check);
- rejects a token of different length;
- accepts the exact `Bearer <secret>`.

Build a minimal request stub with a `headers.get(name)` method — the helper only
reads `request.headers.get("authorization")`, so you do **not** need a real
`NextRequest`; a `{ headers: { get: (k) => k === "authorization" ? value : null } }`
object cast is sufficient. Save/restore `process.env.CRON_SECRET` around the
tests.

**Verify**: `pnpm test:unit` → all pass, including the new `cron-auth` cases.

## Test plan

- New file `tests/unit/cron-auth.test.mjs` with the five cases above.
- Structural pattern: `tests/unit/safe-next-path.test.mjs`.
- The existing source-grep micro-spec `tests/micro-specs/marketing-auth-legal.test.mjs`
  may assert cron-auth source shape — run `pnpm test:micro-specs`; if a
  cron-auth assertion now fails because it greps for the old inline function,
  update that assertion to look for the shared import instead (this is in-scope
  for a test file). If it passes, leave it.
- Verification: `pnpm test:unit && pnpm test:micro-specs` → all pass.

## Done criteria

ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `grep -rn "function isAuthorizedCronRequest" app/api/cron` returns no matches
- [ ] `lib/security/cron-auth.ts` exists and uses `timingSafeEqual`
- [ ] `pnpm test:unit` passes with new `tests/unit/cron-auth.test.mjs`
- [ ] `pnpm test:micro-specs` passes
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the three cron routes' guard no longer matches the "Current state"
  excerpt (drift — someone already changed the auth pattern).
- A cron route imports `CRON_SECRET` in a way other than
  `process.env.CRON_SECRET` (the helper assumes env access).
- `pnpm test:micro-specs` fails in a way that is **not** the expected cron-auth
  grep assertion above.
- You find a fourth caller of an inline cron auth check outside `app/api/cron/`.

## Maintenance notes

- Any future cron endpoint must import `isAuthorizedCronRequest` from
  `lib/security/cron-auth.ts` — never re-inline the check.
- If the secret transport changes (e.g. Vercel switches to a signed header),
  update only `lib/security/cron-auth.ts`.
- Reviewer should confirm the `Buffer.length` guard is present (calling
  `timingSafeEqual` on unequal-length buffers throws).
- Deferred: rotating `CRON_SECRET` is an ops action, not part of this code
  change; recommend it only if the timing weakness is judged to have been
  exposed.
