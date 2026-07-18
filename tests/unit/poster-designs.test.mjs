import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolvePosterContent,
  resolvePosterText,
} from "@/lib/qr/poster-content"
import { posterDesignIds } from "@/lib/qr/poster-designs"

test("poster content resolves the closed stamp placeholder grammar", () => {
  const editorial = resolvePosterContent("editorial", 4)
  const thermal = resolvePosterContent("thermal", 4)

  assert.equal(editorial.headline.beforeAccent, "Four visits. One ")
  assert.equal(thermal.items.at(-1)?.value, "4")
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
      () => resolvePosterContent("editorial", invalidValue),
      /integer from 1 to 6/
    )
  }
})

test("all five designs share the A4 geometry and QR contract", () => {
  assert.equal(posterDesignIds().length, 5)
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
