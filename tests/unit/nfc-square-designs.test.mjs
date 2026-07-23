import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolveNfcSquareContent,
  resolveNfcSquareText,
  nfcSquareDesignIds,
} from "@/lib/qr/nfc-square-content"

test("NFC square content resolves the closed stamp placeholder grammar", () => {
  const tap = resolveNfcSquareContent("tap", 4)
  assert.match(tap.front.mysteryAccent, /Unlock at 4/)
  assert.equal(tap.front.tapWord, "Tap")
  assert.equal(tap.front.tapSub, "Phone here")
  assert.match(tap.front.claimLine, /today's stamp after one text/)
  assert.deepEqual(tap.front.flow, ["Tap", "Stamp", "Unlock"])
  assert.match(tap.dieRule, /18\+ to redeem/)
  assert.equal(resolveNfcSquareText("{stamps} / {StampsWord}", 6), "6 / Six")
  assert.throws(
    () => resolveNfcSquareText("{mystery}", 4),
    /Unsupported NFC square placeholder/
  )
})

test("NFC square content rejects invalid venue stamp counts", () => {
  for (const invalid of [0, -1, 1.5, 7, Number.NaN]) {
    assert.throws(
      () => resolveNfcSquareContent("tap", invalid),
      /integer from 1 to 6/
    )
  }
})

test("every NFC square resolves a wall billboard face for each stamp count", () => {
  assert.equal(nfcSquareDesignIds().length, 1)
  for (const id of nfcSquareDesignIds()) {
    for (const stamps of [1, 2, 3, 4, 5, 6]) {
      const content = resolveNfcSquareContent(id, stamps)
      assert.equal(content.id, id)
      assert.ok(content.front.claimLine.length > 0)
      assert.ok(content.front.mysteryKicker.length > 0)
      assert.ok(content.front.tapWord.length > 0)
      assert.equal(content.front.flow.length, 3)
      assert.equal("stampCue" in content.front, false)
      assert.equal("back" in content, false)
      assert.doesNotMatch(content.front.claimLine, /free stamp/i)
      assert.doesNotMatch(content.front.mysteryAccent, /free stamp/i)
    }
  }
})

test("NFC squares share native 100×100 geometry and QR contract", () => {
  for (const id of nfcSquareDesignIds()) {
    const content = resolveNfcSquareContent(id, 6)
    assert.equal(content.sheet, "square-100")
    assert.equal(content.geometry.cardWidthMm, 100)
    assert.equal(content.geometry.cardHeightMm, 100)
    assert.equal(content.geometry.qrOuterMm, 20)
    assert.equal("sheetWidthMm" in content.geometry, false)
    assert.equal("frontOriginXMm" in content.geometry, false)
    assert.equal(content.qr.quietZoneModules, 4)
    assert.equal(content.qr.errorCorrectionLevel, "H")
    assert.match(content.cutLabel, /100 × 100 mm/)
    assert.match(content.reassurance, /^18\+ to redeem/)
    assert.match(content.dieRule, /One stamp per UK day/)
  }
})
