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
  // A full-bleed box starting at the top maps to the sheet origin.
  assert.equal(toPdfYMm("a4Poster", 0, 297), 0)
})
