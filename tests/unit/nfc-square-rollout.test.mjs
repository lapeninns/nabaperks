import assert from "node:assert/strict"
import { test } from "node:test"

import {
  getNfcSquareDesign,
  isNfcSquareDesignId,
  NFC_SQUARE_DESIGN_IDS,
  NFC_SQUARE_DESIGNS,
  NFC_SQUARE_PRODUCTION_DESIGNS,
} from "@/lib/qr/nfc-square-templates"

test("registered NFC squares validate and resolve metadata", () => {
  assert.equal(NFC_SQUARE_DESIGN_IDS.length, 2)
  for (const id of NFC_SQUARE_DESIGN_IDS) {
    assert.ok(isNfcSquareDesignId(id))
    const design = getNfcSquareDesign(id)
    assert.equal(design?.id, id)
    assert.equal(design.collection, "nfc-square")
    assert.equal(design.format, "nfc-square-100")
    assert.equal(design.sheet, "square-100")
  }
  assert.equal(isNfcSquareDesignId("unknown"), false)
  assert.equal(getNfcSquareDesign("unknown"), null)
})

test("the NFC square kit is in the production rotation", () => {
  assert.deepEqual(
    NFC_SQUARE_PRODUCTION_DESIGNS.map(({ id }) => id),
    ["tap", "google-review"]
  )
  assert.equal(NFC_SQUARE_PRODUCTION_DESIGNS.length, NFC_SQUARE_DESIGNS.length)
})
