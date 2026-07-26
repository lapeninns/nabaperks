import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolvePosterContent,
  resolvePosterText,
} from "@/lib/qr/poster-content"
import { posterDesignIds } from "@/lib/qr/poster-designs"

test("poster content resolves the closed stamp placeholder grammar", () => {
  const tally = resolvePosterContent("tally", 4)
  const primer = resolvePosterContent("primer", 4)

  assert.equal(tally.headline, "Four stamps. One reward.")
  assert.equal(primer.headline, "Start today. Your reward at stamp 4.")
  assert.equal(primer.clauses.at(-1)?.title, "Your reward stays sealed")
  assert.equal(resolvePosterText("{stamps} / {StampsWord}", 6), "6 / Six")
  assert.throws(
    () => resolvePosterText("{remaining}", 4),
    /Unsupported poster placeholder/
  )
  assert.throws(
    () => resolvePosterText("{not-supported!}", 4),
    /Unresolved poster placeholder/
  )
})

test("poster content rejects invalid venue stamp counts", () => {
  for (const invalidValue of [0, -1, 1.5, 7, 100, Number.NaN]) {
    assert.throws(
      () => resolvePosterContent("window", invalidValue),
      /integer from 1 to 6/
    )
  }
})

test("all eight designs share the A4 geometry and QR contract", () => {
  assert.equal(posterDesignIds().length, 8)
  for (const id of posterDesignIds()) {
    const content = resolvePosterContent(id, 6)
    assert.equal(content.sheet, "a4")
    assert.deepEqual(content.geometry, {
      sheetWidthMm: 210,
      sheetHeightMm: 297,
      safeMarginMm: 15,
    })
    assert.equal(content.qr.quietZoneModules, 4)
    assert.equal(content.qr.errorCorrectionLevel, "H")
    assert.match(content.reassurance, /^18\+ to redeem/)
  }
})

test("every design resolves copy for each supported stamp count", () => {
  for (const id of posterDesignIds()) {
    for (const stamps of [1, 2, 3, 4, 5, 6]) {
      const content = resolvePosterContent(id, stamps)
      assert.equal(content.id, id)
    }
  }
})
