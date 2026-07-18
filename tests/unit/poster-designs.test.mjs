import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolvePosterContent,
  resolvePosterText,
} from "@/lib/qr/poster-content"

test("poster content resolves the closed stamp placeholder grammar recursively", () => {
  const editorial = resolvePosterContent("editorial", 4)
  const thermal = resolvePosterContent("thermal", 4)
  const studio = resolvePosterContent("table-tent-studio", 4)

  assert.equal(editorial.id, "editorial")
  assert.equal(editorial.headline.beforeAccent, "Four visits. One ")
  assert.equal(thermal.id, "thermal")
  assert.equal(thermal.items.at(-1)?.value, "4")
  assert.equal(studio.id, "table-tent-studio")
  assert.equal(studio.faces.bottom.headline, "Four visits. One venue reward.")
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
  assert.equal(resolvePosterContent("editorial", 6).id, "editorial")
})

test("poster content carries print geometry and truthful shared reassurance", () => {
  const a4 = resolvePosterContent("bold", 6)
  const b5 = resolvePosterContent("table-tent", 6)

  assert.equal(a4.qr.outerMm, 55)
  assert.equal(a4.qr.quietZoneModules, 4)
  assert.equal(a4.qr.errorCorrectionLevel, "H")
  assert.deepEqual(a4.geometry, {
    sheetWidthMm: 210,
    sheetHeightMm: 297,
    safeMarginMm: 15,
  })
  assert.equal(b5.faces.bottom.qr.outerMm, 46)
  assert.equal(b5.faces.top.qr.outerMm, 48)
  assert.deepEqual(b5.geometry, {
    sheetWidthMm: 176,
    sheetHeightMm: 250,
    faceHeightMm: 125,
    liveInsetMm: 5,
    foldCorridorMm: 10,
    identityRowMm: 25,
    mainRowMm: 80,
    lowerOcclusionRowMm: 20,
    topRotationDeg: 180,
  })
  assert.equal(a4.fonts.display.boldFile, "BricolageGrotesque-Bold.ttf")
  assert.equal(a4.fonts.mono.regularFile, "SpaceMono-Regular.ttf")
  assert.deepEqual(a4.typeTiers, {
    hookPt: 68,
    substantivePt: 14,
    factsPt: 9,
  })
  assert.deepEqual(b5.typeTiers, {
    hookPt: 30,
    substantivePt: 14,
    factsPt: 12,
  })
  assert.equal(b5.palette.accent, "#cf330a")
  assert.match(a4.reassurance, /^18\+ to redeem/)
})
