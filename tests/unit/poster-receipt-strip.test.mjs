import assert from "node:assert/strict"
import { test } from "node:test"

import { liveArea } from "@/lib/print/geometry"
import { isRhythmGap } from "@/lib/print/rhythm"
import { RECEIPT_STRIP } from "@/lib/notifications/poster-pdf-a4-receipt-rows"

const live = liveArea("a4Poster")

test("the docket strip is inset symmetrically inside the A4 live area", () => {
  const leftInset = RECEIPT_STRIP.left - live.xMm
  const rightInset =
    live.xMm + live.widthMm - (RECEIPT_STRIP.left + RECEIPT_STRIP.width)
  assert.equal(leftInset, rightInset, "strip insets match")
  assert.ok(
    isRhythmGap(leftInset),
    `strip inset ${leftInset}mm is on the scale`
  )
})

test("the copy inset inside the strip is symmetric and on the scale", () => {
  const leftInset = RECEIPT_STRIP.innerLeft - RECEIPT_STRIP.left
  const rightInset =
    RECEIPT_STRIP.left +
    RECEIPT_STRIP.width -
    (RECEIPT_STRIP.innerLeft + RECEIPT_STRIP.innerWidth)
  assert.equal(leftInset, rightInset, "copy insets match")
  assert.ok(isRhythmGap(leftInset), `copy inset ${leftInset}mm is on the scale`)
})

test("the strip and its copy stay inside the live area", () => {
  assert.ok(RECEIPT_STRIP.left >= live.xMm)
  assert.ok(RECEIPT_STRIP.left + RECEIPT_STRIP.width <= live.xMm + live.widthMm)
  assert.ok(RECEIPT_STRIP.innerLeft >= RECEIPT_STRIP.left)
  assert.ok(
    RECEIPT_STRIP.innerWidth > 0 &&
      RECEIPT_STRIP.innerLeft + RECEIPT_STRIP.innerWidth <=
        RECEIPT_STRIP.left + RECEIPT_STRIP.width
  )
})

test("the copy measure stays in a readable range", () => {
  // 12pt mono over more than ~130mm runs past a comfortable line length.
  assert.ok(RECEIPT_STRIP.innerWidth >= 90, "not too narrow")
  assert.ok(RECEIPT_STRIP.innerWidth <= 130, "not too wide")
})
