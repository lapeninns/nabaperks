# Plan 006: Add a behavioral test for `refreshSupabaseSession`

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. If a "STOP condition" occurs, stop and report.
> Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/supabase/update-session.ts proxy.ts`
> On any change, re-verify the excerpt below before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only; no source change)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`refreshSupabaseSession` runs on the edge on **every request** (via `proxy.ts`)
and is what keeps merchants/customers logged in across Supabase token rotation —
its own docstring says "without this ... merchants appear randomly logged out."
The subtle part is the cookie `setAll` → `createResponse()` rebuild: on token
rotation the Supabase client calls `setAll`, which must (a) mirror cookies onto
the *request* for downstream RSC reads and (b) write them onto a **freshly
created** response with the right options. A regression here silently logs users
out or drops rotated tokens, and nothing currently catches it. This adds a focused
test around that contract without touching the (correct) source.

## Current state

```ts
// lib/supabase/update-session.ts (whole file)
import { createServerClient } from "@supabase/ssr"
import type { NextRequest, NextResponse } from "next/server"
import { getPublicEnv } from "@/lib/env/public"

export async function refreshSupabaseSession(
  request: NextRequest,
  createResponse: () => NextResponse
): Promise<NextResponse> {
  const env = getPublicEnv()
  let response = createResponse()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => { request.cookies.set(name, value) })
          response = createResponse()
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}
```

Testability seam: the function builds the Supabase client via
`createServerClient` from `@supabase/ssr`. To test the cookie-rebuild behavior
deterministically, **mock that import** so its returned client's
`auth.getUser()` invokes the `setAll` callback with a fake rotated cookie, then
assert the cookie landed on a fresh response. `getPublicEnv()` reads
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `process.env` —
set placeholders in the test.

Test tier: the unit tier runs `node --import ./tests/support/register-alias.mjs
--test tests/unit/*.test.mjs` (Node 24). Node's `node:test` `mock.module` can
intercept the `@supabase/ssr` import. See any existing `tests/unit/*.test.mjs`
for the `node:test` + `node:assert/strict` shape.

## Commands you will need

| Purpose    | Command            | Expected |
|------------|--------------------|----------|
| Unit tests | `pnpm test:unit`   | all pass |
| Typecheck  | `pnpm typecheck`   | exit 0   |

## Scope

**In scope**:
- `tests/unit/refresh-supabase-session.test.mjs` (create)

**Out of scope** (do NOT touch):
- `lib/supabase/update-session.ts` — the source is correct; do not refactor it
  to make testing easier unless a STOP condition forces a report first.
- `proxy.ts`, `lib/env/public.ts`.

## Git workflow

- Branch: `advisor/006-test-session-refresh`
- Commit: `test(auth): cover Supabase session cookie rebuild`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the test with a mocked Supabase client

Create `tests/unit/refresh-supabase-session.test.mjs`. Skeleton to adapt:

```js
import { test, mock } from "node:test"
import assert from "node:assert/strict"

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://ci.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "ci-anon-key"

test("writes rotated cookies onto a freshly created response", async () => {
  // Mock @supabase/ssr so getUser() drives setAll with a rotated cookie.
  mock.module("@supabase/ssr", {
    namedExports: {
      createServerClient(_url, _key, opts) {
        return {
          auth: {
            async getUser() {
              opts.cookies.setAll([
                { name: "sb-access-token", value: "rotated", options: { path: "/" } },
              ])
              return { data: { user: null }, error: null }
            },
          },
        }
      },
    },
  })

  const { refreshSupabaseSession } = await import("@/lib/supabase/update-session")

  const requestCookies = new Map()
  const request = {
    cookies: {
      getAll: () => [...requestCookies].map(([name, value]) => ({ name, value })),
      set: (name, value) => requestCookies.set(name, value),
    },
  }
  let created = 0
  const makeResponse = () => {
    created += 1
    const jar = new Map()
    return { cookies: { set: (n, v, o) => jar.set(n, { v, o }) }, jar }
  }

  const response = await refreshSupabaseSession(request, makeResponse)

  // A fresh response was created on setAll, and it carries the rotated cookie.
  assert.ok(created >= 2, "createResponse should be called again on setAll")
  assert.equal(response.jar.get("sb-access-token")?.v, "rotated")
  assert.equal(requestCookies.get("sb-access-token"), "rotated")
})

test("returns the response unchanged when no cookies rotate", async () => {
  mock.module("@supabase/ssr", {
    namedExports: {
      createServerClient() {
        return { auth: { async getUser() { return { data: { user: null }, error: null } } } }
      },
    },
  })
  const { refreshSupabaseSession } = await import("@/lib/supabase/update-session")
  const request = { cookies: { getAll: () => [], set: () => {} } }
  const makeResponse = () => ({ marker: Symbol("resp"), cookies: { set: () => {} } })
  const response = await refreshSupabaseSession(request, makeResponse)
  assert.ok(response && typeof response === "object")
})
```

Notes:
- `mock.module` requires resetting module state between cases — use a fresh
  dynamic `import()` per test as shown, and if needed
  `mock.restoreAll()`/`mock.reset()` in an `afterEach`.
- The `request`/`response` objects are minimal fakes matching only the methods
  the function calls (`cookies.getAll/set`), cast is unnecessary in JS.

**Verify**: `pnpm test:unit` → the two new cases pass.

### Step 2: Confirm no source drift

`pnpm typecheck` → exit 0.

## Test plan

- New `tests/unit/refresh-supabase-session.test.mjs` with two cases: rotated
  cookie is written to a fresh response + mirrored on the request; no-rotation
  returns a valid response.
- Verification: `pnpm test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `tests/unit/refresh-supabase-session.test.mjs` exists and passes
- [ ] The "rotated cookie" test asserts the cookie is on a **freshly created**
      response (createResponse called again) AND mirrored on the request
- [ ] `pnpm test:unit` exits 0
- [ ] `lib/supabase/update-session.ts` is unchanged (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `node:test`'s `mock.module` is unavailable or conflicts with the `@/` alias
  loader such that the mocked `@supabase/ssr` import is not used (report the
  error; do NOT work around it by editing the source to accept an injected
  client without flagging that as an intended API change first).
- `getPublicEnv()` throws even with the placeholder env vars set (its contract
  changed — report what it now requires).
- The source no longer matches the "Current state" excerpt.

## Maintenance notes

- If `update-session.ts` is ever refactored to inject the client factory (a
  legitimate testability improvement), simplify this test to pass a fake factory
  directly and drop `mock.module`.
- Reviewer: the load-bearing assertion is that `createResponse` is re-invoked on
  `setAll` (the bug class is writing cookies onto a stale response).
