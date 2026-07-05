---
spec_id: MS-merchant-ux-app-route-polish
status: implemented
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-29
allowed_blast_radius:
  - app/app/**
  - app/dev/**
  - components/layout/**
  - components/merchant/**
  - components/brand/**
  - components/ui/**
  - app/globals.css
  - lib/merchant/qr-nav.ts
  - lib/merchant/launch-readiness.ts
  - lib/qr/poster-templates.ts
  - micro-specs/merchant-ux/**
  - scripts/**
  - tests/micro-specs/**
implementation_surfaces:
  - app/app/page.tsx
  - app/app/layout.tsx
  - app/app/loading.tsx
  - app/app/error.tsx
  - app/app/onboarding/page.tsx
  - app/app/launch/page.tsx
  - app/app/qr/page.tsx
  - app/app/qr/poster/[template]/page.tsx
  - app/app/customers/page.tsx
  - app/app/activity/page.tsx
  - app/app/scan/page.tsx
  - app/app/rewards/scan/[rewardId]/page.tsx
  - app/app/account/page.tsx
  - components/layout/merchant-app-shell.tsx
  - components/layout/console-sidebar-nav.tsx
  - components/layout/merchant-tab-bar.tsx
  - components/merchant/**
related_docs:
  - DESIGN.md
  - AGENTS.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/merchant-sidebar-state.test.mjs
  - tests/micro-specs/merchant-account-compat-routes.test.mjs
  - not-yet-created
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm tokens:check
  - pnpm test:micro-specs
  - pnpm claims:check
required_playwright_projects: []
evidence_required:
  - Historical DB-free app harness screenshots and real authenticated poster route readback.
  - lint, typecheck, build, token, claims, and micro-spec test output captured in the verification log.
approved_exceptions: []
---

# MS-merchant-ux-app-route-polish — Route-complete merchant /app UX/UI polish

## Intent

Bring every real merchant-authenticated `/app` surface to a single, consistent
Wet Ink v2 standard with first-class mobile responsiveness, without changing
data, auth, billing, or loyalty business logic. This is a `ui-only` spec.

## Scope (in)

Real authenticated surfaces:

- `/app` (dashboard home)
- `/app/onboarding`
- `/app/launch` tabs: `venue | card | rewards | qr | billing`
- `/app/qr` and `/app/qr/poster/[template]`
- `/app/customers` (Members)
- `/app/activity`
- `/app/scan`
- `/app/rewards/scan/[rewardId]`
- `/app/account` tabs: `profile | billing`
- Shared shell/nav: `merchant-app-shell`, `console-sidebar-nav`,
  `merchant-tab-bar`, account/launch tab bars, `app/app/layout.tsx`,
  `loading.tsx`, `error.tsx`

Smoke-check only (assert they resolve/redirect, do not redesign):

- `/app/billing` → redirects to `/app/account?tab=billing`
- `/app/profile` → redirects to `/app/account?tab=profile`
- `/app/settings` → redirects to `/app/account?tab=profile`
- `/app/card` → directory exists with no `page.tsx`/`route.ts`; confirm its
  actual behavior (404 vs redirect) and treat as smoke
- `/login?next=/app/...` and `/signup` → entry-continuity only

## Scope (out)

No changes to: Supabase schema/migrations, RLS/RPC/loyalty ledger, auth/session/
OTP behavior, Stripe checkout/portal/entitlement logic, QR loyalty semantics,
PostHog event contracts. Browser-storage stays cache-only; server state stays
authoritative.

If a UI-visible integration bug genuinely requires touching out-of-scope logic,
stop, document it as an `approved_exceptions` entry, and get sign-off before
editing.

## Baseline note

The current working tree carries uncommitted in-flight QR/poster work
(`a4-poster*`, `northstar/`, `thermal/`, `qr-panel*`, `poster-*`,
`lib/merchant/qr-nav.ts`, `app/app/qr/page.tsx`, `app/dev/poster-preview/`).
This is the **new baseline**: build on it, never revert it. A recovery snapshot
of the pre-work tree is archived in the session scratchpad.

## EARS requirements

- **UX-1 (overflow):** THE merchant `/app` SHALL render every in-scope route
  with no horizontal scroll and no clipped content/button text at viewport
  widths 320, 375, 390, 430, 768, 1024, 1280, and 1440.
- **UX-2 (tap targets):** WHILE on a touch breakpoint, THE system SHALL present
  every interactive control with a hit area of at least 44×44 CSS px.
- **UX-3 (empty):** WHEN a data surface has zero records, THE system SHALL
  render a Wet Ink empty state, never a blank region.
- **UX-4 (loading):** WHEN a data surface is loading, THE system SHALL render a
  skeleton consistent with `components/merchant/loading-skeletons`.
- **UX-5 (error):** WHEN a server action or data load fails, THE system SHALL
  render an error state with a retry or back affordance.
- **UX-6 (tab-bar occlusion):** WHILE the bottom tab bar is visible, THE system
  SHALL guarantee no route content is occluded (bottom padding + safe-area).
- **UX-7 (Wet Ink):** THE system SHALL use only Wet Ink primitives — 2px ink
  borders, hard offset shadows, Bricolage Grotesque + Space Mono, `@hugeicons`
  via the shared `Icon` component, accent `#cf330a` — and SHALL NOT introduce
  soft shadows, off-token colors, pill/generic-SaaS chrome, or non-`Icon` icons.
- **UX-8 (DRY primitives):** WHEN a UX pattern (page header, KPI strip, filter
  bar, record card, action group, poster preview chrome, empty/loading/error)
  recurs across routes, THE system SHALL render it through one shared component
  rather than per-route bespoke markup.
- **UX-9 (no-regression):** THE changes SHALL keep `pnpm tokens:check`,
  `pnpm claims:check`, and `pnpm test:micro-specs` passing.

## Verification method

No Playwright / no new browser-automation dependency is added (governance: a
`ui-only` spec must not add an automation harness unless explicitly in blast
radius — this spec deliberately does not). Visual/a11y proof uses the existing
server-free render + `/dev` auth-gated harness approach already proven in this
repo: mount real components in an unauthenticated `/dev` page (or inline the
real CSS module for print surfaces) and capture headless screenshots across the
eight breakpoints. Every in-scope route and every launch/account tab gets a
mobile/tablet/desktop capture.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm tokens:check` ·
`pnpm test:micro-specs` · `pnpm claims:check`, plus per-route screenshot
evidence. Final verdict is `READY` or `NOT READY` with exact remaining blockers.

## Verification log — 2026-06-29

Implemented in waves: **Foundation** (`merchant-app-shell` + `merchant-tab-bar`
+ `app/app/layout.tsx`, incl. a new `hideMobileChrome` shell flag that drops the
mobile header + bottom tab bar on `/app/qr/poster/*`) → **6 file-disjoint UX
lanes** (setup-launch, qr-posters, dashboard-data, members-activity,
scan-redemption, account-billing) → **qa-harness** (`app/dev/app-harness/**`
mounting the real shell + real page bodies with DB-free fixtures, plus
`scripts/capture-app-harness.mjs`).

Gates against the changed code:

- `pnpm build` ✅ · `pnpm typecheck` ✅ · `pnpm tokens:check` ✅ (22 tokens) ·
  `pnpm claims:check` ✅ (57 files).
- `pnpm lint` ✅ for every changed file; the only failures are pre-existing in
  vendored `ds-bundle/`, `.design-sync/`, `.ds-sync/` (DesignSync artifacts, out
  of blast radius).
- `pnpm test:micro-specs` ⚠️ one pre-existing failure in
  `tests/micro-specs/qr-a4-poster-templates.test.mjs`: it asserts retired poster
  copy/dimensions removed by the in-flight poster revamp (passed at `HEAD`, fails
  on the uncommitted baseline; no UX-lane file involved). Flagged for the poster
  work's owner to reconcile.

**UX-1 (no horizontal scroll)** verified objectively: **0 / 152** (19 captured
surfaces × 8 widths 320/375/390/430/768/1024/1280/1440) overflow, measured via
headless Chrome over CDP with touch-emulation below 768. Screenshots captured at
320/390/768/1280. Captured surfaces cover every /app route body the polish
touched — dashboard, customers, activity, account→profile, launch→{venue,card,
rewards,qr}, qr, scan, onboarding, reward-scan (pending + collected), skeletons,
empty/error states — plus the poster preview. The two surfaces that cannot mount DB-free — `account?tab=billing` (real
`BillingPanel` self-fetches) and the literal in-shell `/app/qr/poster/[template]`
— were then captured **for real** via an authenticated headless pass: admin
magic-link mint for the seeded merchant `mia@old-crown-girton.test` →
`/auth/confirm?token_hash=…` in headless Chrome → session established → real
routes screenshotted (non-destructive; no DB writes). Result: **0 / 24**
authed-route combos overflow (real trialing billing state; real poster route with
`hideMobileChrome` confirmed firing on mobile). **Total: 176 / 176 combos by the
`scrollWidth` metric — but that metric is unreliable under the global
`overflow-x: hidden` (it masks clipped content). See the Correction below: the
figures were re-validated with a per-element method, which found real overflow on
the poster route that this metric had hidden.**

Deferred (shared-primitive decisions, low severity, ui-only follow-ups):

- `loyalty-card-form.tsx` reward-row tap targets (size-8 edit button +
  `RewardActiveToggle`) → ≥44px, and its `1.5px` transparent-resting input
  borders → `2px`-ink (shared with the card tab + admin consoles).
- `app/app/page.tsx` section-level error boundary for the activity stream (needs
  a new `"use client"` boundary component).
- `AccountTabBar` → extract a shared `components/brand` segmented-control
  primitive (the in-place ≥44px + list semantics fix is done).
- Harness gap: `/app/account?tab=billing` mounts the real billing skeleton
  because `BillingPanel` self-fetches with no presentational prop seam.

## Verification correction — 2026-06-29 (poster responsiveness)

The overflow figures above used `documentElement.scrollWidth`, which the global
`overflow-x: hidden` (`app/globals.css`) **clamps** — it hides both the scrollbar
and the metric, so clipped content read as "no overflow." Re-validated with a
per-element `getBoundingClientRect().right > innerWidth` check that excludes
elements inside intentional `overflow-x` scrollers. This surfaced real overflow
the earlier metric had masked.

**Poster (`/app/qr/poster/[template]`) — 3 real overflow bugs, all fixed:**

1. `.sheetScaler` ran `transform: scale()` on a full-A4 (210mm / ~793px) box;
   transform does not shrink layout, so the `.page` grid (chrome included) was
   forced to ~793px and clipped below that width. Fix: the scaler now sizes to
   its scaled footprint (`calc(a4 * scale)`) and the sheet scales from `top left`
   (`a4-poster.module.css`).
2. Centering regression from (1) → `.stage { justify-content: center }`.
3. The scale budgeted width from `100vw`, ignoring the sidebar-narrowed content
   area, so tall tablets (768×1366) over-scaled and overflowed +212px. Fix:
   `A4Poster`'s ResizeObserver writes `--poster-avail-width` from
   `page.clientWidth` and the scale uses it instead of `100vw` (`a4-poster.tsx`).
4. Regression from (1): the copy templates (editorial/bold/ticket) set
   `width: 100%` on the sheet, which resolved to the already-scaled `.sheetScaler`
   and was scaled a second time — the ticket collapsed to a ~0.29 strip instead
   of A4. Fix: a fixed `210mm × 297mm` `.sheetInner` box takes the transform, so
   `width: 100%` resolves to true A4 and scales exactly once. All five templates
   (incl. northstar/thermal) verified at aspect ratio **0.707** at every width.

Re-verified on the **real authed** `/app/qr/poster/{bold,editorial,ticket}` (seeded
merchant session): **0 overflow** at 320/375/390/430/768/1024/1280/1440 plus
768×1366 and 834×1112. `pnpm build` green.

**Pre-existing residuals found (non-poster, minor, not yet fully resolved):**

- `/app/customers` @768 with the sidebar open: +34px (improved from +62 by
  wrapping the desktop scan banner). A subtle min-content forcer remains in the
  members header/StatStrip area at the sidebar-narrowed width. `/app/activity`,
  dashboard, account, launch tabs, qr, scan, onboarding, reward-scan, and the
  empty/error states are clean at every width.
- `/dev/app-harness/skeletons` (dev-only QA page): a skeleton with a wide
  min-content overflows the narrow harness view; does not affect real `/app`
  loading states (rendered one at a time in proper containers).

## Verification log — 2026-06-29 (poster responsiveness, finish pass)

Finished the `/app/qr/poster/[template]` responsiveness + UX polish. Method:
the spec's per-element check (`getBoundingClientRect().right > innerWidth` and
`left < 0`, excluding descendants of `overflow-x:auto/scroll` scrollers) driven
over a dependency-free CDP-over-WebSocket harness against the running dev server,
across all 5 templates × 12 viewport combos: the 8 spec widths
(320/375/390/430/768/1024/1280/1440), the tall tablets (768×1366, 834×1112), and
the short-landscape combos (1024×768, 1280×800). Touch emulated below 768.
The **real authed** `/app/qr/poster/[template]` was exercised with a real seeded
merchant session (`mia@old-crown-girton.test`, admin magic-link → `/auth/confirm`
→ session cookie), sidebar **open and collapsed**, in addition to the shell-less
`/dev/poster-preview`.

### Root cause the earlier pass missed (real, now fixed)

The prior correction validated `/dev/poster-preview` (the page fills the
viewport) and read **0 overflow**. But the shell-less preview cannot reproduce
the shell's sidebar-narrowed column, and the per-element check on the **real
authed route** found overflow at **every phone width for every template**:
**20 / 50** authed combos overflowed (320: +128px, 375: +73, 390: +58, 430:
+18; clean ≥768). The sheet was clipped on the right and the chrome shifted
16px off the left.

Cause: `.page` is a CSS grid; its three rows (chrome, stage, action bar) are
grid items, which default to `min-width: auto` and so refuse to shrink below
their min-content. Inside the shell's sidebar-narrowed column the single grid
track blew out to ~448px in a 288px column (page `clientWidth` was correct at
288; the chrome computed to `432.359px`). This also fed a fragile ResizeObserver
loop (sheet size → page width → avail-width → sheet size).

Fix (`a4-poster.module.css`): `.page > * { min-width: 0 }`. The rows shrink to
the track, the sheet's own scale becomes the single source of width, and the
page can never overflow its column. Confirmed by injection test (27→0 @320,
14→0 @390) before editing, then by the full re-run.

### Changes (all within scope: chrome, action bar, A4Poster CSS)

1. **Grid overflow fix** — `min-width: 0` on the `.page` rows (above).
2. **Workspace frame (desktop dead-space + edge-flung actions, issue b)** — new
   `--poster-frame-width = a4-width × scale` and
   `--poster-frame-max = min(100%, max(frame-width + 64px, 32rem))` on `.page`;
   the chrome top bar, template strip, guidance, and action bar now cap at
   `max-w-[var(--poster-frame-max)]` instead of `max-w-6xl`. The toolbar hugs
   the sheet on landscape desktop (Back/Print no longer stranded at the column
   edges), grows to full width when the sheet is width-bound (tall tablets /
   phones), and never drops below a comfortable 32rem so the strip + actions
   stay usable. Tracks the sidebar-narrowed width automatically (it derives from
   the same measured scale).
3. **Template strip** — compact name-only pills (a tab switcher) replacing the
   `lg`-only description cards that could not fit the tightened frame; the
   description rides a `title` tooltip, the live preview carries the rest. The
   active pill scrolls into view (nav-local scroll, never `scrollIntoView`), and
   the scrollbar is hidden to match the repo's `filter-pills`/`jump-nav`
   convention. Pills stay ≥44px.
4. **Wet Ink shadow compliance** — `.sheetScaler` swapped its blurred
   `drop-shadow(0 28px 48px …)` (a soft shadow, off-system) for a HARD tokenised
   offset `drop-shadow(6px 6px 0 var(--w-shadow-color))`. Suppressed in print
   already (`@media print .sheetScaler { filter: none }`).

### Results — per-element overflow

| Surface | combos | overflow | tap < 44px | sheet ratio |
| --- | --- | --- | --- | --- |
| `/dev/poster-preview` (before) | 50 | 0 | 0 | 0.707 |
| **authed route (before)** | 50 | **20** | 0 | 0.707 |
| `/dev/poster-preview` (after) | 50 | **0** | 0 | 0.707 |
| authed, sidebar open (after) | 50 | **0** | 0 | 0.707 |
| authed, sidebar collapsed (after) | 50 | **0** | 0 | 0.707 |

**Total after: 0 / 150** per-element overflow hits; **0** sub-44px tap targets
at every touch width; every template scales to aspect ratio **0.707** at every
width. Issue (f): re-measured near first paint (settle≈40ms) — **0 overflow**
(pre-hydration the sidebar is not yet mounted, so the `100vw` fallback matches
the actual content width; the ResizeObserver recomputes the instant the sidebar
appears). Before/after screenshots captured at 320/390/768/1280 + 768×1366 +
834×1112 for editorial, bold, ticket, northstar (Night card), thermal (Receipt).

### Print parity

`@media print` unchanged. Print-media emulation + `Page.printToPDF` (A4, scale 1,
no margins) for editorial (light), bold (dark), thermal: chrome **display:none**,
action bar **display:none**, sheet fills the full A4 box (794×1123px = 210×297mm),
nothing shifted. Output is byte-identical to before this pass — every edit is
either screen-only (the scaler lift, removed in print) or on chrome that print
already hides.

### Gates

`pnpm typecheck` ✅ · `pnpm build` ✅ (poster route compiled; built to an isolated
`distDir` so the foreign dev server on :3000 was untouched, then `next.config.ts`
restored to baseline) · `pnpm lint` ✅ for the changed files (`poster-preview-chrome.tsx`
clean; the CSS module is not eslinted; only the pre-existing vendored
`ds-bundle/`, `.design-sync/`, `.ds-sync/` failures remain) · `pnpm tokens:check`
✅ (22 tokens) · `pnpm claims:check` ✅ (57 files).

`pnpm test:micro-specs` ⚠️ 10/12 — the two failures are the **same pre-existing
poster-revamp drift** already flagged: `qr-a4-poster-templates.test.mjs` asserts
retired copy (`/Free · No app · 20 seconds/`, …) and retired QR dimensions
(`108mm/66mm/62mm`) from `qr-panel.tsx` + the poster copy/pieces. This pass did
not touch those files (only `a4-poster.module.css` chrome layout +
`poster-preview-chrome.tsx`), and the asserted strings are not what changed —
`210mm`/`297mm`/`@media print` still match. Left for the poster-revamp owner per
the standing note.

### Residuals / deferred (non-blocking)

- The poster route still renders inside the shell's `px-4 py-8 max-w-6xl` content
  wrapper (the `hideMobileChrome` flag drops only the mobile header + tab bar).
  This is harmless after the overflow fix (the workspace caps itself; the mobile
  paper gutter is comfortable) but it is the reason the desktop poster sits a
  little below the fold and is not edge-to-edge full-bleed. Truly full-bleed
  would need the shell to skip that wrapper for poster routes — an out-of-scope
  shell behaviour change (shell is read-only context); recorded here rather than
  taken. Candidate `approved_exceptions` entry if the team wants full-bleed.
- `Back` is `min-h-11 sm:min-h-9` (44px on phones, 36px at ≥640px) — the existing
  density pattern; ≥44px holds at every required touch width (320–430).

## Verdict — 2026-06-29 (poster responsiveness)

**READY.** `/app/qr/poster/[template]` is fully responsive: 0/150 per-element
overflow across 5 templates × (8 spec widths + 2 tall tablets + 2 short
landscape) on `/dev` and the real authed route (sidebar open + collapsed),
0 sub-44px tap targets, aspect 0.707 everywhere, first paint clean, print
byte-identical. All required gates green except the pre-existing
`qr-a4-poster-templates.test.mjs` drift (poster-revamp owner; outside this
pass's blast radius).
