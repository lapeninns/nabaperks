import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolveNfcCardContent,
  resolveNfcCardText,
  nfcCardDesignIds,
} from "@/lib/qr/nfc-card-content"

test("NFC card content resolves the closed stamp placeholder grammar", () => {
  const tap = resolveNfcCardContent("tap", 4)
  assert.equal(tap.front.stampCue, "Start today · reward at 4")
  assert.equal(tap.front.claimLine, "One text. Start your 4-stamp card.")
  assert.equal(tap.back.sealLabel, "At stamp 4")
  assert.equal(resolveNfcCardText("{stamps} / {StampsWord}", 6), "6 / Six")
  assert.throws(
    () => resolveNfcCardText("{mystery}", 4),
    /Unsupported NFC card placeholder/
  )
  assert.throws(
    () => resolveNfcCardText("{broken", 4),
    /Unresolved NFC card placeholder/
  )
})

test("NFC card content rejects invalid venue stamp counts", () => {
  for (const invalid of [0, -1, 1.5, 7, 100, Number.NaN]) {
    assert.throws(
      () => resolveNfcCardContent("tap", invalid),
      /integer from 1 to 6/
    )
  }
})

test("every NFC card resolves front and back for each supported stamp count", () => {
  assert.equal(nfcCardDesignIds().length, 2)
  for (const id of nfcCardDesignIds()) {
    for (const stamps of [1, 2, 3, 4, 5, 6]) {
      const content = resolveNfcCardContent(id, stamps)
      assert.equal(content.id, id)
      assert.ok(content.front.claimLine.length > 0)
      assert.ok(content.back.steps.length === 3)
      assert.ok(!content.front.stampCue.includes("{"))
      assert.ok(!content.back.sealLabel.includes("{"))
      assert.doesNotMatch(content.front.claimLine, /free stamp/i)
      assert.doesNotMatch(
        content.back.steps.map((s) => s.detail).join(" "),
        /receipt/i
      )
      assert.equal(content.front.flow[0], "Tap")
      assert.equal(content.back.steps[0].title, "Tap")
      if (id === "tap") {
        assert.match(content.front.claimLine, /one text/i)
        assert.match(content.back.teaseAccent, /can be stamp one/i)
        assert.equal(content.dieRule, "One stamp/UK date · 18+ to redeem")
      } else {
        assert.match(content.front.stampCue, /Google/i)
        assert.equal(content.front.flow[1], "Rate")
        assert.equal(content.back.steps[2].title, "Post")
      }
    }
  }
})

test("NFC cards share native CR80 geometry and QR contract", () => {
  for (const id of nfcCardDesignIds()) {
    const content = resolveNfcCardContent(id, 6)
    assert.equal(content.sheet, "cr80")
    assert.equal(content.geometry.cardWidthMm, 85.5)
    assert.equal(content.geometry.cardHeightMm, 54)
    assert.equal(content.geometry.googleReviewQrOuterMm, 20)
    assert.equal(content.qr.quietZoneModules, 4)
    assert.equal(content.qr.errorCorrectionLevel, "H")
    assert.match(content.reassurance, /^18\+ to redeem/)
    assert.equal(content.typeTiers.floorPt, 6.5)
  }
})

test("NFC card share URLs tag the scan channel for analytics", async () => {
  const { appendQrShareChannel } = await import("@/lib/qr/nfc-card-share-url")
  assert.equal(
    appendQrShareChannel("https://nabaperks.com/q/abc", "qr"),
    "https://nabaperks.com/q/abc?src=qr"
  )
  assert.equal(
    appendQrShareChannel("https://nabaperks.com/q/abc?ref=x", "nfc"),
    "https://nabaperks.com/q/abc?ref=x&src=nfc"
  )
  assert.throws(() =>
    appendQrShareChannel("https://nabaperks.com/q/abc", "poster")
  )
})

test("Google Review card copy resolves the stored locality", () => {
  const content = resolveNfcCardContent("google-review", 3, "Sawtry")

  assert.match(content.front.brandEyebrow, /Sawtry/)
  assert.match(content.front.stampCue, /Sawtry/)
  assert.match(content.back.strap, /Sawtry/)
  assert.doesNotMatch(JSON.stringify(content), /Girton/)
})
