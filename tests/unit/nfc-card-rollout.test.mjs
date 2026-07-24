import assert from "node:assert/strict"
import { test } from "node:test"

import {
  getNfcCardDesign,
  isNfcCardDesignId,
  NFC_CARD_DESIGN_IDS,
  NFC_CARD_DESIGNS,
  NFC_CARD_PRODUCTION_DESIGNS,
} from "@/lib/qr/nfc-card-templates"

test("registered NFC cards validate and resolve metadata", () => {
  assert.equal(NFC_CARD_DESIGN_IDS.length, 2)
  for (const id of NFC_CARD_DESIGN_IDS) {
    assert.ok(isNfcCardDesignId(id))
    const design = getNfcCardDesign(id)
    assert.equal(design?.id, id)
    assert.equal(design.collection, "nfc-card")
    assert.equal(design.format, "cr80-nfc")
    assert.ok(["production", "review", "experimental"].includes(design.rollout))
  }
  assert.equal(isNfcCardDesignId("unknown-nfc"), false)
  assert.equal(getNfcCardDesign("unknown-nfc"), null)
})

test("the NFC card kit is in the production rotation", () => {
  assert.deepEqual(
    NFC_CARD_PRODUCTION_DESIGNS.map(({ id }) => id),
    ["tap", "google-review"]
  )
  assert.equal(NFC_CARD_PRODUCTION_DESIGNS.length, NFC_CARD_DESIGNS.length)
})
