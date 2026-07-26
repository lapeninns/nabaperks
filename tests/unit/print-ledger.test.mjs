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
