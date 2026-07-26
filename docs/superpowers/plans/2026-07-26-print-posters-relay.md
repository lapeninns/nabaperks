# Posters Re-lay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the remaining seven A4 posters onto the shared print layout system, raise the A4 safe margin to 18mm across all four pinned locations, and land the `StampRail` / `StepRail` components with guard G8 — clearing eleven audited defects.

**Architecture:** PR 1 built `lib/print/` (geometry, rhythm, five-zone solver, text metrics, layout ledger, guards G1–G7) and proved it on `primer`. This PR applies the same pattern to the other seven sheets: a pure `*-layout.ts` module per design that measures with real font metrics and emits a ledger, and a painter that draws from it.

**Tech Stack:** TypeScript (strict), pdf-lib, React/CSS modules, `node:test`.

**Source spec:** `docs/superpowers/specs/2026-07-26-print-kit-design-system-design.md`
**Predecessor:** `docs/superpowers/plans/2026-07-26-print-design-system-foundation.md`

## Global Constraints

Everything from the foundation plan still applies. Repeated because they bite:

- **Every `.ts`/`.tsx` file must be under 250 lines** (`analyseTypeScript` fails at 250).
- **Banned:** `any`, `as` (**including `as const`**), `<T>x`, `!`.
- **Unit tests** get the `@/` alias; **contract tests do not** — use `process.cwd()`.
- **Copy is catalogue-owned.** `poster-render-ownership` forbids approved copy (≥18 chars) in renderer source.
- **`lib/print/` is y-down from the trim top**; pdf-lib is y-up. Convert only at the paint boundary.
- **Canonical brand is `Nabaperks`.** Guard G7 enforces it; `drawKitWordmark` applies casing at draw time and must not regain an inline literal.
- **Never run Playwright with `--update-snapshots` locally.** Bless `-linux` twins from CI artifacts.
- **The poster export does not clean stale files** — `rm -rf output/posters` before re-exporting.
- **Zone budget:** fixed chrome 160mm, `A4_FLEXIBLE_MM` 137mm shared by STATEMENT and PROOF, ACTION reserved at 60mm, PROOF band 24–93mm, STATEMENT floored at 44mm.

## Risk: concurrent duplex-folder work

**Read this before starting.** While PR 1 was in flight, separate work landed in the tree:

- `lib/qr/poster-duplex-pairs.ts` (untracked at the time; contains an `as` assertion that fails `poster-source-quality`, and a type-comparison error that fails `tsc`)
- `docs/superpowers/specs/2026-07-26-print-kit-duplex-folders-design.md`
- modified `scripts/export-production-poster-pdfs.mjs`
- modified `app/dev/{poster,tent,nfc-card,nfc-square}-preview/page.tsx`

It **restructures the export**: output is now nested by kind (`posters/`, `table-tents/`, `nfc-cards/`, `nfc-plates/`) and posters are paired onto duplex sheets, so `nabaperks-poster-primer.pdf` is now `nabaperks-poster-primer-lastcall.pdf`.

**Consequences for this PR:**

1. **Reconcile before starting.** A poster re-lay and a duplex pairing touch the same renderers. Land or revert the duplex work first — do not interleave them.
2. **Any `output/posters/**` path in a script or test is now wrong.\*\* Grep and fix.
3. **Duplex pairing changes what "a poster" means geometrically** — two designs share a sheet. Confirm whether the five-zone model applies per side before re-laying, and if the pairing imposes constraints, resolve them in the spec first.
4. `poster-duplex-pairs.ts` must be fixed to clear `tsc` and `poster-source-quality` regardless of who wrote it, since this PR cannot go green otherwise.

## Defects cleared by this PR

| #      | Artifact   | Defect                                                  | Task |
| ------ | ---------- | ------------------------------------------------------- | ---- |
| 3, 4   | `seal`     | Empty tint box; broken glyph fragment                   | 7    |
| 5, 6   | `chalk`    | Smiley crosses the "d"; mismatched underlines           | 10   |
| 7      | `chalk`    | Three stubs all read "START TODAY"                      | 4    |
| 8      | `pinned`   | Six cells repeat "STAMP ONE STARTS TODAY"               | 4    |
| 9      | `pinned`   | Stray white card fragment at the right edge             | 6    |
| 10, 11 | `tally`    | Orphan clipped circle; "circle one" vocabulary          | 8    |
| 12     | `window`   | Crop marks, registration targets, colour bar in artwork | 5    |
| 13     | `lastcall` | Badge floats into body; icon cluster unaligned          | 9    |

## File Structure

**Created:**

| File                                             | Responsibility                                     |
| ------------------------------------------------ | -------------------------------------------------- |
| `lib/print/stamp-rail.ts`                        | `StampRail` geometry: 3 slots, divider, seal mark  |
| `lib/print/step-rail.ts`                         | `StepRail` geometry: Tap → Join → Return, chevrons |
| `lib/notifications/poster-pdf-a4-<id>-layout.ts` | One per design (7), pure, emits a ledger           |
| `tests/unit/poster-<id>-layout.test.mjs`         | One per design (7), guard assertions               |
| `tests/contracts/print-stamp-parity.test.mjs`    | Guard G8                                           |

**Modified:** the seven painters; `config/poster-designs.json`; `lib/qr/poster-model-readers.ts`; `lib/qr/poster-content-types.ts`; `tests/unit/poster-designs.test.mjs`; `tests/contracts/poster-designs-catalog.test.mjs`.

---

### Task 1: Raise the A4 safe margin to 18mm

`safeMarginMm` is pinned in **four** places. All four move in one commit or the strict reader throws.

**Files:**

- Modify: `config/poster-designs.json` (`shared.geometry.a4.safeMarginMm`)
- Modify: `lib/qr/poster-model-readers.ts` (`exactNumber(..., 15)` → `18`)
- Modify: `lib/qr/poster-content-types.ts` (`readonly safeMarginMm: 15` → `18`)
- Modify: `tests/unit/poster-designs.test.mjs`, `tests/contracts/poster-designs-catalog.test.mjs`

- [ ] **Step 1: Change all four pins**

```bash
python3 - <<'PY'
import re, pathlib
edits = {
  "config/poster-designs.json": ('"safeMarginMm": 15', '"safeMarginMm": 18'),
  "lib/qr/poster-model-readers.ts": ('"posterDesigns.shared.geometry.a4",\n        15', '"posterDesigns.shared.geometry.a4",\n        18'),
  "lib/qr/poster-content-types.ts": ("readonly safeMarginMm: 15", "readonly safeMarginMm: 18"),
  "tests/unit/poster-designs.test.mjs": ("safeMarginMm: 15", "safeMarginMm: 18"),
  "tests/contracts/poster-designs-catalog.test.mjs": ("safeMarginMm: 15", "safeMarginMm: 18"),
}
for path, (old, new) in edits.items():
    p = pathlib.Path(path); s = p.read_text()
    assert old in s, f"pin not found in {path}"
    p.write_text(s.replace(old, new, 1)); print("patched", path)
PY
```

- [ ] **Step 2: Confirm the reader accepts it**

Run: `pnpm typecheck && pnpm test`
Expected: PASS. A throw naming `posterDesigns.shared.geometry.a4.safeMarginMm` means a pin was missed.

- [ ] **Step 3: Confirm the verifier now enforces 18mm**

```bash
rm -rf output/posters && pnpm posters:export-production
pnpm posters:verify-pdfs
```

Expected: **FAIL** for the six posters not yet re-laid (`primer` was laid to 18mm in PR 1 and should pass). Record the failing list as this PR's worklist. A full pass means the verifier is not reading the catalogue — fix that before continuing.

- [ ] **Step 4: Commit**

```bash
git add config/poster-designs.json lib/qr/poster-model-readers.ts lib/qr/poster-content-types.ts tests/unit/poster-designs.test.mjs tests/contracts/poster-designs-catalog.test.mjs
git commit -m "feat(print): raise the A4 safe margin to 18mm across all four pins"
```

---

### Task 2: `StampRail` geometry

Replaces five metaphors with one. Three slots, **none pre-filled** — the customer does not have a stamp yet — slot 1 flagged as today's, then a divider, then the reward as a **seal mark, not a circle**, so it cannot read as a fourth stamp.

**Files:**

- Create: `lib/print/stamp-rail.ts`
- Test: `tests/unit/print-stamp-rail.test.mjs`

**Interfaces:**

- Consumes: `BoxMm` (`lib/print/box`), `Mark` (`lib/print/ledger-types`), `RHYTHM_BASE_MM` (`lib/print/rhythm`)
- Produces: `type StampRailOptions = { readonly origin: BoxMm; readonly slots: number; readonly container: string }`; `stampRailMarks(options: StampRailOptions): readonly Mark[]`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/print-stamp-rail.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { stampRailMarks } from "@/lib/print/stamp-rail"

const origin = { xMm: 18, yMm: 100, widthMm: 174, heightMm: 16 }
const marks = stampRailMarks({ origin, slots: 3, container: "action" })

test("the rail emits one mark per slot plus a divider and a seal", () => {
  const labels = marks.map((mark) => mark.label)
  assert.deepEqual(labels, [
    "stamp-slot-0",
    "stamp-slot-1",
    "stamp-slot-2",
    "stamp-divider",
    "stamp-seal",
  ])
})

test("no slot is pre-filled — the customer has no stamp yet", () => {
  const slots = marks.filter((mark) => mark.label.startsWith("stamp-slot-"))
  assert.ok(slots.every((mark) => mark.kind === "shape"))
  assert.ok(slots.every((mark) => mark.role === "content"))
})

test("the reward is a seal, never a fourth slot", () => {
  const seal = marks.find((mark) => mark.label === "stamp-seal")
  const divider = marks.find((mark) => mark.label === "stamp-divider")
  assert.ok(seal.box.xMm > divider.box.xMm, "the seal sits after the divider")
})

test("every mark stays inside the rail origin", () => {
  for (const mark of marks) {
    assert.ok(mark.box.xMm >= origin.xMm, mark.label)
    assert.ok(
      mark.box.xMm + mark.box.widthMm <= origin.xMm + origin.widthMm,
      mark.label
    )
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit 2>&1 | grep -A3 print-stamp-rail`
Expected: FAIL — cannot find module `@/lib/print/stamp-rail`

- [ ] **Step 3: Implement**

Emit, left to right inside `origin`: `slots` square marks on the rhythm pitch, a `stamp-divider` rule, then a `stamp-seal` shape. All `kind: "shape"`, `role: "content"`, `container` from options. Nothing pre-filled — fill state is a painter concern, not geometry.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit 2>&1 | grep -A3 print-stamp-rail` then `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/print/stamp-rail.ts tests/unit/print-stamp-rail.test.mjs
git commit -m "feat(print): one stamp rail — three empty slots and a sealed reward"
```

---

### Task 3: `StepRail` geometry and guard G8

`StepRail` must look nothing like `StampRail` — today both are numbered circles, so a customer cannot tell join steps from stamp progress.

**Files:**

- Create: `lib/print/step-rail.ts`, `tests/contracts/print-stamp-parity.test.mjs`
- Test: `tests/unit/print-step-rail.test.mjs`

**Interfaces:**

- Produces: `stepRailMarks(options: { readonly origin: BoxMm; readonly steps: number; readonly container: string }): readonly Mark[]`, emitting `step-chevron-N` and `step-label-N`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/print-step-rail.test.mjs
import assert from "node:assert/strict"
import { test } from "node:test"

import { stampRailMarks } from "@/lib/print/stamp-rail"
import { stepRailMarks } from "@/lib/print/step-rail"

const origin = { xMm: 18, yMm: 100, widthMm: 174, heightMm: 12 }

test("the step rail emits a chevron and a label per step", () => {
  const marks = stepRailMarks({ origin, steps: 3, container: "proof" })
  assert.equal(
    marks.filter((m) => m.label.startsWith("step-chevron-")).length,
    3
  )
  assert.equal(marks.filter((m) => m.label.startsWith("step-label-")).length, 3)
})

test("step and stamp rails share no label vocabulary", () => {
  const steps = new Set(
    stepRailMarks({ origin, steps: 3, container: "proof" }).map((m) => m.label)
  )
  const stamps = stampRailMarks({ origin, slots: 3, container: "proof" }).map(
    (m) => m.label
  )
  for (const label of stamps) assert.ok(!steps.has(label), label)
})
```

```js
// tests/contracts/print-stamp-parity.test.mjs — guard G8
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { walkSourceFiles } from "../support/poster-source-analysis.mjs"

const projectRoot = process.cwd()

test("no renderer draws its own stamp row", () => {
  const files = [
    ...walkSourceFiles(path.join(projectRoot, "lib", "notifications"), (f) =>
      /poster-pdf.*\.ts$/.test(f)
    ),
    ...walkSourceFiles(path.join(projectRoot, "lib", "notifications"), (f) =>
      /tent-pdf.*\.ts$/.test(f)
    ),
  ]
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    const relative = path.relative(projectRoot, file)
    if (relative.includes("stamp-rail")) continue
    assert.doesNotMatch(
      source,
      /drawStampCircles|drawStubRow|stampChip/,
      relative
    )
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit 2>&1 | grep -A3 print-step-rail`
Expected: FAIL — module missing

- [ ] **Step 3: Implement `stepRailMarks`**

Chevrons, not circles: each step is a small triangular `shape` plus a `text` label, evenly pitched across `origin`.

- [ ] **Step 4: Run both suites**

Run: `pnpm test`
Expected: PASS. G8 may already pass if no renderer uses those helper names — that is fine; it is a ratchet against regression.

- [ ] **Step 5: Commit**

```bash
git add lib/print/step-rail.ts tests/unit/print-step-rail.test.mjs tests/contracts/print-stamp-parity.test.mjs
git commit -m "feat(print): distinct step rail plus stamp-parity guard G8"
```

---

### Tasks 4–10: Re-lay the seven posters

Each poster follows the pattern `primer` established in PR 1. **Do them one per task, one commit each** — a reviewer must be able to reject one poster without rejecting the others.

Per-poster recipe:

1. **Create `lib/notifications/poster-pdf-a4-<id>-layout.ts`.** Measure every text run with the matching font (display for headlines, body for copy — one shared measurer mis-wraps one of them, as PR 1 found). Solve zones from the measured PROOF height. Emit a ledger with every mark labelled.
2. **Declare decorations properly.** Every decorative element gets `role: "decoration"` and a `clipTo` container. This is what fixes the stray fragments (#9), the orphan circle (#10) and the escaped bunting.
3. **Create `tests/unit/poster-<id>-layout.test.mjs`** asserting `checkLedger(ledger)` is empty and `checkZoneRhythm(zones)` is empty, plus a defect-specific assertion naming the audited defect number.
4. **Rewrite the painter** to draw from the ledger, converting with `mm(297 - yMm - heightMm)`.
5. **Verify by eye, not only by test.** `rm -rf output/posters && pnpm posters:export-production`, then `pdftoppm -png -r 150 <pdf> /tmp/<id>` and look at it. Guards prove geometry; they do not prove taste.
6. `pnpm test && pnpm typecheck && pnpm posters:verify-pdfs`, then commit.

**Task 4 — `chalk` and `pinned` stub rows (defects #7, #8).** Both currently repeat one string across every cell. Replace with `StampRail`. The catalogue strings for the repeated cells are deleted, not reworded.

**Task 5 — `window` (defect #12).** Delete the crop marks, registration targets and colour bar from the artwork. These belong to a press, not to a sheet a merchant prints on an office A4. Also restore the `*` bullet markers this design silently drops.

**Task 6 — `pinned` (defect #9).** The stray white card fragment is an unclipped decoration; give it a `clipTo` and it either sits inside the sheet or fails G3.

**Task 7 — `seal` (defects #3, #4).** Delete the empty tint box — G4 rejects zero-area marks, so it cannot come back. Trace and remove the broken glyph fragment beside "No 10".

**Task 8 — `tally` (defects #10, #11).** Clip the orphan circle. Change "circle one" to "stamp one" **in the catalogue**, not the renderer.

**Task 9 — `lastcall` (defect #13).** The "TODAY ONLY" badge needs a real position in the zone model rather than floating into the body column; the moon/clock/sparkle cluster needs optical alignment or removal.

**Task 10 — `chalk` (defects #5, #6).** The smiley roundel overlaps the "d" of "reward" — with the headline as a `text` mark and the roundel as a `shape`, G2 rejects it until it is moved. Reconcile the two mismatched underlines into one.

---

### Task 11: Preview parity

Deferred from PR 1 because the React path cannot trivially consume a pdf-lib-measured ledger, and a fake parity test is worse than an honest gap.

**Files:** the eight `components/merchant/qr-poster/counter-kit/*.tsx`; `tests/unit/poster-preview-parity.test.mjs`

- [ ] **Step 1: Decide the mechanism first, and write it down.** Either (a) compute the ledger server-side and pass it to the component as props, or (b) ship a browser-safe metrics implementation using the same embedded fonts. (a) is simpler and guarantees parity by construction; (b) keeps the preview self-contained. Pick one and record the reason in the commit.

- [ ] **Step 2: Write a parity test** asserting the preview positions every mark at the ledger's coordinates, for at least `primer` and one other design.

- [ ] **Step 3: Implement.** **Tailwind caveat:** this project silently drops classes added after the initial scan. Use inline `style={{ top: `${mark.box.yMm}mm` }}` for computed positions, never new utility classes.

- [ ] **Step 4: Verify in the browser.** Start the preview and compare against the rendered PDF at the same zoom.

- [ ] **Step 5: Commit.**

---

### Task 12: Re-bless visual baselines

- [ ] **Step 1: Do NOT run `--update-snapshots` locally.** Darwin baselines on this machine are environmentally stale.
- [ ] **Step 2: Push the branch and let CI run the visual lane.**
- [ ] **Step 3: Download the CI artifacts** and bless the `-linux` twins from the actual PNGs, per `visual-baseline-linux-twin-refresh`.
- [ ] **Step 4: Confirm the visual lane is green before requesting review.**

## Self-Review

**Spec coverage.** Margin → Task 1. `StampRail` → Task 2. `StepRail` + G8 → Task 3. Seven posters and eleven defects → Tasks 4–10. Preview parity → Task 11. Baselines → Task 12.

**Deferred:** tent and NFC formats (their own PRs). `QrBlock`, `VenueLockup` and `LegalLine` extract naturally during Tasks 4–10 once a second consumer exists — extract them the first time two posters need the same block, not before.

**Known gap:** Tasks 4–10 give a recipe plus per-poster specifics rather than full code, because each layout depends on measurements only available once the previous poster's module exists. Each task is still independently testable and independently rejectable, which is the bar that matters.

**Blocking dependency:** the duplex-folder work must be reconciled before Task 4. See the risk section.
