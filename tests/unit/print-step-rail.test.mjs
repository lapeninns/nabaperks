import assert from "node:assert/strict"
import { test } from "node:test"

import { stampRailMarks } from "@/lib/print/stamp-rail"
import { stepRailMarks } from "@/lib/print/step-rail"

const origin = { xMm: 18, yMm: 100, widthMm: 174, heightMm: 12 }

test("the step rail emits a chevron and label per step", () => {
  const marks = stepRailMarks({ origin, steps: 3, container: "proof" })
  assert.equal(
    marks.filter((mark) => mark.label.startsWith("step-chevron-")).length,
    3
  )
  assert.equal(
    marks.filter((mark) => mark.label.startsWith("step-label-")).length,
    3
  )
})

test("step and stamp rails share no label vocabulary", () => {
  const stepLabels = new Set(
    stepRailMarks({ origin, steps: 3, container: "proof" }).map(
      (mark) => mark.label
    )
  )
  const stampLabels = stampRailMarks({
    origin,
    slots: 3,
    container: "proof",
  }).map((mark) => mark.label)
  for (const label of stampLabels) assert.ok(!stepLabels.has(label), label)
})
