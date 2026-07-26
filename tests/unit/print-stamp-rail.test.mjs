import assert from "node:assert/strict"
import { test } from "node:test"

import { stampRailMarks } from "@/lib/print/stamp-rail"

const origin = { xMm: 18, yMm: 100, widthMm: 174, heightMm: 16 }
const marks = stampRailMarks({ origin, slots: 3, container: "action" })

test("the rail emits three slots, a divider, and a reward seal", () => {
  assert.deepEqual(
    marks.map((mark) => mark.label),
    [
      "stamp-slot-0",
      "stamp-slot-1",
      "stamp-slot-2",
      "stamp-divider",
      "stamp-seal",
    ]
  )
})

test("all three stamp slots are empty shape geometry", () => {
  const slots = marks.filter((mark) => mark.label.startsWith("stamp-slot-"))
  assert.equal(slots.length, 3)
  assert.ok(slots.every((mark) => mark.kind === "shape"))
  assert.ok(slots.every((mark) => mark.role === "content"))
})

test("the reward seal is separated from the stamp slots", () => {
  const divider = marks.find((mark) => mark.label === "stamp-divider")
  const seal = marks.find((mark) => mark.label === "stamp-seal")
  assert.ok(seal.box.xMm > divider.box.xMm)
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
