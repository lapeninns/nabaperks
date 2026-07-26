import assert from "node:assert/strict"
import { test } from "node:test"

import {
  checkClips,
  checkCollisions,
  checkDegenerate,
  checkLedger,
  checkSafeArea,
} from "@/lib/print/guards"
import { createLedger } from "@/lib/print/ledger"

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
