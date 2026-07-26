import assert from "node:assert/strict"
import { test } from "node:test"

import { blockHeightMm, mmToPt, ptToMm, wrapLines } from "@/lib/print/text"

/** Fixed-width stand-in: every glyph is exactly half the point size wide. */
const metrics = {
  widthPt: (text, sizePt) => text.length * sizePt * 0.5,
  normalise: (text) => text,
}

test("point and millimetre conversion round-trips", () => {
  assert.equal(ptToMm(72).toFixed(4), "25.4000")
  assert.equal(mmToPt(25.4).toFixed(4), "72.0000")
})

test("wrapLines breaks on the last word that fits", () => {
  // 10pt glyphs are 5pt wide, so 50pt holds exactly 10 characters.
  assert.deepEqual(wrapLines("aaa bbb ccc", metrics, 10, 50), [
    "aaa bbb",
    "ccc",
  ])
})

test("wrapLines never drops a word, however narrow the measure", () => {
  const lines = wrapLines("alpha beta gamma", metrics, 10, 1)
  assert.deepEqual([...lines], ["alpha", "beta", "gamma"])
})

test("wrapLines collapses whitespace rather than emitting empty lines", () => {
  assert.deepEqual(wrapLines("  a   b  ", metrics, 10, 500), ["a b"])
})

test("blockHeightMm multiplies lines by size and leading", () => {
  // 3 lines x 12pt x 1.4 leading = 50.4pt = 17.78mm
  assert.equal(blockHeightMm(3, 12, 1.4).toFixed(2), "17.78")
})
