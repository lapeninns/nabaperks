# Print Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared print layout system — geometry, rhythm, zone solver, layout ledger and seven guards — and prove it end-to-end by re-laying the `primer` poster on it, fixing defects #1 and #2.

**Architecture:** A new pure module namespace `lib/print/` owns all layout maths in millimetres with no rendering dependency — no pdf-lib, no React. Renderers consume it and differ only in how they paint. Every placed mark is recorded to a layout ledger, and guards assert on the ledger in-process so defects fail a unit test rather than shipping.

**Tech Stack:** TypeScript (strict), pdf-lib for print output, React/CSS modules for preview, `node:test` + `node:assert/strict` for tests, `qrcode` for QR module counts.

**Source spec:** `docs/superpowers/specs/2026-07-26-print-kit-design-system-design.md`

## Global Constraints

- **File length: every `.ts`/`.tsx` file must be under 250 lines.** `tests/support/poster-source-analysis.mjs` fails at `lineCount >= 250`.
- **Banned TypeScript constructs**, all flagged by the same analyser: `any`, `as` assertions (**this includes `as const`**), angle-bracket assertions `<T>x`, and non-null `!`. Use explicit union types instead of `as const`.
- **Unit tests** live in `tests/unit/*.test.mjs`, run via `pnpm test:unit`, and **do** get the `@/` path alias (`--import ./tests/support/register-alias.mjs`).
- **Contract tests** live in `tests/contracts/*.test.mjs`, run via `pnpm test:contracts`, and **do not** get the alias loader — they must use `node:fs` and `path.join(process.cwd(), ...)`.
- **Coverage floors** apply to `lib/**`: 80% lines, 80% functions, 70% branches (`pnpm test:coverage`).
- **Customer-facing copy is catalogue-owned.** The `poster-render-ownership` contract forbids approved copy strings (≥18 chars) appearing in renderer source. Copy changes go in `config/*.json`.
- **Coordinate convention:** `lib/print/` is **y-down from the trim top**. pdf-lib is y-up from the trim bottom. Convert only at the paint boundary via `toPdfYMm`.
- **Canonical brand string is `Nabaperks`.** `Nab a Perks` and `NABAPERKS` are banned.
- **Do NOT run Playwright with `--update-snapshots` on this machine.** Visual baselines are darwin-only locally; `-linux` twins must be blessed from CI artifacts.
- Branch in use: `design/print-kit-design-system`. `main` is a protected ruleset with no bypass actors.

## File Structure

**Created — `lib/print/` (pure layout, no render dependency):**

| File                        | Responsibility                                       |
| --------------------------- | ---------------------------------------------------- |
| `lib/print/box.ts`          | `BoxMm` type; `contains`, `intersects`, edge helpers |
| `lib/print/geometry.ts`     | Format specs, live area, y-down→y-up conversion      |
| `lib/print/rhythm.ts`       | The 6mm spacing scale and its predicate              |
| `lib/print/zones.ts`        | The five-zone A4 solver                              |
| `lib/print/ledger-types.ts` | `Mark`, `Ledger` and supporting unions               |
| `lib/print/ledger.ts`       | `createLedger()` builder                             |
| `lib/print/guards.ts`       | G1 safe-area, G2 collision, G3 clip, G4 degenerate   |
| `lib/print/qr-floor.ts`     | G5 rhythm, G6 QR module floor                        |

**Created — tests:**

`tests/unit/print-box.test.mjs`, `print-geometry.test.mjs`, `print-rhythm.test.mjs`, `print-zones.test.mjs`, `print-ledger.test.mjs`, `print-guards.test.mjs`, `print-qr-floor.test.mjs`; `tests/contracts/print-source-quality.test.mjs`, `tests/contracts/print-brand-lockup.test.mjs`.

**Modified:**

`config/poster-designs.json` (margin 15→18), `lib/qr/poster-brand.ts` (lockup), `lib/notifications/poster-pdf-a4-primer.ts` and `poster-pdf-a4-ledger.ts` (consume zones + ledger), `components/merchant/qr-poster/counter-kit/primer-poster.tsx`, `.github/workflows/ci.yml` (wire the orphaned verifier).

**Deferred by design:** `StampRail` / `StepRail` components and guard G8 (stamp parity) need a poster that _has_ a stamp rail — `primer` does not. They land in the posters PR. Tent and NFC format specs land in their own PRs; `PRINT_FORMATS` intentionally defines only `a4Poster` here.

---

### Task 1: Box primitives

**Files:**

- Create: `lib/print/box.ts`
- Test: `tests/unit/print-box.test.mjs`

**Interfaces:**

- Consumes: nothing
- Produces: `type BoxMm = { readonly xMm, yMm, widthMm, heightMm: number }`; `boxRight(box: BoxMm): number`; `boxBottom(box: BoxMm): number`; `contains(outer: BoxMm, inner: BoxMm): boolean`; `intersects(a: BoxMm, b: BoxMm): boolean`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-box.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { boxBottom, boxRight, contains, intersects } from "@/lib/print/box"

const outer = { xMm: 0, yMm: 0, widthMm: 100, heightMm: 100 }

test("edges are derived from origin plus extent", () => {
  assert.equal(boxRight({ xMm: 10, yMm: 5, widthMm: 20, heightMm: 8 }), 30)
  assert.equal(boxBottom({ xMm: 10, yMm: 5, widthMm: 20, heightMm: 8 }), 13)
})

test("contains accepts an inner box and rejects any overhang", () => {
  assert.equal(
    contains(outer, { xMm: 10, yMm: 10, widthMm: 10, heightMm: 10 }),
    true
  )
  assert.equal(
    contains(outer, { xMm: 95, yMm: 10, widthMm: 10, heightMm: 10 }),
    false
  )
  assert.equal(
    contains(outer, { xMm: -1, yMm: 10, widthMm: 10, heightMm: 10 }),
    false
  )
})

test("contains tolerates sub-0.05mm float noise at the edge", () => {
  assert.equal(
    contains(outer, { xMm: 0, yMm: 0, widthMm: 100.02, heightMm: 100 }),
    true
  )
})

test("intersects detects overlap but not mere edge contact", () => {
  const a = { xMm: 0, yMm: 0, widthMm: 10, heightMm: 10 }
  assert.equal(
    intersects(a, { xMm: 5, yMm: 5, widthMm: 10, heightMm: 10 }),
    true
  )
  assert.equal(
    intersects(a, { xMm: 10, yMm: 0, widthMm: 10, heightMm: 10 }),
    false
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-box`
Expected: FAIL — cannot find module `@/lib/print/box`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/print/box.ts

/** Axis-aligned box in millimetres, y measured DOWN from the trim top. */
export type BoxMm = {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

/** Sub-0.05mm differences are float noise, not layout intent. */
const EPSILON_MM = 0.05

export function boxRight(box: BoxMm): number {
  return box.xMm + box.widthMm
}

export function boxBottom(box: BoxMm): number {
  return box.yMm + box.heightMm
}

export function contains(outer: BoxMm, inner: BoxMm): boolean {
  return (
    inner.xMm >= outer.xMm - EPSILON_MM &&
    inner.yMm >= outer.yMm - EPSILON_MM &&
    boxRight(inner) <= boxRight(outer) + EPSILON_MM &&
    boxBottom(inner) <= boxBottom(outer) + EPSILON_MM
  )
}

export function intersects(a: BoxMm, b: BoxMm): boolean {
  return (
    a.xMm < boxRight(b) - EPSILON_MM &&
    boxRight(a) > b.xMm + EPSILON_MM &&
    a.yMm < boxBottom(b) - EPSILON_MM &&
    boxBottom(a) > b.yMm + EPSILON_MM
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-box` then `pnpm typecheck`
Expected: PASS, no type errors

- [ ] **Step 5: Commit**

```bash
git add lib/print/box.ts tests/unit/print-box.test.mjs
git commit -m "feat(print): box primitives in millimetre space"
```

---

### Task 2: Format geometry

**Files:**

- Create: `lib/print/geometry.ts`
- Test: `tests/unit/print-geometry.test.mjs`

**Interfaces:**

- Consumes: `BoxMm` from Task 1
- Produces: `type FormatId = "a4Poster"`; `type FormatSpec = { readonly trimWidthMm, trimHeightMm, bleedMm, marginMm: number }`; `PRINT_FORMATS: Readonly<Record<FormatId, FormatSpec>>`; `liveArea(format: FormatId): BoxMm`; `toPdfYMm(format: FormatId, yDownMm: number, heightMm: number): number`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-geometry.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { liveArea, PRINT_FORMATS, toPdfYMm } from "@/lib/print/geometry"

test("A4 poster trims to 210x297 with an 18mm margin", () => {
  assert.deepEqual(PRINT_FORMATS.a4Poster, {
    trimWidthMm: 210,
    trimHeightMm: 297,
    bleedMm: 0,
    marginMm: 18,
  })
})

test("live area insets the margin on all four edges", () => {
  assert.deepEqual(liveArea("a4Poster"), {
    xMm: 18,
    yMm: 18,
    widthMm: 174,
    heightMm: 261,
  })
})

test("toPdfYMm flips y-down layout space into y-up pdf space", () => {
  // A 14mm-tall legal zone whose top sits 265mm down the sheet.
  assert.equal(toPdfYMm("a4Poster", 265, 14), 18)
  // The top-left origin maps to the height of the sheet minus the box.
  assert.equal(toPdfYMm("a4Poster", 0, 297), 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-geometry`
Expected: FAIL — cannot find module `@/lib/print/geometry`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/print/geometry.ts
import type { BoxMm } from "./box"

/**
 * Only the A4 poster is specified here. Tent and NFC geometry land with their
 * own PRs — the tent needs a fold-safe band on the face's inner edge, which is
 * face-dependent and not worth guessing ahead of that work.
 */
export type FormatId = "a4Poster"

export type FormatSpec = {
  readonly trimWidthMm: number
  readonly trimHeightMm: number
  readonly bleedMm: number
  readonly marginMm: number
}

export const PRINT_FORMATS: Readonly<Record<FormatId, FormatSpec>> = {
  a4Poster: { trimWidthMm: 210, trimHeightMm: 297, bleedMm: 0, marginMm: 18 },
}

export function liveArea(format: FormatId): BoxMm {
  const spec = PRINT_FORMATS[format]
  return {
    xMm: spec.marginMm,
    yMm: spec.marginMm,
    widthMm: spec.trimWidthMm - spec.marginMm * 2,
    heightMm: spec.trimHeightMm - spec.marginMm * 2,
  }
}

/** Layout space is y-down from the trim top; pdf-lib is y-up from the bottom. */
export function toPdfYMm(
  format: FormatId,
  yDownMm: number,
  heightMm: number
): number {
  return PRINT_FORMATS[format].trimHeightMm - yDownMm - heightMm
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-geometry` then `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/print/geometry.ts tests/unit/print-geometry.test.mjs
git commit -m "feat(print): A4 format geometry and y-axis conversion"
```

---

### Task 3: Rhythm scale

**Files:**

- Create: `lib/print/rhythm.ts`
- Test: `tests/unit/print-rhythm.test.mjs`

**Interfaces:**

- Consumes: nothing
- Produces: `RHYTHM_BASE_MM: number`; `type RhythmGapMm = 6 | 12 | 18 | 24 | 36`; `RHYTHM_GAPS_MM: readonly RhythmGapMm[]`; `isRhythmGap(valueMm: number): boolean`

**Note:** do **not** write `[6, 12, 18, 24, 36] as const`. `as const` is an `AsExpression` and the source-quality analyser rejects it. Declare the union type explicitly.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-rhythm.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { isRhythmGap, RHYTHM_BASE_MM, RHYTHM_GAPS_MM } from "@/lib/print/rhythm"

test("the base unit derives from 12pt body at 1.4 leading", () => {
  assert.equal(RHYTHM_BASE_MM, 6)
  assert.deepEqual([...RHYTHM_GAPS_MM], [6, 12, 18, 24, 36])
})

test("every permitted gap is a multiple of the base unit", () => {
  for (const gap of RHYTHM_GAPS_MM) assert.equal(gap % RHYTHM_BASE_MM, 0)
})

test("isRhythmGap accepts scale values and rejects arbitrary ones", () => {
  assert.equal(isRhythmGap(18), true)
  assert.equal(isRhythmGap(28), false)
  assert.equal(isRhythmGap(0), false)
})

test("isRhythmGap tolerates float noise below 0.01mm", () => {
  assert.equal(isRhythmGap(18.000001), true)
  assert.equal(isRhythmGap(18.5), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-rhythm`
Expected: FAIL — cannot find module `@/lib/print/rhythm`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/print/rhythm.ts

/**
 * Derived from the locked body tier: 12pt x 1.4 leading = 16.8pt ~ 5.9mm,
 * rounded to 6mm. Every vertical gap in the kit is a multiple of this.
 */
export const RHYTHM_BASE_MM = 6

export type RhythmGapMm = 6 | 12 | 18 | 24 | 36

export const RHYTHM_GAPS_MM: readonly RhythmGapMm[] = [6, 12, 18, 24, 36]

const EPSILON_MM = 0.01

export function isRhythmGap(valueMm: number): boolean {
  return RHYTHM_GAPS_MM.some((gap) => Math.abs(gap - valueMm) < EPSILON_MM)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-rhythm` then `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/print/rhythm.ts tests/unit/print-rhythm.test.mjs
git commit -m "feat(print): 6mm vertical rhythm scale"
```

---

### Task 4: Five-zone A4 solver

**Files:**

- Create: `lib/print/zones.ts`
- Test: `tests/unit/print-zones.test.mjs`

**Interfaces:**

- Consumes: `BoxMm` (Task 1), `liveArea` (Task 2)
- Produces: `type ZoneName = "rail" | "statement" | "proof" | "action" | "legal"`; `type ZoneStack = Readonly<Record<ZoneName, BoxMm>>`; `A4_ZONES_MM` (the chrome budget); `A4_FLEXIBLE_MM: number`; `solveA4Zones(proofHeightMm: number): ZoneStack`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-zones.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { liveArea } from "@/lib/print/geometry"
import { A4_FLEXIBLE_MM, solveA4Zones } from "@/lib/print/zones"

test("the stack consumes the live area exactly, leaving no dead space", () => {
  for (const proof of [24, 32, 40]) {
    const zones = solveA4Zones(proof)
    const live = liveArea("a4Poster")
    assert.equal(
      zones.rail.yMm,
      live.yMm,
      `proof ${proof} starts at the margin`
    )
    assert.equal(
      zones.legal.yMm + zones.legal.heightMm,
      live.yMm + live.heightMm,
      `proof ${proof} ends exactly at the bottom margin`
    )
  }
})

test("STATEMENT absorbs all slack so PROOF never leaves a gap", () => {
  assert.equal(solveA4Zones(24).statement.heightMm, A4_FLEXIBLE_MM - 24)
  assert.equal(solveA4Zones(40).statement.heightMm, A4_FLEXIBLE_MM - 40)
})

test("ACTION is reserved at 64mm regardless of PROOF", () => {
  assert.equal(solveA4Zones(24).action.heightMm, 64)
  assert.equal(solveA4Zones(40).action.heightMm, 64)
})

test("zones stack top to bottom in reading order", () => {
  const z = solveA4Zones(30)
  const order = [z.rail, z.statement, z.proof, z.action, z.legal]
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(
      order[i].yMm > order[i - 1].yMm,
      `zone ${i} follows zone ${i - 1}`
    )
  }
})

test("PROOF outside 24-40mm is a programming error", () => {
  assert.throws(() => solveA4Zones(23), /outside/)
  assert.throws(() => solveA4Zones(41), /outside/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-zones`
Expected: FAIL — cannot find module `@/lib/print/zones`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/print/zones.ts
import type { BoxMm } from "./box"
import { liveArea } from "./geometry"

export type ZoneName = "rail" | "statement" | "proof" | "action" | "legal"

export type ZoneStack = Readonly<Record<ZoneName, BoxMm>>

/**
 * Fixed chrome totals 182mm of the 297mm sheet (including both margins),
 * leaving 115mm shared between STATEMENT and PROOF. Because the sheet is
 * fully allocated, no space can pool into a dead band.
 */
export const A4_ZONES_MM = {
  railHeight: 8,
  railToStatement: 12,
  statementToProof: 18,
  proofToAction: 18,
  actionHeight: 64,
  actionToLegal: 12,
  legalHeight: 14,
  proofMinHeight: 24,
  proofMaxHeight: 40,
}

export const A4_FLEXIBLE_MM = 115

export function solveA4Zones(proofHeightMm: number): ZoneStack {
  if (
    proofHeightMm < A4_ZONES_MM.proofMinHeight ||
    proofHeightMm > A4_ZONES_MM.proofMaxHeight
  ) {
    throw new Error(
      `PROOF height ${proofHeightMm}mm is outside ${A4_ZONES_MM.proofMinHeight}-${A4_ZONES_MM.proofMaxHeight}mm`
    )
  }
  const live = liveArea("a4Poster")
  const band = (yMm: number, heightMm: number): BoxMm => ({
    xMm: live.xMm,
    yMm,
    widthMm: live.widthMm,
    heightMm,
  })

  const railY = live.yMm
  const statementY =
    railY + A4_ZONES_MM.railHeight + A4_ZONES_MM.railToStatement
  const statementHeight = A4_FLEXIBLE_MM - proofHeightMm
  const proofY = statementY + statementHeight + A4_ZONES_MM.statementToProof
  const actionY = proofY + proofHeightMm + A4_ZONES_MM.proofToAction
  const legalY = actionY + A4_ZONES_MM.actionHeight + A4_ZONES_MM.actionToLegal

  return {
    rail: band(railY, A4_ZONES_MM.railHeight),
    statement: band(statementY, statementHeight),
    proof: band(proofY, proofHeightMm),
    action: band(actionY, A4_ZONES_MM.actionHeight),
    legal: band(legalY, A4_ZONES_MM.legalHeight),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-zones` then `pnpm typecheck`
Expected: PASS — in particular the "consumes the live area exactly" case, which is the arithmetic proof that dead bands are impossible

- [ ] **Step 5: Commit**

```bash
git add lib/print/zones.ts tests/unit/print-zones.test.mjs
git commit -m "feat(print): five-zone A4 solver with reserved action band"
```

---

### Task 5: Layout ledger

**Files:**

- Create: `lib/print/ledger-types.ts`, `lib/print/ledger.ts`
- Test: `tests/unit/print-ledger.test.mjs`

**Interfaces:**

- Consumes: `BoxMm` (Task 1)
- Produces:
  - `type MarkKind = "text" | "rule" | "shape" | "qr" | "image"`
  - `type MarkRole = "content" | "decoration" | "chrome"`
  - `type Mark = { readonly kind: MarkKind; readonly role: MarkRole; readonly box: BoxMm; readonly container: string; readonly label: string; readonly clipTo?: string; readonly overlaps?: readonly string[] }`
  - `type Ledger = { readonly marks: readonly Mark[]; readonly containers: ReadonlyMap<string, BoxMm> }`
  - `type LedgerBuilder = { defineContainer(name: string, box: BoxMm): void; add(mark: Mark): void; snapshot(): Ledger }`
  - `createLedger(): LedgerBuilder`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-ledger.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { createLedger } from "@/lib/print/ledger"

const box = { xMm: 0, yMm: 0, widthMm: 10, heightMm: 10 }

test("a snapshot captures containers and marks in insertion order", () => {
  const ledger = createLedger()
  ledger.defineContainer("sheet", {
    xMm: 0,
    yMm: 0,
    widthMm: 210,
    heightMm: 297,
  })
  ledger.add({
    kind: "text",
    role: "content",
    box,
    container: "sheet",
    label: "headline",
  })
  ledger.add({
    kind: "rule",
    role: "chrome",
    box,
    container: "sheet",
    label: "masthead",
  })

  const snapshot = ledger.snapshot()
  assert.deepEqual(
    snapshot.marks.map((mark) => mark.label),
    ["headline", "masthead"]
  )
  assert.equal(snapshot.containers.get("sheet").widthMm, 210)
})

test("a snapshot is immutable against later writes", () => {
  const ledger = createLedger()
  ledger.defineContainer("sheet", box)
  const snapshot = ledger.snapshot()
  ledger.add({
    kind: "text",
    role: "content",
    box,
    container: "sheet",
    label: "late",
  })
  assert.equal(snapshot.marks.length, 0)
})

test("redefining a container is a programming error", () => {
  const ledger = createLedger()
  ledger.defineContainer("sheet", box)
  assert.throws(() => ledger.defineContainer("sheet", box), /already defined/)
})

test("marks must name a container that exists", () => {
  const ledger = createLedger()
  assert.throws(
    () =>
      ledger.add({
        kind: "text",
        role: "content",
        box,
        container: "ghost",
        label: "x",
      }),
    /unknown container/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-ledger`
Expected: FAIL — cannot find module `@/lib/print/ledger`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/print/ledger-types.ts
import type { BoxMm } from "./box"

export type MarkKind = "text" | "rule" | "shape" | "qr" | "image"

/** `decoration` marks must declare `clipTo`; guard G3 enforces it. */
export type MarkRole = "content" | "decoration" | "chrome"

export type Mark = {
  readonly kind: MarkKind
  readonly role: MarkRole
  readonly box: BoxMm
  readonly container: string
  readonly label: string
  readonly clipTo?: string
  /** Labels this mark is permitted to intersect, e.g. a chip's background. */
  readonly overlaps?: readonly string[]
}

export type Ledger = {
  readonly marks: readonly Mark[]
  readonly containers: ReadonlyMap<string, BoxMm>
}
```

```ts
// lib/print/ledger.ts
import type { BoxMm } from "./box"
import type { Ledger, Mark } from "./ledger-types"

export type LedgerBuilder = {
  defineContainer(name: string, box: BoxMm): void
  add(mark: Mark): void
  snapshot(): Ledger
}

export function createLedger(): LedgerBuilder {
  const marks: Mark[] = []
  const containers = new Map<string, BoxMm>()

  return {
    defineContainer(name, box) {
      if (containers.has(name)) {
        throw new Error(`Container ${name} is already defined`)
      }
      containers.set(name, box)
    },
    add(mark) {
      if (!containers.has(mark.container)) {
        throw new Error(
          `Mark ${mark.label} names unknown container ${mark.container}`
        )
      }
      marks.push(mark)
    },
    snapshot() {
      return { marks: [...marks], containers: new Map(containers) }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-ledger` then `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/print/ledger-types.ts lib/print/ledger.ts tests/unit/print-ledger.test.mjs
git commit -m "feat(print): layout ledger recording every placed mark"
```

---

### Task 6: Guards G1–G4

**Files:**

- Create: `lib/print/guards.ts`
- Test: `tests/unit/print-guards.test.mjs`

**Interfaces:**

- Consumes: `contains`, `intersects` (Task 1), `Ledger`, `Mark` (Task 5)
- Produces: `type GuardViolation = { readonly guard: string; readonly detail: string }`; `checkSafeArea(ledger: Ledger): GuardViolation[]`; `checkCollisions(ledger: Ledger): GuardViolation[]`; `checkClips(ledger: Ledger): GuardViolation[]`; `checkDegenerate(ledger: Ledger): GuardViolation[]`; `checkLedger(ledger: Ledger): GuardViolation[]`

Each guard maps to audited defects: G1 container overflow, G2 → defects #1, #2, #5, #17, G3 → #9, #10, #15, #16, G4 → #3, #4.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-guards.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { createLedger } from "@/lib/print/ledger"
import {
  checkClips,
  checkCollisions,
  checkDegenerate,
  checkLedger,
  checkSafeArea,
} from "@/lib/print/guards"

function ledgerWith(marks) {
  const ledger = createLedger()
  ledger.defineContainer("sheet", {
    xMm: 0,
    yMm: 0,
    widthMm: 100,
    heightMm: 100,
  })
  for (const mark of marks) ledger.add(mark)
  return ledger.snapshot()
}

const at = (xMm, yMm, widthMm, heightMm) => ({ xMm, yMm, widthMm, heightMm })

test("G1 flags a mark that escapes its container", () => {
  const ok = ledgerWith([
    {
      kind: "text",
      role: "content",
      box: at(10, 10, 20, 5),
      container: "sheet",
      label: "in",
    },
  ])
  assert.deepEqual(checkSafeArea(ok), [])

  const bad = ledgerWith([
    {
      kind: "text",
      role: "content",
      box: at(90, 10, 20, 5),
      container: "sheet",
      label: "out",
    },
  ])
  assert.equal(checkSafeArea(bad).length, 1)
  assert.match(checkSafeArea(bad)[0].detail, /out/)
})

test("G2 flags a rule crossing a text run — the primer defect", () => {
  const bad = ledgerWith([
    {
      kind: "text",
      role: "content",
      box: at(10, 20, 50, 5),
      container: "sheet",
      label: "detail",
    },
    {
      kind: "rule",
      role: "chrome",
      box: at(10, 22, 50, 0.5),
      container: "sheet",
      label: "separator",
    },
  ])
  const violations = checkCollisions(bad)
  assert.equal(violations.length, 1)
  assert.match(violations[0].detail, /detail/)
  assert.match(violations[0].detail, /separator/)
})

test("G2 permits an intersection the text explicitly opts into", () => {
  const ok = ledgerWith([
    {
      kind: "shape",
      role: "chrome",
      box: at(10, 20, 30, 8),
      container: "sheet",
      label: "chip-bg",
    },
    {
      kind: "text",
      role: "content",
      box: at(12, 22, 20, 4),
      container: "sheet",
      label: "chip-label",
      overlaps: ["chip-bg"],
    },
  ])
  assert.deepEqual(checkCollisions(ok), [])
})

test("G3 requires decorations to declare and stay inside a clip container", () => {
  const undeclared = ledgerWith([
    {
      kind: "shape",
      role: "decoration",
      box: at(10, 10, 5, 5),
      container: "sheet",
      label: "circle",
    },
  ])
  assert.match(checkClips(undeclared)[0].detail, /clipTo/)

  const escaping = ledgerWith([
    {
      kind: "shape",
      role: "decoration",
      box: at(95, 10, 20, 5),
      container: "sheet",
      label: "bunting",
      clipTo: "sheet",
    },
  ])
  assert.match(checkClips(escaping)[0].detail, /bunting/)
})

test("G4 flags zero-area shapes — the seal empty-box defect", () => {
  const bad = ledgerWith([
    {
      kind: "shape",
      role: "chrome",
      box: at(10, 10, 0, 5),
      container: "sheet",
      label: "redaction",
    },
  ])
  assert.equal(checkDegenerate(bad).length, 1)
})

test("checkLedger aggregates every guard", () => {
  const bad = ledgerWith([
    {
      kind: "shape",
      role: "decoration",
      box: at(10, 10, 0, 5),
      container: "sheet",
      label: "ghost",
    },
  ])
  const guards = new Set(checkLedger(bad).map((violation) => violation.guard))
  assert.deepEqual([...guards].sort(), ["G3-clip", "G4-degenerate"])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-guards`
Expected: FAIL — cannot find module `@/lib/print/guards`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/print/guards.ts
import { contains, intersects } from "./box"
import type { Ledger, Mark } from "./ledger-types"

export type GuardViolation = {
  readonly guard: string
  readonly detail: string
}

const MIN_AREA_MM2 = 0.01

function containerBoxOf(ledger: Ledger, name: string) {
  const box = ledger.containers.get(name)
  if (!box) throw new Error(`Unknown container ${name}`)
  return box
}

/** G1 — every mark stays inside the container it belongs to. */
export function checkSafeArea(ledger: Ledger): GuardViolation[] {
  return ledger.marks
    .filter(
      (mark) => !contains(containerBoxOf(ledger, mark.container), mark.box)
    )
    .map((mark) => ({
      guard: "G1-safe-area",
      detail: `${mark.label} escapes container ${mark.container}`,
    }))
}

function mayOverlap(text: Mark, other: Mark): boolean {
  return (text.overlaps ?? []).includes(other.label)
}

/** G2 — no text run is crossed by a rule or shape it did not opt into. */
export function checkCollisions(ledger: Ledger): GuardViolation[] {
  const texts = ledger.marks.filter((mark) => mark.kind === "text")
  const blockers = ledger.marks.filter(
    (mark) => mark.kind === "rule" || mark.kind === "shape"
  )
  const violations: GuardViolation[] = []
  for (const text of texts) {
    for (const blocker of blockers) {
      if (mayOverlap(text, blocker)) continue
      if (!intersects(text.box, blocker.box)) continue
      violations.push({
        guard: "G2-collision",
        detail: `${blocker.label} crosses text ${text.label}`,
      })
    }
  }
  return violations
}

/** G3 — decorations declare a clip container and stay inside it. */
export function checkClips(ledger: Ledger): GuardViolation[] {
  return ledger.marks
    .filter((mark) => mark.role === "decoration")
    .flatMap((mark) => {
      if (!mark.clipTo) {
        return [{ guard: "G3-clip", detail: `${mark.label} has no clipTo` }]
      }
      if (contains(containerBoxOf(ledger, mark.clipTo), mark.box)) return []
      return [
        {
          guard: "G3-clip",
          detail: `${mark.label} escapes clip ${mark.clipTo}`,
        },
      ]
    })
}

/** G4 — no zero-area marks, which render as empty boxes or stray fragments. */
export function checkDegenerate(ledger: Ledger): GuardViolation[] {
  return ledger.marks
    .filter((mark) => mark.box.widthMm * mark.box.heightMm < MIN_AREA_MM2)
    .map((mark) => ({
      guard: "G4-degenerate",
      detail: `${mark.label} has no drawable area`,
    }))
}

export function checkLedger(ledger: Ledger): GuardViolation[] {
  return [
    ...checkSafeArea(ledger),
    ...checkCollisions(ledger),
    ...checkClips(ledger),
    ...checkDegenerate(ledger),
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-guards` then `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/print/guards.ts tests/unit/print-guards.test.mjs
git commit -m "feat(print): safe-area, collision, clip and degenerate guards"
```

---

### Task 7: Rhythm and QR-floor guards

**Files:**

- Create: `lib/print/qr-floor.ts`
- Test: `tests/unit/print-qr-floor.test.mjs`

**Interfaces:**

- Consumes: `GuardViolation` (Task 6), `isRhythmGap` (Task 3), `ZoneStack` (Task 4)
- Produces: `QR_MODULE_FLOOR_MM: number`; `qrModuleSizeMm(outerMm: number, modules: number, quietZoneModules: number): number`; `checkQrFloor(...): GuardViolation[]`; `checkZoneRhythm(zones: ZoneStack): GuardViolation[]`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-qr-floor.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { solveA4Zones } from "@/lib/print/zones"
import {
  checkQrFloor,
  checkZoneRhythm,
  qrModuleSizeMm,
  QR_MODULE_FLOOR_MM,
} from "@/lib/print/qr-floor"

test("module size divides the outer box by modules plus both quiet zones", () => {
  // 54mm poster QR, 41 modules at EC-H, 4-module quiet zone per side.
  assert.equal(qrModuleSizeMm(54, 41, 4).toFixed(3), "1.102")
})

test("G6 passes the poster and fails the current NFC card", () => {
  assert.equal(QR_MODULE_FLOOR_MM, 0.5)
  assert.deepEqual(checkQrFloor(54, 41, 4, "poster"), [])
  const violations = checkQrFloor(18, 41, 4, "nfc-card")
  assert.equal(violations.length, 1)
  assert.match(violations[0].detail, /nfc-card/)
})

test("G5 accepts the solved zone stack at every legal PROOF height", () => {
  for (const proof of [24, 30, 36, 40]) {
    assert.deepEqual(checkZoneRhythm(solveA4Zones(proof)), [], `proof ${proof}`)
  }
})

test("G5 flags a stack whose gaps are off the scale", () => {
  const zones = solveA4Zones(30)
  const nudged = {
    ...zones,
    proof: { ...zones.proof, yMm: zones.proof.yMm + 1 },
  }
  assert.ok(checkZoneRhythm(nudged).length > 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-qr-floor`
Expected: FAIL — cannot find module `@/lib/print/qr-floor`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/print/qr-floor.ts
import type { GuardViolation } from "./guards"
import { isRhythmGap } from "./rhythm"
import type { ZoneName, ZoneStack } from "./zones"

/** Below this, consumer printing and phone cameras stop being reliable. */
export const QR_MODULE_FLOOR_MM = 0.5

export function qrModuleSizeMm(
  outerMm: number,
  modules: number,
  quietZoneModules: number
): number {
  return outerMm / (modules + quietZoneModules * 2)
}

/** G6 — the printed module never drops below the scan floor. */
export function checkQrFloor(
  outerMm: number,
  modules: number,
  quietZoneModules: number,
  label: string
): GuardViolation[] {
  const size = qrModuleSizeMm(outerMm, modules, quietZoneModules)
  if (size >= QR_MODULE_FLOOR_MM) return []
  return [
    {
      guard: "G6-qr-floor",
      detail: `${label} module ${size.toFixed(3)}mm is below ${QR_MODULE_FLOOR_MM}mm`,
    },
  ]
}

const ZONE_ORDER: readonly ZoneName[] = [
  "rail",
  "statement",
  "proof",
  "action",
  "legal",
]

/** G5 — every inter-zone gap sits on the 6mm rhythm scale. */
export function checkZoneRhythm(zones: ZoneStack): GuardViolation[] {
  const violations: GuardViolation[] = []
  for (let index = 1; index < ZONE_ORDER.length; index += 1) {
    const previous = zones[ZONE_ORDER[index - 1]]
    const current = zones[ZONE_ORDER[index]]
    const gap = current.yMm - (previous.yMm + previous.heightMm)
    if (isRhythmGap(gap)) continue
    violations.push({
      guard: "G5-rhythm",
      detail: `gap ${gap.toFixed(2)}mm before ${ZONE_ORDER[index]} is off the scale`,
    })
  }
  return violations
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-qr-floor` then `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/print/qr-floor.ts tests/unit/print-qr-floor.test.mjs
git commit -m "feat(print): rhythm and QR module-floor guards"
```

---

### Task 8: Source-quality contract for `lib/print/`

**Files:**

- Create: `tests/contracts/print-source-quality.test.mjs`

**Interfaces:**

- Consumes: `analyseTypeScript`, `walkSourceFiles` from `tests/support/poster-source-analysis.mjs`
- Produces: nothing (a guard test)

**Note:** contract tests run **without** the `@/` alias loader. Use `path.join(process.cwd(), ...)`.

- [ ] **Step 1: Write the failing test**

```js
// tests/contracts/print-source-quality.test.mjs
import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"

import {
  analyseTypeScript,
  walkSourceFiles,
} from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()
const printDirectory = path.join(projectRoot, "lib", "print")

test("print layout modules stay small and assertion-free", () => {
  const files = walkSourceFiles(printDirectory, (file) => file.endsWith(".ts"))
  assert.ok(
    files.length >= 8,
    `expected the full module set, saw ${files.length}`
  )
  for (const file of files) {
    assert.deepEqual(
      analyseTypeScript(file),
      [],
      path.relative(projectRoot, file)
    )
  }
})

test("the print layer stays pure — no renderer imports", () => {
  const files = walkSourceFiles(printDirectory, (file) => file.endsWith(".ts"))
  for (const file of files) {
    const source = require("node:fs").readFileSync(file, "utf8")
    assert.doesNotMatch(
      source,
      /from "pdf-lib"/,
      path.relative(projectRoot, file)
    )
    assert.doesNotMatch(
      source,
      /from "react"/,
      path.relative(projectRoot, file)
    )
  }
})
```

- [ ] **Step 2: Run test to verify it passes immediately**

Run: `pnpm test:contracts 2>&1 | grep -A3 print-source-quality`
Expected: PASS. This guard is written after the modules it guards, so it should be green on first run. If it is red, the fault is in Tasks 1–7 — fix the flagged file rather than relaxing the contract.

- [ ] **Step 3: Prove the contract actually bites**

Temporarily append `export const broken = 1 as number` to `lib/print/box.ts`, re-run, and confirm it reports `as assertion`. Then revert:

```bash
git checkout lib/print/box.ts
```

- [ ] **Step 4: Re-run to confirm green after revert**

Run: `pnpm test:contracts 2>&1 | grep -A3 print-source-quality`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/contracts/print-source-quality.test.mjs
git commit -m "test(print): pin layout modules to the source-quality budget"
```

---

### Task 9: Brand lockup — guard G7

**Files:**

- Modify: `lib/qr/poster-brand.ts`
- Modify: `config/poster-designs.json`, `config/table-tent-designs.json`, `config/nfc-card-designs.json`, `config/nfc-square-designs.json`
- Create: `tests/contracts/print-brand-lockup.test.mjs`

**Interfaces:**

- Consumes: nothing
- Produces: `POSTER_BRAND_WORDMARK_PDF` keeps its `{ lead, accent, tail }` shape so existing call sites in `lib/notifications/poster-pdf-kit-brand.ts` continue to compile — only the values change.

- [ ] **Step 1: Write the failing test**

```js
// tests/contracts/print-brand-lockup.test.mjs
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()
const BANNED = [/Nab a Perks/, /NAB A PERKS/, /NABAPERKS/]

test("no print catalogue carries a non-canonical lockup", () => {
  const configDir = path.join(projectRoot, "config")
  const catalogues = readdirSync(configDir).filter((name) =>
    /(poster|table-tent|nfc-card|nfc-square)-designs\.json$/.test(name)
  )
  assert.equal(catalogues.length, 4)
  for (const name of catalogues) {
    const source = readFileSync(path.join(configDir, name), "utf8")
    for (const pattern of BANNED) {
      assert.doesNotMatch(source, pattern, `${name} carries ${pattern}`)
    }
  }
})

test("the PDF wordmark spells the canonical brand", () => {
  const source = readFileSync(
    path.join(projectRoot, "lib", "qr", "poster-brand.ts"),
    "utf8"
  )
  const lead = /lead:\s*"([^"]*)"/.exec(source)
  const accent = /accent:\s*"([^"]*)"/.exec(source)
  const tail = /tail:\s*"([^"]*)"/.exec(source)
  assert.ok(lead && accent && tail, "wordmark segments are declared")
  assert.equal(`${lead[1]}${accent[1]}${tail[1]}`, "Nabaperks")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:contracts 2>&1 | grep -A5 print-brand-lockup`
Expected: FAIL on both cases — catalogues carry `Nab a Perks`, and the wordmark concatenates to `NAB A PERKS`

- [ ] **Step 3: Fix the lockup**

```ts
// lib/qr/poster-brand.ts
type PosterBrandWordmarkPdf = {
  readonly lead: string
  readonly accent: string
  readonly tail: string
}

/** Canonical lockup, accent on the middle `a`. Segments concatenate to "Nabaperks". */
export const POSTER_BRAND_WORDMARK_PDF: PosterBrandWordmarkPdf = {
  lead: "Nab",
  accent: "a",
  tail: "perks",
}
```

Then replace every `"Nab a Perks"` value in the four catalogues with `"Nabaperks"`:

```bash
sed -i '' 's/"Nab a Perks"/"Nabaperks"/g' config/poster-designs.json config/table-tent-designs.json config/nfc-card-designs.json config/nfc-square-designs.json
```

- [ ] **Step 4: Run the full suite**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. The wordmark previously rendered in uppercase mono; if a renderer uppercases it, the visual result is now `NABAPERKS` as one word, which is correct. Any catalogue-parity test that pinned the old string must be updated to the canonical spelling, not reverted.

- [ ] **Step 5: Commit**

```bash
git add lib/qr/poster-brand.ts config/*-designs.json tests/contracts/print-brand-lockup.test.mjs
git commit -m "fix(print): single canonical Nabaperks lockup across the kit"
```

---

### Task 10: Catalogue margin 15mm → 18mm

**Files:**

- Modify: `config/poster-designs.json` (`shared.geometry.a4.safeMarginMm`)

**Interfaces:**

- Consumes: nothing
- Produces: `assertPosterLayoutGeometry` in `scripts/verify-poster-pdfs.mjs` reads this value, so the existing verifier follows the new margin with no code change.

- [ ] **Step 1: Record the current verifier result as the baseline**

Run: `pnpm posters:verify-pdfs output/posters/barley-mow-7b42442a__barley-mow`
Expected: `Verified 8 poster PDFs and 8 QR faces` — the pre-change green

- [ ] **Step 2: Raise the margin**

In `config/poster-designs.json`, change `shared.geometry.a4.safeMarginMm` from `15` to `18`.

- [ ] **Step 3: Re-run the verifier against the stale export**

Run: `pnpm posters:verify-pdfs output/posters/barley-mow-7b42442a__barley-mow`
Expected: **FAIL** with a `safe frame` error. The shipped PDFs were laid out at 15mm, so an 18mm frame must reject them. A pass here means the verifier is not reading the catalogue and must be fixed before continuing.

- [ ] **Step 4: Re-export and confirm the failure is real, not tooling**

The export does **not** clean stale PDFs, so clear the directory first:

```bash
rm -rf output/posters && pnpm posters:export-production
pnpm posters:verify-pdfs output/posters/barley-mow-7b42442a__barley-mow
```

Expected: still FAIL for the seven posters not yet re-laid. That is correct and expected — Task 11 re-lays `primer`, and the remaining seven are the posters PR. Record which designs fail so the posters PR has a worklist.

- [ ] **Step 5: Commit**

```bash
git add config/poster-designs.json
git commit -m "feat(print): raise A4 safe margin to 18mm"
```

---

### Task 11: Re-lay the `primer` PDF on zones and the ledger

**Files:**

- Modify: `lib/notifications/poster-pdf-a4-primer.ts`
- Test: `tests/unit/poster-primer-layout.test.mjs`

**Interfaces:**

- Consumes: `solveA4Zones` (Task 4), `createLedger` (Task 5), `checkLedger` (Task 6), `checkZoneRhythm` (Task 7), `toPdfYMm` (Task 2)
- Produces: `drawPrimerA4` keeps its existing signature `(context: PosterPdfBaseContext, content: PrimerPosterContent) => void`; adds `primerLedger(content: PrimerPosterContent): Ledger` so the layout can be asserted without rendering.

**Root cause being fixed.** In the current file:

```ts
const detailDrop = titleDrop + bodyLeading(POSTER_PDF_TYPE.bodyPt)
const ruleY = y - rowHeight + mm(3)
```

`ruleY` is computed from `rowHeight` while the detail baseline is computed from
`detailDrop`. The two are unrelated, so when `rowHeight` compresses the rule
lands on top of the detail text — defect #1. On the final clause the 2.2pt solid
rule does the same thing — defect #2. The fix is to derive the rule position from
the measured bottom of the text it follows, and to prove it with G2.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/poster-primer-layout.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { resolvePosterContent } from "@/lib/qr/poster-content"
import { checkLedger } from "@/lib/print/guards"
import { checkZoneRhythm } from "@/lib/print/qr-floor"
import {
  primerLedger,
  primerZones,
} from "@/lib/notifications/poster-pdf-a4-primer"

const content = resolvePosterContent("primer", 3)

test("the primer layout raises no guard violations", () => {
  assert.deepEqual(checkLedger(primerLedger(content)), [])
})

test("the primer zone stack sits on the rhythm scale", () => {
  assert.deepEqual(checkZoneRhythm(primerZones(content)), [])
})

test("no clause rule overlaps its own detail text", () => {
  const ledger = primerLedger(content)
  const details = ledger.marks.filter((mark) =>
    mark.label.startsWith("clause-detail-")
  )
  const rules = ledger.marks.filter((mark) =>
    mark.label.startsWith("clause-rule-")
  )
  assert.ok(details.length >= 4, "every clause records its detail run")
  assert.equal(details.length, rules.length)
  for (const detail of details) {
    const index = detail.label.replace("clause-detail-", "")
    const rule = rules.find((mark) => mark.label === `clause-rule-${index}`)
    assert.ok(
      rule.box.yMm >= detail.box.yMm + detail.box.heightMm,
      `rule ${index} sits below its detail text`
    )
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A5 poster-primer-layout`
Expected: FAIL — `primerLedger` and `primerZones` are not exported yet

- [ ] **Step 3: Implement the layout split**

Split the file so it stays under 250 lines: put the pure layout in a new
`lib/notifications/poster-pdf-a4-primer-layout.ts` and keep painting in
`poster-pdf-a4-primer.ts`, re-exporting `primerLedger` / `primerZones`.

The layout module computes, in y-down mm:

1. `primerZones(content)` → `solveA4Zones(proofHeightMm)` where `proofHeightMm`
   is the measured height of the clause block, clamped into 24–40mm.
2. For each clause, in order: a title run, then a detail run whose height is
   `lineCount * bodyLeading(bodyPt)` converted to mm, then the separator rule
   positioned at `detailBottomMm + RHYTHM_BASE_MM`. Deriving the rule from the
   measured detail bottom is the fix for defects #1 and #2.
3. Every mark is added to the ledger with `container: "proof"` and labels
   `clause-title-N`, `clause-detail-N`, `clause-rule-N`.
4. The exercise-book feint lines are `role: "decoration"` with
   `clipTo: "statement"` so G3 keeps them off the clause block entirely — they
   are what made the rows unreadable.

The painter then walks `primerLedger(content).marks` and draws each one,
converting with `toPdfYMm("a4Poster", mark.box.yMm, mark.box.heightMm)`.

- [ ] **Step 4: Run the tests and re-verify the PDF**

```bash
pnpm test:unit 2>&1 | grep -A5 poster-primer-layout
pnpm typecheck
rm -rf output/posters && pnpm posters:export-production
pnpm posters:verify-pdfs output/posters/barley-mow-7b42442a__barley-mow
```

Expected: unit tests PASS; the verifier now passes `primer` at the 18mm frame.
Then render and look at it — the guards prove geometry, not taste:

```bash
pdftoppm -png -r 150 output/posters/barley-mow-7b42442a__barley-mow/nabaperks-poster-primer.pdf /tmp/primer
```

Confirm by eye that no rule crosses any clause text.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/poster-pdf-a4-primer.ts lib/notifications/poster-pdf-a4-primer-layout.ts tests/unit/poster-primer-layout.test.mjs
git commit -m "fix(print): re-lay primer on the zone solver, ending rule-on-text collisions"
```

---

### Task 12: Preview parity and CI wiring

**Files:**

- Modify: `components/merchant/qr-poster/counter-kit/primer-poster.tsx`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/unit/poster-primer-parity.test.mjs`

**Interfaces:**

- Consumes: `primerLedger` (Task 11)
- Produces: nothing further

- [ ] **Step 1: Write the failing parity test**

```js
// tests/unit/poster-primer-parity.test.mjs
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { resolvePosterContent } from "@/lib/qr/poster-content"
import { primerLedger } from "@/lib/notifications/poster-pdf-a4-primer"

test("the preview consumes the shared layout rather than duplicating it", () => {
  const source = readFileSync(
    path.join(
      process.cwd(),
      "components/merchant/qr-poster/counter-kit/primer-poster.tsx"
    ),
    "utf8"
  )
  assert.match(source, /primerLedger/, "preview reads the shared ledger")
})

test("every clause in the model reaches the ledger", () => {
  const content = resolvePosterContent("primer", 3)
  const ledger = primerLedger(content)
  const titles = ledger.marks.filter((mark) =>
    mark.label.startsWith("clause-title-")
  )
  assert.equal(titles.length, content.clauses.length)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A5 poster-primer-parity`
Expected: FAIL — the preview does not reference `primerLedger`

- [ ] **Step 3: Point the preview at the shared layout**

Rewrite `primer-poster.tsx` to map over `primerLedger(content).marks`, positioning each mark with absolute `mm` CSS derived from `mark.box`. The component must not compute any of its own y positions.

**Tailwind caveat:** this project silently drops Tailwind classes that are added after the initial scan. Use inline `style={{ top: \`${mark.box.yMm}mm\` }}` for the computed positions rather than new utility classes.

- [ ] **Step 4: Wire the orphaned verifier into CI**

In `.github/workflows/ci.yml`, add a step to the job that already runs `pnpm test`, after the export step:

```yaml
- name: Verify poster PDF geometry
  run: pnpm posters:verify-pdfs output/posters/barley-mow-7b42442a__barley-mow
```

Then run the full local suite:

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: PASS.

**Do not run Playwright with `--update-snapshots`.** Visual baselines for `primer` will now be stale. Push the branch and bless the `-linux` twins from the CI artifacts, per `visual-baseline-linux-twin-refresh`.

- [ ] **Step 5: Commit**

```bash
git add components/merchant/qr-poster/counter-kit/primer-poster.tsx .github/workflows/ci.yml tests/unit/poster-primer-parity.test.mjs
git commit -m "feat(print): preview reads the shared layout; wire PDF verifier into CI"
```

---

## Self-Review

**Spec coverage.** Geometry → Task 2. Rhythm → Task 3. Zones → Task 4. Layout ledger → Task 5. Guards G1–G4 → Task 6. G5, G6 → Task 7. G7 → Task 9. Shared layout module → Tasks 1–7, consumed in 11–12. CI wiring for the orphaned verifier → Task 12. Margin change → Task 10. Defects #1 and #2 → Task 11.

**Deliberately deferred, with reasons:** G8 stamp parity and the `StampRail` / `StepRail` components need a poster that has a stamp rail; `primer` does not, so they land in the posters PR. `QrBlock`, `VenueLockup` and `LegalLine` are shared components whose first _second_ consumer appears in the posters PR — extracting them from a single caller now would be speculative. Tent and NFC format specs land with their own PRs.

**Spec correction found while planning.** The spec's tent live area of 112.5mm does not reconcile: 148.5 − 12 (outer margin) − 10 (fold-safe band) = 126.5mm. The tents PR must resolve this before defining `a4TentFace`.

**Type consistency.** `BoxMm` field names (`xMm`, `yMm`, `widthMm`, `heightMm`) are identical across Tasks 1, 2, 4, 5, 6, 7. `GuardViolation` is defined once in Task 6 and imported by Task 7. `Mark.label` is the join key used by G2's `overlaps`, G3's `clipTo` and Task 11's assertions.

**No placeholders.** Every code step carries the actual implementation. Task 11's step 3 is the one prose-described step; it is a described refactor of code quoted in full at the top of that task, with the fix stated as an explicit rule (derive the rule position from the measured detail bottom).
