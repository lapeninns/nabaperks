import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildQrNfcCardDownloadEvent,
  NFC_CARD_DOWNLOAD_ASSET_TYPE,
} from "@/app/app/qr/nfc/tracking"

test("NFC card download event names the pdf asset type", () => {
  const event = buildQrNfcCardDownloadEvent({
    merchantId: "merchant-1",
    qrCodeId: "qr-1",
    designId: "tap",
  })
  assert.equal(event.eventName, "qr_downloaded")
  assert.equal(event.metadata.asset_type, NFC_CARD_DOWNLOAD_ASSET_TYPE)
  assert.equal(event.metadata.template, "tap")
  assert.equal(event.metadata.source, "nfc_card_print_button")
})
