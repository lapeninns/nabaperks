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
