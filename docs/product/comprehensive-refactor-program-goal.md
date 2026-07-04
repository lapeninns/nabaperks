# Comprehensive Refactor Program Goal

A whole-repo, **behaviour-preserving** refactor pass over **every tracked code
file** in Nabaperks. The desired verdict is `REFACTOR PROGRAM GREEN` (every
in-scope file carries a terminal status and all gates are green) or
`REFACTOR PROGRAM NOT READY`.

This is **not** a rewrite, a framework migration, a feature change, or a schema
change. It is a systematic hygiene sweep that leaves runtime behaviour, the
verified moat, the design contract, and public/DB/billing surfaces **identical**
— proven by tests, not asserted.

---

## 0. Why this shape (read first)

This repo is a mature, heavily-audited live product. A 102-agent architecture
audit plus multiple perf/UX/SEO passes already fixed the big rocks (GDPR
erasure, security headers, CI-runs-tests, OTP hardening, hot-path indexes). So
the honest premise of this program is:

> Most files do **not** need heavy change. The value is a **complete, uniform,
> provably-safe pass** — consistent structure, dead code gone, types narrowed,
> shared primitives adopted, hot files decomposed — with a hard guarantee that
> nothing observable changed.

To make "each and every file" tractable **and** honest, every in-scope file
ends in exactly one terminal status:

- `REFACTORED` — changed; behaviour proven identical by gates/tests.
- `REVIEWED_NO_CHANGE` — inspected against the checklist; nothing worth changing.
- `DEFERRED(<reason>)` — real work found, but out of scope for a hygiene pass
  (belongs in a spike/Micro-Spec); logged with a follow-up.

The register of these statuses **is** the deliverable that proves coverage.

---

## 1. Hard invariants (no-go rails)

These come from the verified architecture audit and this repo's own governance.
Any change that would touch behaviour here is out of scope; if a refactor cannot
avoid it, stop and file a spike.

1. **Moat behaviour is frozen.** One-stamp-per-UK-day, single-use redemption,
   fail-closed billing/entitlement, deny-by-default RLS, 18+ redemption gate.
   Refactors here require a **characterization test first** (Lane 0) that pins
   current behaviour, then must keep it green byte-for-byte in outcome.
2. **Eligibility gate is replicated on purpose.** The 18+/eligibility logic is
   intentionally duplicated across `create_reward_scan_token`,
   `redeem_self_service_reward`, and `get_reward_scan_context`. Do **not** "DRY"
   it into one path — that would weaken the hard gates.
3. **Applied SQL migrations are immutable.** Never edit a file under
   `supabase/migrations/`. "Refactoring" the schema means a **new corrective
   migration** only, and only if a defect is found — not part of this program.
4. **Customer-stamp-contract ordering is CI-pinned.** The location-resolution
   step must stay **after** QR-ownership resolution in the stamp path. Do not
   reorder or parallelize it.
5. **Env contract:** any feature-scoped secret stays `optional` in
   `config/env-contract.json`. Marking a feature secret `required` throws in
   `getServerEnv` on every server page → CI 500s / prod outage.
6. **Design system is the product contract.** `DESIGN.md`, `app/globals.css`,
   and the design tokens are frozen. `pnpm tokens:check` and `pnpm claims:check`
   must stay green; no visual drift beyond current Playwright baselines.
7. **Server state stays authoritative.** Browser storage is cache-only. No
   loyalty/billing logic may move client-side. Browser-only proof never counts
   as DB/RLS/webhook/billing proof.
8. **Public/URL/route contracts are frozen.** No route renames, no changed query
   params, no changed server-action signatures observable to a client, no
   sitemap/robots/JSON-LD regressions (`pnpm jsonld:check` stays green).
9. **Exported signatures are stable within a lane.** Refactor internals freely;
   keep a module's public exports stable until every caller is migrated in the
   same lane/PR. (This is the proven contract-stability rule from prior batches.)

---

## 2. Scope: classify all tracked files into tiers

Run `git ls-files` and bucket every path. Only Tiers A–C are "refactored"; D is
immutable; E is excluded or sync-only.

| Tier | What | Paths (indicative) | Treatment |
| --- | --- | --- | --- |
| **A — Runtime source** | The real target | `app/**`, `lib/**`, `components/**`, `hooks/**`, `proxy.ts`, `instrumentation.ts` | Full per-file checklist (§4) |
| **B — Tooling scripts** | Governance/build/env scripts | `scripts/**/*.mjs` | Checklist, but they already work — clarity/dedupe only, never change gate semantics |
| **C — Tests** | All automated tests | `tests/**` | Refactor for shared helpers/DRY; **never weaken an assertion**; characterization tests are *added* here |
| **D — Migrations** | Applied DB schema | `supabase/migrations/**/*.sql` | **Immutable.** No edits. New corrective migration only if a defect is found |
| **E — Generated / mirrored / vendored** | Non-authored or synced | `.design-sync/previews/**`, `ds-bundle/**`, `coverage/**`, `node_modules/**`, `ai-governance-starter-kit/**` + `.factory` synced copies, `tsconfig.tsbuildinfo`, `next-env.d.ts` | **Excluded.** Governance-kit copies are regenerated via `pnpm governance:sync-skill`, never hand-edited |
| **Config** | Build/lint/TS config | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `playwright.config.ts`, `components.json`, `vercel.json` | Touch only with explicit justification + full gate run |

The register must account for **100%** of `git ls-files` code paths as one of:
in-scope-Tier-A/B/C, immutable-D, or excluded-E. That closure is what makes the
program "every file".

---

## 3. Lanes (file-disjoint, ordered by leverage then risk)

One lane = one PR. Lanes are **file-disjoint** so parallel worktree workers never
touch the same file (the repo's proven execution model). Land each lane green
before the next touches adjacent files.

### Lane 0 — Safety net & baseline (do first, blocks everything)
- Capture the current baseline: `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`
  (record the 80/80/70 numbers), `pnpm build`, `pnpm bundle:check`, and the
  `/dev/app-harness` overflow baseline (0/128) — this is the "unchanged" oracle.
- Normalize formatting repo-wide **once** via `pnpm format` (Prettier) as a
  single mechanical commit, so later diffs are semantic, not whitespace.
- Add **characterization tests** around every moat behaviour that lacks one
  (stamp-per-day, single-use redemption, fail-closed billing, 18+ gate, RLS
  isolation) via `tests/db` and `tests/unit` pure cores. Nothing else in this
  lane. These tests are the license to refactor safely.

### Lane 1 — `lib/**` core logic (highest leverage)
Domain order by size/hot-path: `customer` (56) → `merchant` (39) →
`notifications` (21) → `admin` (10) → `env`/`stripe`/`security`/`observability`/
`analytics`/`qr`/`rewards`/`auth`/`supabase`/`seo` (small).
- Priority decompositions (already flagged in `plans/`): `lib/merchant/activity.ts`
  (1465 → pure core + fetch layer, plans 005/009), `lib/notifications/delivery-worker.ts`
  (944 → producers + sender + batched reads, plans 010/011),
  `lib/customer/experience/derive.ts` (508), `lib/notifications/events.ts` (507),
  `lib/merchant/launch-readiness-core.ts` (344), `lib/merchant/venue-address.ts` (342).
- Extract **pure functions** out of IO so they get real unit tests (`pnpm test:unit`
  via the node alias-loader; only pure modules are testable there).

### Lane 2 — `app/**` routes, server actions, route handlers
- 163 files: pages, `actions.ts`, `route.ts`, `layout.tsx`.
- Behaviour-preserving only. Respect invariant #4 (stamp ordering) and #8
  (route/param/action-signature contracts). Big ones: `app/app/card/actions.ts`
  (477), `app/(auth)/actions.ts` (407), `app/admin/actions.ts` (348),
  `app/m/[merchantSlug]/join/actions.ts` (332).
- Keep `force-dynamic` / cache directives exactly as-is unless proven safe.

### Lane 3 — `components/**` (design-system alignment)
- Domain order: `merchant` (51) → `marketing` (39) → `customer` (34) → `ui` (17)
  → `loyalty`/`layout`/`brand` (12 each) → `data`/`admin`/`forms`/`motion`/`auth`.
- Adopt shared primitives instead of re-implementing (KpiTile, Sparkline,
  StatStrip, Section/ContrastBand, SubmitButton, `.focus-ring`, mono scale).
- Priority decompositions: `components/merchant/loyalty-card-form.tsx` (892),
  `components/merchant/customer-readback-table.tsx` (718),
  `components/merchant/loading-skeletons.tsx` (537),
  `app/dev/design-system/page.tsx` (955, harness — split by section).
- **No token drift.** Colours/spacing/type come from `globals.css`/DESIGN.md only.

### Lane 4 — `scripts/**` + `tests/**` hygiene
- Dedupe repeated CLI/DB harness boilerplate into shared helpers.
- Tests: consolidate fixtures/helpers; keep every assertion at least as strict.
- Never change what a governance gate enforces.

### Lane 5 — cross-cutting sweep + closure
- Import hygiene (sort, no unused, no deep-reach past barrels), dead-code removal,
  `any` → discriminated unions (esp. RPC result shapes; fail loud on drift, plan 016),
  narrow prop types (plan 017), config review.
- Final pass to stamp every remaining Tier-A/B/C file `REVIEWED_NO_CHANGE` and
  close the register.

---

## 4. Per-file refactor checklist (Tier A/B/C)

For **every** file, apply and record. A file that needs nothing still gets read
against this list and stamped `REVIEWED_NO_CHANGE`.

**Do**
- [ ] Single responsibility; extract pure logic from IO so it is unit-testable.
- [ ] Narrow types: remove `any`/unsafe casts; discriminated unions for RPC/DB
      result shapes; fail loud on shape drift rather than silently coercing.
- [ ] Reuse shared primitives/utilities instead of re-implementing.
- [ ] Delete dead code, unreachable branches, unused exports/props/imports.
- [ ] Consistent naming that matches the merchant vocabulary (Members/Setup/Poster
      in UI) and Wet Ink copy voice; match surrounding comment density.
- [ ] Error handling stays **fail-closed** on the moat/billing paths.
- [ ] No stray `console.*` in runtime paths; use the observability helpers.
- [ ] Imports sorted; no reaching past a module's public surface.
- [ ] File under a sane size (split >~400-LOC runtime files by responsibility).

**Never**
- [ ] Change observable behaviour, route/param/action contracts, or copy that
      marketing/SEO/claims guards depend on.
- [ ] Edit an applied migration, or collapse the intentionally-replicated
      eligibility gate.
- [ ] Introduce token/design drift or new client-side loyalty/billing logic.
- [ ] Lower coverage thresholds or weaken a test to make a gate pass.

---

## 5. Verification gates (run per lane, before each PR merges)

All must be green and **no worse than the Lane 0 baseline**:

```
pnpm lint
pnpm governance:check
pnpm typecheck
pnpm test                # micro-specs + unit
pnpm test:coverage       # must not drop below 80/80/70 (lines/functions/branches)
pnpm build
pnpm bundle:check        # within budget
pnpm tokens:check
pnpm claims:check
pnpm jsonld:check
pnpm test:db             # moat invariants — REQUIRED for any Lane 1/2 change touching loyalty/billing/RLS (needs local Supabase)
pnpm test:e2e            # scope to @visual / @a11y / harness routes first, then broader
```

Plus: regenerate the `/dev/app-harness` capture and confirm **0/128 overflow**
retained; confirm no Playwright visual baseline changed except intentionally.

`pnpm governance:run-gates` applies only if a driving Micro-Spec is active.

---

## 6. Sequencing, cadence & known traps

- **One lane = one small, green, squash-merged PR** (`gh pr merge --squash --admin`;
  the Vercel check is a permanent env-red — merge past it). Small PRs keep the
  "behaviour unchanged" claim reviewable.
- **Characterization tests land before any refactor** they protect (Lane 0).
- **Concurrent-tree-sync wipe:** `main` can change under you mid-session
  (parallel session + `pull --ff-only`/`reset`/`clean`). Work each lane in an
  **isolated git worktree**, back new files up to scratchpad right after Write,
  and re-verify the tree before declaring a lane done.
- **Foreign `:3000` prod server:** a second `next dev` is refused; reuse the
  running server or use a dedicated `:3100` for smoke, and don't clobber the
  prod build's `distDir`.
- **Don't re-flag the vetted-rejected items** from prior audits (reward-toggle
  "stale gate", `check-env` false positives, cron "fail-open") — they're correct.
- This program is **behaviour-preserving**; product direction / architecture
  changes (multi-location, re-engagement, regulars-import — `plans/018–020`)
  are **separate spikes**, not part of this pass.

---

## 7. Definition of done

`REFACTOR PROGRAM GREEN` requires **all** of:

- Every `git ls-files` code path is classified (Tier A/B/C in-scope with a
  terminal status, Tier D immutable, Tier E excluded) — 100% closure.
- Every in-scope file is `REFACTORED`, `REVIEWED_NO_CHANGE`, or
  `DEFERRED(<reason>)` in the register, with the follow-up list for deferrals.
- All §5 gates green and no baseline regression (coverage ≥ 80/80/70,
  bundle within budget, 0/128 harness overflow, no token/claims/jsonld drift).
- `pnpm test:db` moat invariants green; new characterization tests committed.
- No applied migration edited; no eligibility-gate collapse; no route/action
  contract change; no design-token drift.

Otherwise the verdict is `REFACTOR PROGRAM NOT READY` with the exact failing
gate(s) and the remaining unclassified/`DEFERRED` files.

---

## 8. Execution prompt (agent hand-off)

```text
Goal: Run a whole-repo BEHAVIOUR-PRESERVING refactor of Nabaperks. Every tracked
code file must end with a terminal status (REFACTORED / REVIEWED_NO_CHANGE /
DEFERRED). Do not change runtime behaviour, the verified moat, the design
contract, applied migrations, or any route/param/server-action/DB contract.

Read first: AGENTS.md, CLAUDE.md, DESIGN.md, micro-specs/README.md,
micro-specs/GLOBAL_CONTEXT.md, Instructions_tdd.md, package.json,
config/env-contract.json, and this file.

Honor the hard invariants in §1 and the immutable/excluded tiers in §2.

Phase A — Baseline & safety net (Lane 0): record baseline gate numbers; run one
mechanical `pnpm format` commit; add characterization tests (tests/db + pure
tests/unit) for stamp-per-UK-day, single-use redemption, fail-closed billing,
18+ gate, and RLS isolation. Do nothing else until these are green.

Phase B — Classify: bucket every `git ls-files` code path into the §2 tiers and
open the tracking register with one row per in-scope file.

Phase C — Refactor by lane (§3), file-disjoint, one PR per lane, in order
0→1→2→3→4→5. Apply the §4 checklist to every file; stamp untouched files
REVIEWED_NO_CHANGE. Work in isolated worktrees; back up WIP to scratchpad.

Phase D — Gate every lane (§5); no regression vs the Lane 0 baseline. Squash-merge
green lanes with --admin past the permanent Vercel env-red.

Phase E — Close the register (§7) and emit the verdict: REFACTOR PROGRAM GREEN or
REFACTOR PROGRAM NOT READY, with the gate results, the per-file status counts,
and the DEFERRED follow-up list.

Anti-goals: no rewrites, no framework/schema migration, no feature/product
changes, no coverage-threshold lowering, no editing applied migrations, no
collapsing the replicated eligibility gate, no design-token drift.
```
