import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolveTentContent,
  resolveTentText,
  tentDesignIds,
} from "@/lib/qr/tent-content"

test("tent content resolves the closed stamp placeholder grammar", () => {
  const sealed = resolveTentContent("sealed", 4)
  assert.match(sealed.faceA.body, /Reach stamp 4/)
  assert.equal(resolveTentText("{stamps} / {StampsWord}", 6), "6 / Six")
  assert.throws(
    () => resolveTentText("{mystery}", 4),
    /Unsupported table-tent placeholder/
  )
  assert.throws(
    () => resolveTentText("{broken", 4),
    /Unresolved table-tent placeholder/
  )
})

test("tent content rejects invalid venue stamp counts", () => {
  for (const invalid of [0, -1, 1.5, 7, 100, Number.NaN]) {
    assert.throws(
      () => resolveTentContent("regulars", invalid),
      /integer from 1 to 6/
    )
  }
})

test("every tent resolves both faces for each supported stamp count", () => {
  assert.equal(tentDesignIds().length, 5)
  for (const id of tentDesignIds()) {
    for (const stamps of [1, 2, 3, 4, 5, 6]) {
      const content = resolveTentContent(id, stamps)
      assert.equal(content.id, id)
      assert.ok(content.faceA.headline.length >= 1)
      assert.ok(content.faceB.headline.length >= 1)
      assert.ok(!content.faceA.body.includes("{"))
      assert.ok(!content.faceB.body.includes("{"))
      assert.equal(content.friction, "One text · No app · Marketing optional")
      assert.equal(content.footer.left, "One visit stamp per UK date")
    }
  }
})

test("all five tents share the folded A4 geometry and QR contract", () => {
  for (const id of tentDesignIds()) {
    const content = resolveTentContent(id, 6)
    assert.equal(content.sheet, "a4")
    assert.equal(content.geometry.sheetWidthMm, 210)
    assert.equal(content.geometry.sheetHeightMm, 297)
    assert.equal(content.geometry.faceHeightMm, 148.5)
    assert.equal(content.geometry.foldAtMm, 148.5)
    assert.equal(content.qr.quietZoneModules, 4)
    assert.equal(content.qr.errorCorrectionLevel, "H")
    assert.match(content.reassurance, /^18\+ to redeem/)
    // Both faces carry the same shared footer and the venue kicker.
    assert.equal(content.footer.left, "One visit stamp per UK date")
    assert.ok(content.kicker.length > 0)
  }
})
