---
spec_id: MS-FOUNDATION-WET-INK-FULL-UI-REWRITE
title: Wet Ink Full UI/UX Rewrite — Production Parity with the Reference Library
status: active
risk_class: ui-only
owner: factory-droid
last_reviewed: 2026-06-17
allowed_blast_radius:
  - components/**
  - app/globals.css
  - app/dev/**
  - app/page.tsx
  - app/pricing/**
  - app/(auth)/**
  - docs/UI_PARITY_MATRIX.md
  - micro-specs/01-foundation/04-wet-ink-full-ui-rewrite.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - DESIGN.md
  - tests/micro-specs/*redesign*.test.ts
  - tests/micro-specs/wet-ink-motion.test.ts
  - tests/e2e/*screenshot*.spec.ts
  - tests/e2e/design-system-catalog.spec.ts
implementation_surfaces:
  - components/brand/**
  - components/loyalty/**
  - components/motion/**
  - components/forms/**
  - components/data/**
  - components/layout/**
  - components/customer/**
  - components/merchant/**
  - components/admin/**
  - components/marketing/**
  - components/auth/**
  - app/dev/**
related_docs:
  - DESIGN.md
  - docs/UI_PARITY_MATRIX.md
  - micro-specs/01-foundation/03-wet-ink-motion-system.md
  - micro-specs/05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md
  - outputs/nabaperks-ui-reference/component-inventory.md
  - outputs/nabaperks-ui-reference/copy-inventory.md
related_tests:
  - tests/micro-specs/customer-flow-redesign.test.ts
  - tests/micro-specs/earned-stamp-redesign.test.ts
  - tests/micro-specs/admin-console-redesign.test.ts
  - tests/micro-specs/wet-ink-motion.test.ts
  - tests/micro-specs/merchant-readbacks.test.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - npx playwright test
approved_exceptions: []
---

# Micro-Spec: Wet Ink Full UI/UX Rewrite — Production Parity with the Reference Library

## Governance Status Evidence

- Lifecycle status: `active` (ready for engineering implementation).
- Stale/superseded handling: this spec is the umbrella over the surface tracks; it
  consumes and does **not** supersede [03-wet-ink-motion-system](03-wet-ink-motion-system.md)
  (motion library) — that spec owns `components/motion/**`. Behavioural IA rules
  defer to [05-merchant-value/02](../05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md).
- Blast radius and surfaces: every production UI surface under `components/**`, the
  marketing/auth pages, the dev catalog, the Wet Ink CSS layer, and the redesign/
  screenshot test contracts. **No route loaders, Server Actions, or RPC calls
  change** — only import paths and JSX composition.

## Exact Goal and User-Visible Outcomes

Rebuild every production UI component so it matches the Wet Ink reference library
([`outputs/nabaperks-ui-reference/`](../../outputs/nabaperks-ui-reference/)) and
[DESIGN.md](../../DESIGN.md) in visual treatment, copy tone, motion beats, and
surface structure — while keeping routes, server actions, and the RPC mutation
boundary unchanged. The reference's 94 components are mapped one-to-one to
production files in [docs/UI_PARITY_MATRIX.md](../../docs/UI_PARITY_MATRIX.md);
each `⚠️ port` row resolves to `done` or an explicit `skipped` with rationale.

**Out of scope (retired mechanics — never ported):**

- The reference `staff` surface (the `22-staff-counter` module) and `PinPad` — the
  handed-phone staff-PIN model is superseded by customer-owned self-service stamping;
  no staff-PIN UI or copy enters production.
- Customer tap-to-redeem (`Screen-ready` PIN sheet) — redemption is a merchant scan.
- All reference `localStorage` state machines (`CustomerFlow`, `MerchantSurface`,
  `MarketingSite`, etc.) — production drives state through real routing + server state.
- `components/tweaks/**` and `JourneyMap` storyboard scaffolding — reference only.
- Backend/schema changes (no read-shape change is required for visual parity).

## Strict Constraints and Assumptions

- **No shadcn restyling.** `components/ui/**` is never edited for visuals; theme
  through `app/globals.css` tokens (`--w-*`), the unlayered "Wet Ink layer" that
  targets `data-slot` attributes, and brand/loyalty/customer wrappers.
- **Motion via primitives only.** Production JSX/CSS contains no raw `animation: w-*`
  or `animate-[w-*]`; choreography routes through the `WetInk*` primitives in
  `components/motion/` (see [03](03-wet-ink-motion-system.md)).
- **British copy, no emoji, no exclamation marks** ([DESIGN.md](../../DESIGN.md));
  value-first register cross-checked against
  [copy-inventory.md](../../outputs/nabaperks-ui-reference/copy-inventory.md) and
  [docs/PROJECT_SPEC.md](../../docs/PROJECT_SPEC.md). The `✱` disc stays the
  wordmark/logo signature only; functional glyphs use the `@hugeicons` `Icon` wrapper.
- **Mobile-first customer flows** (~410px thumb column, ≥44px tap targets).
- **Test-first (Red → Green → Refactor).** Redesign Vitest contracts are
  source-analysis specs (no RTL), matching the repo's model; each in-scope EARS
  requirement gets a failing assertion before the rewrite.
- **Production mechanics win over prototype.** Where reference copy/flow contradicts
  the live product, the parity matrix "adapt" verdict governs.

## Decisions Already Made

- The reference library is **visual/interaction reference only**; nothing imports
  from `outputs/**`.
- The `/dev/design-system` catalog is the acceptance gate for foundation primitives
  before surface tracks sign off.
- `components/loyalty/pint-reward.tsx` is retired from exports (contractually gone).
- Skeletons mirror real structure (see the merchant skeleton overhaul), not grey blobs.

## Behavioral Requirements

- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-001** WHEN any production component under
  `components/**` renders choreographed motion, THEN it uses a `WetInk*` primitive and
  contains no raw `animation: w-*` or `animate-[w-*]` string.
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-002** WHEN a Wet Ink visual treatment is
  needed on a shadcn primitive, THEN it is applied via tokens / the `data-slot` Wet Ink
  layer / a wrapper, and `components/ui/**` source is not edited for styling.
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-003** WHEN customer copy is authored, THEN it
  is British English, value-first, free of emoji and exclamation marks, and uses
  "Save my card" register (never "register"/"create an account").
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-004** WHEN the reward family renders
  (stamp-row chip, ticket stub, celebration seal), THEN one `RewardSeal` vocabulary and
  one `RewardTicket` are used across all sizes/states (`sealed`/`waiting`/`ready`/`redeemed`).
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-005** WHEN the customer self-service stamp flow
  renders, THEN it uses customer-owned self-service stamping from the permanent venue
  QR with no staff-PIN sheet and no customer tap-to-redeem control.
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-006** WHEN the merchant console renders, THEN
  the masthead, stat tiles, activity rows, and members readback mirror the reference
  `McBrand`/`McStat`/`McFeedLine`/`MerchantCustomers` shapes, and the members readback
  masks PII (initials + masked phone) per [05/02](../05-merchant-value/02-merchant-console-trust-and-ia-cleanup.md).
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-007** WHEN a merchant `/app/*` route is loading,
  THEN the route fallback shows only a page-title skeleton and each page streams realistic,
  structure-mirroring section skeletons (no dashboard-shaped double flash).
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-008** WHEN the admin console renders, THEN it
  uses the "quieter ink" treatment (reduced rotation, `--w-paper-2` panels) and the shared
  data primitives, and surfaces the MFA gate banner.
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-009** WHEN the marketing home/pricing render,
  THEN they compose the `Mk*` reference structure (hero, marquee via `WetInkMarquee`,
  pricing receipt, FAQ accordion, footer) with no `localStorage` view-state.
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-010** WHEN the merchant auth surface renders, THEN it
  uses the `McAuth` Wet Ink layout (VenueMark masthead, mono `Eyebrow` field labels, ink-bordered
  `McField` wells, full-width tactile submit) with ≥44px pressable targets, **keeping the
  production Supabase email + password mechanic** — the reference passwordless email → OTP is a
  prototype mechanic and is not ported (production mechanics win).
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-011** WHEN `/dev/design-system` is opened, THEN it
  renders a live catalog of tokens, typography, surfaces, motion primitives, and loyalty
  states, and motion primitives render static children under `prefers-reduced-motion`.
- **MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-012** WHEN any `app/**` page is rewritten, THEN its
  loaders, redirects, Server Actions, and RPC calls are byte-for-byte unchanged; only import
  paths and JSX composition differ.

## Verification Criteria

**Acceptance criteria:**

- `pnpm lint` and `pnpm typecheck` pass.
- `pnpm test` passes, including all `*redesign*.test.ts`, `wet-ink-motion.test.ts`, and
  `merchant-readbacks.test.ts` contracts (existing + new for merchant/marketing/auth gaps).
- `npx playwright test` screenshot suites are green and updated per the runbook.
- Every `⚠️ port` row in [docs/UI_PARITY_MATRIX.md](../../docs/UI_PARITY_MATRIX.md) is
  `done` or `skipped` with rationale.
- No production file uses raw `animation: w-*` / `animate-[w-*]`.
- `/dev/design-system` documents every foundation primitive and loyalty state.
- `DESIGN.md` and the parity matrix reflect the final implementation.

**Manual QA matrix:**

| Surface   | Key paths                                                                | Check                                                  |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Customer  | `/q/*`, `/card/*`, `/reward/*`, `/home/*`                                | stamp slam, seal reveal, ticket states, reduced motion |
| Merchant  | `/app`, `/app/activity`, `/app/customers`, `/app/launch`, `/app/account` | skeleton → content, no double-flash, PII masking       |
| Admin     | `/admin/*`                                                               | quieter ink, MFA banner, support form                  |
| Marketing | `/`, `/pricing`                                                          | hero, marquee, footer                                  |
| Auth      | `/login`, `/signup`                                                      | OTP boxes, pressable targets                           |

---

## Implementation Strategy

Foundation-first, then five parallel surface tracks plus cross-cutting shells. The
[docs/UI_PARITY_MATRIX.md](../../docs/UI_PARITY_MATRIX.md) row is the unit of work; mark
rows `in_progress` → `done`/`skipped` as each slice lands.

### Phase 0 — Governance (this spec + matrix)

Author this umbrella spec and the parity matrix; register traceability.

### Phase 1 — Foundation (blocking)

1. Finish the motion migration owned by [03](03-wet-ink-motion-system.md) — consumers on
   `WetInk*`, keyframes removed, `wet-ink-motion.test.ts` strengthened. **(done)**
2. Align `components/brand/**` to the shared reference primitives (InkButton/GhostLink
   pattern, MonoTag/MonoLine, ReceiptCard/ReceiptRule, VenueMark, OtpBoxes, Seal).
3. Rewrite `components/loyalty/**` as the shared stamp/reward system; retire
   `pint-reward.tsx` from exports.
4. Add `/dev/design-system` catalog (acceptance gate).
5. Align `components/data/**` to reference table/feed/funnel shapes.

### Phase 2 — Surface tracks (parallel)

- **Track A — Customer** (`components/customer/**` + `layout/customer-*`).
- **Track B — Merchant** (`components/merchant/**` + skeletons + `layout/merchant-app-shell`).
- **Track C — Admin** (`components/admin/**` + `layout/admin-shell`).
- **Track D — Marketing** (`components/marketing/**` + `app/page.tsx`, `app/pricing`).
- **Track E — Auth** (`components/auth/**`).
- **Track F — Layout shells** (cross-cutting; start day 1).

Each track: mark matrix rows `in_progress` → add/extend failing Vitest contract → rewrite
components → update the matching `app/dev/` harness → regenerate Playwright screenshots →
mark rows `done`.

### Phase 3 — Integration, regression, sign-off

Screenshot regression, full quality gates, DESIGN.md + matrix sign-off, ROUTES.md regen if
page composition imports changed.

## Estimated Effort

| Phase     | Scope                                                | Days                  |
| --------- | ---------------------------------------------------- | --------------------- |
| 0         | Spec + parity matrix                                 | 0.5                   |
| 1         | Foundation (motion done, brand/loyalty/data/catalog) | 2.0                   |
| 2         | Five surface tracks + shells (concurrent)            | 4.0                   |
| 3         | Integration, screenshots, sign-off                   | 1.0                   |
| **Total** |                                                      | **~7.5 focused days** |
