---
spec_id: MS-FOUNDATION-WET-INK-MOTION-SYSTEM
title: Wet Ink Motion System — Framer Motion Library Consolidation
status: active
risk_class: ui-only
owner: factory-droid
last_reviewed: 2026-06-16
allowed_blast_radius:
  - app/globals.css
  - app/dev/design-system/**
  - components/motion/**
  - components/loyalty/**
  - components/brand/receipt-card.tsx
  - components/customer/**
  - components/marketing/marquee.tsx
  - lib/motion/**
  - micro-specs/01-foundation/03-wet-ink-motion-system.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - DESIGN.md
  - AGENTS.md
  - tests/micro-specs/wet-ink-motion.test.ts
  - tests/micro-specs/earned-stamp-redesign.test.ts
  - tests/e2e/design-system-catalog.spec.ts
implementation_surfaces:
  - components/motion/**
  - components/loyalty/**
  - components/brand/**
  - components/customer/**
  - components/marketing/**
  - lib/motion/**
  - app/globals.css
  - app/dev/design-system/**
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/wet-ink-motion.test.ts
  - tests/micro-specs/earned-stamp-redesign.test.ts
  - tests/micro-specs/customer-flow-redesign.test.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - npx playwright test
approved_exceptions: []
---

# Micro-Spec: Wet Ink Motion System — Framer Motion Library Consolidation

## Governance Status Evidence

- Lifecycle status: `active` (ready for engineering implementation).
- Stale/superseded handling: this spec is new and replaces no prior intent.
- Blast radius and surfaces: motion library (components/motion/, lib/motion/), consumer components in loyalty/brand/customer, CSS globals cleanup, design-system dev catalog, and documentation.

## Exact Goal and User-Visible Outcomes

Complete the design system by consolidating all choreographed motion into a **typed Framer Motion library**. Every motion beat defined in [DESIGN.md](../../DESIGN.md) (`rise`, `slam`, `soft-stamp`, `shake`, `pop`, `wiggle`, `ripple`, `sheet-up`, `marquee`) is available as a **reusable `WetInk*` primitive** in `components/motion/`, backed by motion tokens in `lib/motion/`. Production code uses primitives, not inline CSS `animation: w-*` styles. The system respects `prefers-reduced-motion`. A dev catalog showcases all primitives with live toggles.

**Out of scope:** edge-case customer audit work, new product flows, editing shadcn primitives in `components/ui/`.

## Strict Constraints and Assumptions

- **Framer Motion version 12** is already a dependency; use `import { motion, useReducedMotion } from "motion/react"` everywhere.
- **Motion tokens** in `lib/motion/tokens.ts` are the single source of truth for durations/easings; CSS variables (`--w-*`) are read-only references.
- **`prefers-reduced-motion`** global rule in `app/globals.css` sets `animation-duration: 0.01ms` for all elements; Framer components must also check `useReducedMotion()` and render static children.
- **Test-first (Red → Green → Refactor).** Vitest specs in `tests/micro-specs/wet-ink-motion.test.ts` are source-analysis only (no React Testing Library), matching the repo's test model.
- **Preserved test contracts:** `earned-stamp-redesign.test.ts` pins the `@keyframes w-slam` body; migration updates that test to assert the Framer `WetInkSlam` contract. `customer-flow-redesign.test.ts` pins consumer structure (`RewardChip`, `afterGrid`, etc.); migration keeps those exact names.
- **Reduced-motion static rendering:** all `WetInk*` primitives must render static (non-animated) children when reduced motion is enabled—no opacity changes, no blank states.

## Decisions Already Made

- Framer Motion 12 is the sole choreography engine (CSS `animation:` is forbidden in motion contexts).
- Motion tokens read from `app/globals.css` CSS variables: `--w-dur-*`, `--w-ease`, `--w-ease-slam`.
- The design system entry point is `DESIGN.md` motion section, kept in sync with implementation.
- The Wet Ink brand layer (`app/globals.css` "Wet Ink layer") applies tactile press feedback (button `active:` state) — that stays CSS-based, not Framer.

## Behavioral Requirements

- **MS-FOUNDATION-WET-INK-MOTION-SYSTEM-001** WHEN a component imports `useReducedMotion()` from `motion/react`, THE result is checked and when true, THE component renders static children with no transform animation.
- **MS-FOUNDATION-WET-INK-MOTION-SYSTEM-002** WHEN `StampDot` earns with `slammed={true}`, THEN `WetInkSlam` runs 380ms with overshoot easing and lands on the slot's `--stamp-rot` tilt variable.
- **MS-FOUNDATION-WET-INK-MOTION-SYSTEM-003** WHEN a stamp slams, THEN the parent receipt wrapper may optionally run `WetInkShake` for 300ms (composed via `StampSlamSequence`).
- **MS-FOUNDATION-WET-INK-MOTION-SYSTEM-004** WHEN the motion library is imported via `@/components/motion`, THEN all nine vocabulary exports are available: `WetInkRise`, `WetInkSlam`, `WetInkSoftStamp`, `WetInkShake`, `WetInkPop`, `WetInkWiggle`, `WetInkRipple`, `WetInkMarquee`, `WetInkSheet`, plus composed `StampSlamSequence`.
- **MS-FOUNDATION-WET-INK-MOTION-SYSTEM-005** WHEN loyalty/brand/customer components animate, THEN they import motion primitives; no inline `animation: "w-*"` CSS strings remain in component JSX.
- **MS-FOUNDATION-WET-INK-MOTION-SYSTEM-006** WHEN `lib/motion/tokens.ts` is read, THEN durations and easings are returned as Framer-compatible objects; when `--w-dur-shake` is read in CSS, THE value is 300ms.

## Verification Criteria

**Acceptance criteria:**

- `pnpm lint` passes (no animation style strings in production components).
- `pnpm typecheck` passes (all motion imports are typed).
- `pnpm test` passes (all `wet-ink-motion.test.ts` + `earned-stamp-redesign.test.ts` + `customer-flow-redesign.test.ts` assertions pass).
- `npx playwright test tests/e2e/design-system-catalog.spec.ts` passes (catalog loads, slam demo runs, reduced-motion static state renders).
- All CSS `@keyframes w-*` blocks are removed; only global `prefers-reduced-motion` rule and tactile press rules remain.
- `DESIGN.md` motion section documents the Framer vocabulary.

**Manual QA:**

- Open `/dev/design-system` and toggle each primitive; confirm no layout shift, no blank content.
- Confirm `/card/[membershipId]` stamp earn and `/reward/[rewardId]` redeem animations run without console errors.
- Set `prefers-reduced-motion: reduce` in OS accessibility settings; confirm the app renders all content statically (no spinner-like motion).
- Inspect `components/motion/index.ts` barrel; all nine exports are present.

---

## Implementation Strategy

The work is structured TDD and fans across six sequential phases, each producing a testable milestone:

### Phase 0 — Micro-spec and Red Tests

1. Author this spec; register in traceability.
2. Write `tests/micro-specs/wet-ink-motion.test.ts` with six failing assertions (one per EARS requirement).
3. Update `tests/micro-specs/earned-stamp-redesign.test.ts` test #3: migrate from CSS keyframe body assertions to Framer `WetInkSlam` contract.

**Verification:** `pnpm test` produces expected failures; `pnpm governance` passes.

### Phase 1 — Motion Tokens

1. Create `lib/motion/tokens.ts`:
   - Export `wetInkTransition` object with `.slam`, `.move`, `.press`, `.shake` properties.
   - Read `--w-dur-*` and `--w-ease*` from CSS and return Framer-compatible cubic-bezier arrays.
   - Provide a helper to check if reduced motion is enabled.

2. Create `lib/motion/use-reduced-motion.ts`:
   - Thin wrapper over `useReducedMotion()` from `motion/react`.
   - Exported for component use.

3. Add `--w-dur-shake: 300ms` to `app/globals.css` root.

**Verification:** `pnpm typecheck` and `pnpm test` pass.

### Phase 2 — Framer Primitive Library

1. Implement all nine primitives in `components/motion/`:
   - `WetInkRise` — replaces `w-rise` CSS keyframe; y: 14 → 0, standard ease.
   - `WetInkSlam` — replaces `w-slam`; scale 2.6 → 1, rotate to `--stamp-rot`, slam ease 380ms.
   - `WetInkSoftStamp` — gentler slam for previews.
   - `WetInkShake` — paper jitter 300ms; x/y translate, tiny rotation.
   - `WetInkPop` — scale pop with overshoot; used for reward seals and confetti dots.
   - `WetInkWiggle` — infinite gentle rotation; sealed mystery on previews.
   - `WetInkRipple` — expanding fade ring.
   - `WetInkMarquee` — horizontal loop; pauses under reduced motion.
   - `WetInkSheet` — bottom sheet enter/exit (translateY).

2. Composed pattern `StampSlamSequence`: `WetInkSlam` on dot + optional `WetInkShake` on receipt wrapper.

3. Refactor `components/motion/stamp-celebration.tsx` to use `WetInkPop` + `WetInkRipple` instead of inline easing constants.

4. Deprecate `MotionReveal`; alias to `WetInkRise` for one release.

5. Update `components/motion/index.ts` barrel to export all nine + composed helpers.

**Verification:** `pnpm typecheck` passes; all new primitives are exported; `pnpm test` assertions for motion primitives pass.

### Phase 3 — Migrate Consumers

1. **stamp-grid.tsx**: Add `"use client"` directive. Replace inline `animation: "w-slam ..."` and `animation: "w-pop ..."` styles with `WetInkSlam` / `WetInkPop` props on `StampDot` and `RewardChip`. Keep `--stamp-rot`, `data-compact`, `RewardChip`, all structural contracts intact (tests depend on them).

2. **reward-seal.tsx**: Replace `animate-[w-pop_...]` class and `animate-[w-wiggle_...]` class with `WetInkPop` / `WetInkWiggle` motion components. Props: `slammed`, `wiggle`.

3. **reward-celebration.tsx**: Replace inline dot `animate-[w-pop_...]` with `WetInkPop`; wrap `RewardSeal` result in `WetInkPop` via the seal component.

4. **stamp-journey-preview.tsx**: Already imports `useReducedMotion`; no animation in this component—it manages state to trigger slam/pop on its child `StampDot` / `RewardChip`.

5. **marquee.tsx**: Replace `style={{ animation: "w-marquee ..." }}` with `WetInkMarquee` motion component.

6. **receipt-card.tsx**: Add optional `shaken?: boolean` prop. When true, wrap children in `WetInkShake`.

7. **customer-flow-system.tsx** `CustomerStampCard`: Read `slamIndex` and pass `shaken={slamIndex >= 0}` to receipt wrapper. Update `legal-sheet.tsx` to wrap content in `WetInkSheet`.

8. **app/page.tsx, dashboard-home-streams.tsx, activity-detail-feed.tsx**: Replace `MotionReveal` imports/calls with `WetInkRise`.

**Verification:** `pnpm lint` detects no inline `animation: "w-*"` strings; `pnpm test` passes all consumer-facing assertions.

### Phase 4 — CSS Cleanup

1. Remove all `@keyframes w-*` blocks from `app/globals.css`.
2. Retain global `prefers-reduced-motion` rule and tactile press rules (`[data-slot="button"]:active`, `.pressable:active`).
3. Confirm `--w-dur-shake: 300ms` is present.

**Verification:** `pnpm test` still passes (no component relies on the deleted keyframes); CSS file is smaller.

### Phase 5 — Dev Catalog

1. Create `app/dev/design-system/page.tsx` behind the existing dev gating in `app/dev/layout.tsx`.
2. Sections:
   - **Tokens** — colour swatches, border-radius, shadows, motion durations/easings as readable table.
   - **Typography** — live rendering of `Eyebrow`, `PageTitle`, `MonoTag`.
   - **Surfaces** — `ReceiptCard` (plain, edge, shaken variations).
   - **Motion** — live toggles for each `WetInk*` primitive + `StampSlamSequence`; show static (reduced-motion) fallback.
   - **Loyalty** — `StampGrid` states, `RewardSeal` states, `RewardTicket` states.

3. Optional `tests/e2e/design-system-catalog.spec.ts` — Playwright smoke test that loads the catalog and confirms slam animation runs (screenshot evidence).

**Verification:** `/dev/design-system` loads without errors; all motion toggles render static under reduced motion.

### Phase 6 — Documentation and Final Verification

1. Update [DESIGN.md](../../DESIGN.md):
   - Motion section: change from "keyframes live in `globals.css`" to "Framer primitives in `components/motion/`".
   - Add vocabulary table: primitive → duration → easing → when to use.
   - Composed patterns: slam + shake, celebration burst.
   - Import rule: **product code must not use raw CSS `animation: w-*`**.

2. One-liner in [AGENTS.md](../../AGENTS.md) / [micro-specs/GLOBAL_CONTEXT.md](../../micro-specs/GLOBAL_CONTEXT.md): motion implementation surface is `components/motion/`.

3. Mark `components/loyalty/pint-reward.tsx` deprecated (already retired from customer flow; dead-code gate will remove).

4. Run verification gates:
   - `pnpm lint` — no animation strings.
   - `pnpm typecheck` — strict typing on all imports.
   - `pnpm test` — all assertions pass.
   - `pnpm governance` — traceability consistent.
   - `npx playwright test tests/e2e/design-system-catalog.spec.ts` (if implemented).

**Verification:** All gates green; `DESIGN.md` reflects the implemented architecture.

---

## Estimated Effort

| Phase     | Scope                                | Days                    |
| --------- | ------------------------------------ | ----------------------- |
| 0         | Micro-spec, Red tests, traceability  | 0.5                     |
| 1         | Motion tokens library                | 0.5                     |
| 2         | Nine Framer primitives + composition | 1.0                     |
| 3         | Consumer migration (8 files)         | 1.0                     |
| 4         | CSS cleanup                          | 0.25                    |
| 5         | Dev catalog + optional Playwright    | 0.5                     |
| 6         | Docs + verification                  | 0.25                    |
| **Total** |                                      | **~3.5–4 focused days** |

All work is test-first; each phase unblocks the next.
