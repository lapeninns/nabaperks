import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildQrNfcSquareDownloadEvent,
  NFC_SQUARE_DOWNLOAD_ASSET_TYPE,
} from "@/app/app/qr/nfc-square/tracking"

test("NFC square download event names the pdf asset type", () => {
  const event = buildQrNfcSquareDownloadEvent({
    merchantId: "merchant-1",
    qrCodeId: "qr-1",
    designId: "tap",
  })
  assert.equal(event.eventName, "qr_downloaded")
  assert.equal(event.metadata.asset_type, NFC_SQUARE_DOWNLOAD_ASSET_TYPE)
  assert.equal(event.metadata.template, "tap")
})
