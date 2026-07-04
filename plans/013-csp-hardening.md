# Plan 013: Harden the CSP — remove `unsafe-inline` on static routes; scope wildcards

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/security/csp.ts proxy.ts tests/unit/csp-theme-hash.test.mjs`

## Status

- **Priority**: P2 (Step 1) / P3 (Step 2)
- **Effort**: M
- **Risk**: MED (a too-tight policy silently breaks a page's scripts/images)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

The app routes use a strong CSP (per-request nonce + `strict-dynamic` + pinned
next-themes hashes). But two weaker spots undercut it:

1. **Static marketing routes fall back to `script-src 'unsafe-inline'`** — on `/`,
   `/about`, `/loyalty-for-pubs`, `/pricing`, `/privacy`, `/terms`, `/guides/*`
   the script policy provides no XSS mitigation for injected inline scripts. The
   dynamic policy already proves these pages' only inline script (next-themes) can
   be allowed by **hash** instead.
2. **`img-src`/`connect-src` allow any HTTPS origin** (shared by both policies), a
   defense-in-depth weakening that widens the exfiltration ceiling `strict-dynamic`
   otherwise buys you.

Step 1 (static `unsafe-inline` → hashes) is the higher-value, more-contained win.
Step 2 (wildcard → allowlist) needs a runtime origin inventory and must roll out
report-only first — treat it as operator-gated.

## Current state

```ts
// lib/security/csp.ts — pinned next-themes hashes already exist
const NEXT_THEMES_SCRIPT_HASHES = [ NEXT_THEMES_SCRIPT_SHA256, NEXT_THEMES_SERVER_RENDER_SCRIPT_SHA256, NEXT_THEMES_APP_RENDER_SCRIPT_SHA256 ]

// :72-79 — the WEAK static-marketing policy
export function staticMarketingContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${scriptDevEscape()}`,     // <-- Step 1 target
    "script-src-elem 'self' 'unsafe-inline'",                    // <-- Step 1 target
    ...sharedContentSecurityDirectives(),
  ].join("; ")
}

// :59-70 — the STRONG dynamic policy (the model to copy for scripts)
`script-src 'self' 'nonce-${nonce}' ${nextThemesScriptHashes} 'strict-dynamic' https://js.stripe.com${scriptDevEscape()}`
`script-src-elem 'self' 'nonce-${nonce}' ${nextThemesScriptHashes} https://js.stripe.com`

// :33-47 — shared directives with the wildcards (Step 2 target)
"img-src 'self' data: blob: https:",
"connect-src 'self' https: wss:",
```
- `staticMarketingContentSecurityPolicy()` is applied to the static paths via
  `isStaticMarketingPath` (`:49-57`) and `proxy.ts:33-39`.
- Tests: `tests/unit/csp-theme-hash.test.mjs` pins the theme-script hashes. There
  is production CSP smoke in the architecture-hardening micro-spec + Playwright QR
  smoke — a broken policy shows up as CSP console violations.

## Commands you will need

| Purpose    | Command                | Expected |
|------------|------------------------|----------|
| Unit tests | `pnpm test:unit`       | all pass |
| Typecheck  | `pnpm typecheck`       | exit 0   |
| Build+start (manual CSP smoke) | `pnpm build && pnpm start` | serves; check DevTools console for CSP errors on the static routes |

## Scope

**In scope**:
- `lib/security/csp.ts`
- `tests/unit/csp-theme-hash.test.mjs` (extend to assert static policy has no
  `'unsafe-inline'` in script-src)

**Out of scope**:
- `proxy.ts` header wiring (unchanged).
- The dynamic policy (already strong).
- Adding new inline scripts.

## Git workflow

- Branch: `advisor/013-csp-hardening`
- Commit: `security(csp): drop unsafe-inline on static marketing scripts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace static `unsafe-inline` scripts with the pinned hashes

Change `staticMarketingContentSecurityPolicy()` so `script-src` /
`script-src-elem` use `'self' ${nextThemesScriptHashes}` (the same hash list the
dynamic policy uses) instead of `'unsafe-inline'`. Keep `scriptDevEscape()` for
dev. Do NOT add a nonce here (static routes are cached without per-request
nonces — the whole point is they can rely on hashes).

Then **manually verify no other inline script exists on the static routes**:
`pnpm build && pnpm start`, open each of `/`, `/about`, `/loyalty-for-pubs`,
`/pricing`, `/privacy`, `/terms`, and one `/guides/*` page in a browser, and
confirm the DevTools console shows **no CSP violation** and the page renders
(theme toggle works, JSON-LD present). The JSON-LD `<script type="application/ld+json">`
is not executable JS and is unaffected by `script-src`.

**Verify**:
- `pnpm test:unit` (extend `csp-theme-hash.test.mjs` to assert
  `staticMarketingContentSecurityPolicy()` contains the theme hashes and does NOT
  contain `'unsafe-inline'` in `script-src`).
- Manual console smoke: no CSP errors on any static route.

### Step 2 (operator-gated, report-only first): scope the wildcards

Do NOT flip `img-src`/`connect-src` to an enforced allowlist blind. Instead:
1. Build the real origin inventory (Supabase project URL + storage, Stripe,
   PostHog, the web-push endpoints in `lib/notifications/push-subscription-input.ts`,
   any CDN/image host).
2. Add a **report-only** companion policy (`Content-Security-Policy-Report-Only`)
   in `proxy.ts` with the tightened `img-src`/`connect-src`, leaving the enforced
   policy's wildcards in place, so violations are observed without breakage.
3. Only after a clean report-only window (operator decision) replace the
   wildcards in `sharedContentSecurityDirectives()` with the allowlist.

If the operator has not asked for Step 2, stop after Step 1 and leave Step 2 as a
documented recommendation.

**Verify** (if Step 2 attempted): report-only header present; no functional change
to the enforced policy yet.

## Test plan

- Extend `tests/unit/csp-theme-hash.test.mjs`: assert the static policy uses the
  hashes and has no `'unsafe-inline'` script source.
- Manual: CSP-console-clean render of every static route after Step 1.
- Verification: `pnpm test:unit` pass + clean console smoke.

## Done criteria

ALL must hold:

- [ ] `staticMarketingContentSecurityPolicy()` `script-src`/`script-src-elem` use
      the pinned next-themes hashes, not `'unsafe-inline'`
- [ ] Manual smoke: every static marketing route renders with **zero** CSP console
      violations (theme toggle + JSON-LD intact)
- [ ] `tests/unit/csp-theme-hash.test.mjs` asserts the absence of script
      `'unsafe-inline'` on the static policy
- [ ] `pnpm test:unit`, `pnpm typecheck` pass
- [ ] Step 2 (wildcard allowlist) done ONLY if operator-approved; else recorded as
      a recommendation
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- Any static route shows a CSP violation after Step 1 that isn't next-themes —
  there is another inline script; report it (its hash must be pinned, or a
  nonce'd approach reconsidered) rather than re-adding `'unsafe-inline'`.
- The next-themes script hashes in `csp.ts` don't match what the browser reports
  as blocked (the theme script changed — the hash pins need updating; that's a
  separate concern).
- Step 2's origin inventory is incomplete/uncertain — do NOT enforce; keep it
  report-only and hand back.

## Maintenance notes

- If a marketing page ever needs a new inline script, pin its SHA-256 (as
  next-themes is) rather than reintroducing `'unsafe-inline'`.
- Reviewer: Step 1 is safe iff the static routes truly have no other inline JS —
  the manual multi-route console smoke is the gate, not just the unit test.
- Step 2 is deliberately deferred/gated because a wrong allowlist breaks image or
  data loads in production; report-only is mandatory first.
