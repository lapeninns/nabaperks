# Plan 004: Add the `/demo` page to the public sitemap

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/marketing/facts.ts app/sitemap.ts app/demo public/llms.txt tests`
> On any change, re-verify the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / seo
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`/demo` is a real, indexable, high-intent conversion page — a live browser-based
loyalty card a prospect can stamp before signing up. It sets its own canonical
(`alternates: { canonical: "/demo" }`) and full OpenGraph/Twitter metadata, it is
the scan-target for the hero QR, and it is linked from the landing hero. But it
is **absent** from `PUBLIC_SITE_ROUTES`, which is the single source the sitemap
(and, per repo history, `llms.txt`) is generated from — so the exact page the
marketing funnel points at is never surfaced to crawlers. Adding one entry fixes
the discoverability leak.

## Current state

- `app/demo/page.tsx` — the demo route, self-canonical and fully metadata'd:
  ```ts
  // app/demo/page.tsx:11-18
  const title = "Try a live loyalty card demo"
  const description = "See exactly what your customers get — ..."
  export const metadata: Metadata = {
    title: { absolute: `${title} | Nabaperks` },
    description,
    alternates: { canonical: "/demo" },
    // + openGraph / twitter with absoluteUrl("/demo")
  }
  ```
- `lib/marketing/facts.ts` — the route registry and the sitemap source list:
  ```ts
  // lib/marketing/facts.ts:119-130 — ROUTES (no `demo` key today)
  export const ROUTES = {
    home: "/",
    pubHub: "/loyalty-for-pubs",
    about: "/about",
    pricing: "/pricing",
    signup: "/signup",
    guides: { bestIdeas: "...", rewardRegulars: "...", paperVsQr: "..." },
  } as const

  // lib/marketing/facts.ts:140-163 — PUBLIC_SITE_ROUTES (no /demo entry today)
  export const PUBLIC_SITE_ROUTES = [
    { path: ROUTES.home, priority: 1, changeFrequency: "weekly" },
    { path: ROUTES.pubHub, priority: 0.9, changeFrequency: "monthly" },
    { path: ROUTES.pricing, priority: 0.9, changeFrequency: "monthly" },
    { path: ROUTES.about, priority: 0.6, changeFrequency: "monthly" },
    { path: ROUTES.guides.bestIdeas, priority: 0.6, changeFrequency: "monthly" },
    { path: ROUTES.guides.rewardRegulars, priority: 0.6, changeFrequency: "monthly" },
    { path: ROUTES.guides.paperVsQr, priority: 0.6, changeFrequency: "monthly" },
    { path: ROUTES.signup, priority: 0.7, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ] as const satisfies readonly PublicSiteRoute[]
  ```
  Note the list already mixes `ROUTES.x` references with plain string literals
  (`"/privacy"`, `"/terms"`), so adding a literal `/demo` entry is consistent.
- `app/sitemap.ts:9-14` maps `PUBLIC_SITE_ROUTES` straight into the sitemap.
- Public-route parity is test-guarded (repo history: `/sitemap.xml` and
  `/llms.txt` must expose the same approved indexable URLs). Relevant tests:
  `tests/micro-specs/marketing-auth-legal.test.mjs` and
  `tests/e2e/public-route-metadata.spec.ts`. There may also be a
  `public/llms.txt` that lists these URLs.

## Commands you will need

| Purpose          | Command                                   | Expected |
|------------------|-------------------------------------------|----------|
| Typecheck        | `pnpm typecheck`                          | exit 0   |
| Micro-spec tests | `pnpm test:micro-specs`                   | all pass |
| Grep llms.txt    | `grep -n "demo" public/llms.txt`          | see Step 2 |

## Scope

**In scope**:
- `lib/marketing/facts.ts` (add the `/demo` entry; optionally add a `ROUTES.demo` key)
- `public/llms.txt` (add `/demo` **only if** the parity test/history requires the
  two lists to match — see Step 2)
- Whichever test encodes the expected public-route set, IF it hardcodes a list or
  count that must now include `/demo` (test files are in scope)

**Out of scope** (do NOT touch):
- `app/demo/page.tsx` — its metadata is already correct.
- `app/robots.ts` and the private-route registry — `/demo` is public; do not add
  it to any noindex list.
- Any other route's priority/changeFrequency values.

## Git workflow

- Branch: `advisor/004-demo-in-sitemap`
- Commit message: `feat(seo): surface /demo in the public sitemap`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `/demo` to `PUBLIC_SITE_ROUTES`

In `lib/marketing/facts.ts`, add an entry to the `PUBLIC_SITE_ROUTES` array. Use
a priority between the conversion pages and the guides — `0.7` (same as
`signup`) is appropriate for a high-intent demo, `monthly` change frequency.
Place it logically (e.g. after `signup`, before `/privacy`):

```ts
    { path: "/demo", priority: 0.7, changeFrequency: "monthly" },
```

(Optional, only if you prefer consistency with the `ROUTES.x` entries: add
`demo: "/demo"` to the `ROUTES` object and reference `ROUTES.demo` instead of the
literal. Not required — the literal matches how `/privacy` and `/terms` are
already handled, and it is lower blast-radius. Do NOT add `ROUTES.demo` if it is
not referenced anywhere else.)

**Verify**:
- `pnpm typecheck` → exit 0 (the `satisfies readonly PublicSiteRoute[]` still holds).

### Step 2: Reconcile the parity tests and `llms.txt`

Run the public-route tests and follow their lead:

```
pnpm test:micro-specs
```

- If `marketing-auth-legal.test.mjs` (or another spec) asserts an **exact set or
  count** of public routes and now fails because `/demo` was added, update that
  expectation to include `/demo` — the addition is intended.
- If the test asserts that `public/llms.txt` and `PUBLIC_SITE_ROUTES` list the
  **same** URLs, add `/demo` to `public/llms.txt` in the same section the other
  marketing routes appear, so the two stay in sync. Check first:
  `grep -n "loyalty-for-pubs\|/pricing\|/about" public/llms.txt` to find the
  right block and match its formatting.
- If no test references the route set, no test edit is needed.

**Verify**: `pnpm test:micro-specs` → all pass.

### Step 3: Confirm the sitemap now includes `/demo`

`app/sitemap.ts` maps `PUBLIC_SITE_ROUTES` directly, so no code change is needed
there. Optionally sanity-check the generated array shape:

`node -e "process.env.NEXT_PUBLIC_APP_URL='https://example.test'; import('./lib/marketing/facts.ts').then(m=>console.log(m.PUBLIC_SITE_ROUTES.some(r=>r.path==='/demo')))"`

(If ESM/TS loading that file directly is awkward in this repo's node setup, skip
this and rely on the typecheck + test verification — the mapping in
`app/sitemap.ts` is unconditional.)

**Verify**: the demo path is present in `PUBLIC_SITE_ROUTES` (grep the file):
`grep -n '"/demo"' lib/marketing/facts.ts` → one match.

## Test plan

- No brand-new test is required; the value is a data addition guarded by existing
  parity tests.
- If you had to update a route-set expectation in Step 2, that IS the test change.
- Verification: `pnpm test:micro-specs` passes, and `grep '"/demo"'
  lib/marketing/facts.ts` finds the new entry.

## Done criteria

ALL must hold:

- [ ] `PUBLIC_SITE_ROUTES` in `lib/marketing/facts.ts` contains a `/demo` entry
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test:micro-specs` passes (parity/llms tests reconciled if present)
- [ ] `public/llms.txt` includes `/demo` **iff** a test requires list parity
- [ ] `/demo` was NOT added to any noindex/private-route list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `app/demo/page.tsx` no longer sets `canonical: "/demo"` or has been made
  noindex (the discoverability decision changed — do not add a noindex page to
  the sitemap).
- A test asserts `/demo` must be **excluded** from public routes (there may be a
  deliberate reason; report it rather than overriding).
- Adding `/demo` breaks a `jsonld:check` or route-metadata e2e test in a way you
  can't reconcile by updating the expected route set.

## Maintenance notes

- Any future public marketing page should be added to `PUBLIC_SITE_ROUTES` (and
  `llms.txt` if parity is enforced) at creation time — that is the single source
  the sitemap derives from.
- Reviewer should confirm `/demo` is public-by-design (it is: self-canonical,
  hero-linked) and not something that should have been gated.
