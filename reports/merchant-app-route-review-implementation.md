# Merchant `/app` Review — Implementation Report

**Date:** 2026-06-28 · **Branch:** `review-fixes` (off `main` @ `d67fc266`) · **Commit:** `bb745dff` · **Source:** `reports/merchant-app-route-review.md`
**Method:** OMO plan → 19 file-disjoint worktree workers → per-worker LazyCodex review gate → central integration + verification.

---

## Verdict: ✅ READY (to merge `review-fixes` → `main`)

All static gates and a live route smoke test pass; the flagship fixes are verified; no regressions were introduced. Residual items are explicitly-scoped follow-ups (shared-foundation a11y pass, one DB migration, optional authed-visual QA) — none are regressions and none block merge.

---

## 1. Findings accounted for (109 total)

The source report's section-2 table claimed 116; the completeness critic proved that over-counts the bullets actually written. **Reconciled, verified total: 109 distinct findings (12 medium / 89 low / 8 info).** One hallucinated finding was dropped; the #1 medium (dashboard over-fetch), which the parser had mis-merged into a non-existent id, was restored.

| Disposition | Count | Notes |
| --- | --- | --- |
| **Implemented (full)** | **79** | incl. `force-dynamic` added to `/app`, `/customers`, `/activity`, `/scan` |
| **Implemented (partial)** | **12** | core fixed in-scope; remainder needs a shared-foundation file (see §5) |
| **Not implemented (skipped, with reason)** | **6** | 3 of these were *refuted on inspection* (premise didn't hold / already fixed) |
| **Merged (deduped)** | **8** | cross-route duplicates; fixed once at the canonical site |
| **Deferred (recorded)** | **4** | informational / latent / forward-looking |
| **Total** | **109** | |

Every medium was addressed: **12/12 mediums implemented** (2 of them partial — keyboard-table and the launch heading — with the documented foundation caveat).

---

## 2. Highlights (medium-severity)

- **Dashboard over-fetch eliminated** — new PII-free `getMerchantDashboardCustomerCounts` replaces the 100-row `getMerchantCustomers` call in the dashboard `Promise.all`; `readyCount`/`quietCount` proven **byte-identical** via badge precedence (`ready`/`quiet` resolve before the redeemed branch). Dropped a PII join + the redeemed-history query from the hottest authed page.
- **Structural PII masking** — `getMerchantCustomers` now returns the already-masked `MerchantCustomerReadbackRow[]`; raw email/phone **never leave `lib/merchant/*`**. The PII loader moved from service-role to the **anon/RLS client** (RLS now backstops the app-level merchant filter). The dashboard-side duplicate mask is gone (over-fetch fix removed it).
- **StatStrip AA contrast** — `text-sun` on `bg-card` was **1.80:1**; now `color-mix(in srgb, --color-sun 55%, --color-ink)` = **4.61:1** (passes AA 4.5:1 normal-text), `dark:text-sun` preserved. Token-only; no `globals.css`/`DESIGN.md` edits.
- **Activity filter pushed into the DB query** — `eventsForCategory` + `.in('event_name', …)`; filtered "Load more" now grows the *filtered* set (category rows past the old window are reachable). `q` kept as honest client refinement (a server `ilike` on `event_name` would hide label/reward/metadata matches and touch PII columns).
- **Launch banner race fixed** — `history.replaceState` instead of `router.replace` (no RSC refetch that blanked the success banner + Continue CTA); QR panel no longer re-runs the readiness pipeline; tab skeletons mirror real layouts (CLS).
- **In-shell `app/app/not-found.tsx`** — merchants keep the workspace chrome with a "Back to activity" link instead of being ejected to the customer 404.
- **Scanner camera-error a11y** — remediation copy now inside the `aria-live` region; lifecycle hardening (decode-ref reset, awaited stop, retry affordance).
- **Onboarding form a11y** — live error region + focus-to-first-error + `aria-busy`.
- **Customers table keyboard** — real focusable per-row "Scan reward" link (WCAG 2.1.1) for the desktop scan workflow.

---

## 3. Verification (all green)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | ✅ exit 0 (full combined set) |
| `pnpm build` | ✅ exit 0 — `/app/*` routes confirmed `ƒ (Dynamic)` |
| `pnpm tokens:check` | ✅ 22 colour tokens in sync (no Wet Ink drift) |
| `pnpm claims:check` | ✅ no banned claims |
| `pnpm jsonld:check` | ✅ JSON-LD graph valid |
| LazyCodex gates | ✅ 17/19 approved clean; 2 flagged → fixed (below) |
| Live route smoke (`:3000` dev) | ✅ 8/8 `/app/*` compile + auth-gate (307 → `/login?next=…`, sanitized); `/dev/design-system` 200 |
| StatStrip AA (computed from tokens) | ✅ 1.80:1 → 4.61:1 |

**Two flagged workers, both resolved before integration:**
- `reward-scan` — BLOCKER: 5 `TS2339` errors. Root cause: a "dead defensive guard" finding was mis-classified — the removed `'rewardId' in context` guard was *load-bearing* for union narrowing. Fixed by restoring a correct narrowing guard (`if (!("rewardName" in context)) notFound()`).
- `misc-components` — MAJOR: the filter-pills `before:` tap-target overlay didn't work. Resolved per the report's sanctioned "document the exception" option (compact 36px pill is intentional Wet Ink; removed the ineffective overlay). INFO severity.

---

## 4. Skipped (6) — with reasons (3 are refutations)

- `app-customers-fallback-double-count-week` — **refuted**: the premise doesn't hold; `getMerchantDashboardDataByQuery` computes all-time (not current-week) counts. Only `newMembers(7d)` overlaps, and deduping it conflicts with the parallelization fix. No net-positive signature-safe change.
- `app-launch-reward-pool-count-fetched-twice` — **refuted**: the cited `getLoyaltyCardSetup` location lookup is *already* `cache()`-wrapped; the real cross-stack dup is against the non-owned `qr-code.ts`.
- `app-rewards-scan-rewardid-read-collect-divergence-substring` — needs an RPC change in the **already-applied** migration `20260626090000` (forbidden to edit in place); no live bug today. Recommended as a follow-up migration.
- `app-customers-list-hardcap-100`, `app-activity-loadmore-growing-limit`, `app-merchants-row-requeried-onboarding-bypasses-cache` — each requires editing a **non-owned shared foundation** (the `DataTable` primitive, a client data path, or `session.ts`) and would break contract stability; out of scope for a single route worker (see §5).

## Deferred (4, recorded)
`app-launch-scan-collect-rpc-trusts-merchant-id` (defense-in-depth, not exploitable), `app-onboarding-loading-error-boundaries`, `app-onboarding-persist-write-merchant-eq-guard` (latent), `app-customers-highlight-param-validation` (not a vuln). All informational/forward-looking.

---

## 5. Recommended follow-ups (out of this scope)

1. **Shared-foundation a11y pass** — most of the 12 partials converge here: `DataTable` per-row `aria-selected`/keyboard hook (customers table), `venue-address-fields` `required`/`autocomplete` props (onboarding addresses). One small PR to the shared primitives closes them all.
2. **Reward-scan `expired` migration** — emit a stable `expired` status end-to-end in `get_reward_scan_context` (new migration). The TS/loader/page are already forward-compatible.
3. **Authed-visual QA** — keyboard-nav, screen-reader announcements, and the in-shell not-found render were verified at code + compile + review level but not driven in a logged-in browser (no local magic-link script; the env points at a remote production Supabase, so creating sessions has side effects). Recommend a manual pass via the admin magic-link runbook before production.

---

## 6. Mechanics

- **Branches:** `main` untouched at `d67fc266`; all work on `review-fixes` (1 commit `bb745dff`). The pre-existing WIP was the base (committed as `d67fc266` "UX.UI FIXES").
- **Worktrees:** 19 isolated worktrees (`wf_1c54ccbd-4f6-*`) — one per file-disjoint worker. Each emitted a patch file; approved patches were `git apply`'d onto `review-fixes` (disjoint files → zero apply conflicts). All 19 worktrees + branches removed after capture; pre-existing `claude/*`/`codex/*` worktrees untouched.
- **Changed files:** 42 (40 modified, 2 new: `app/app/not-found.tsx`, `app/app/scan/loading.tsx`; plus `components/brand/category-badge.tsx`). `+1461 / −466`.
- **Preserved:** dirty WIP committed (not discarded); Wet Ink foundations (`DESIGN.md`, `globals.css`, shared `brand/ui/motion/loyalty`) untouched; server-authoritative (no loyalty/billing/auth/scan logic moved to browser storage).

## 7. Remaining risks

- **Tenant boundary / PII:** *reduced* — PII loader now on RLS; masking is structural; counts proven identical. Reviewers confirmed no raw PII crosses a client boundary.
- **`reward-scan` expired path:** TS-forward-compatible but live RPC still maps expiry → `not_found` until the follow-up migration (no incorrect collection possible — the DB still refuses).
- **No authed-visual QA** (see §5.3) — the only verification gap; mitigated by review + compile + route smoke.
