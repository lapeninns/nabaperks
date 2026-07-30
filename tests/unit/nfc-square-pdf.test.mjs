import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument } from "pdf-lib"

import {
  buildAllNfcSquarePdfAttachments,
  buildNfcSquarePdfAttachments,
} from "@/lib/notifications/nfc-square-pdf"
import {
  NFC_SQUARE_DESIGN_IDS,
  NFC_SQUARE_PRODUCTION_DESIGNS,
} from "@/lib/qr/nfc-square-templates"
import { GOOGLE_REVIEW_PLATE_LAYOUT_MM } from "@/lib/notifications/google-review-plate-layout"
import { nfcSquareGeometry } from "@/lib/qr/nfc-square-content-readers"

/** 100 mm in PDF points (1 pt = 1/72 in; 1 in = 25.4 mm). */
const SQUARE_PT = (100 * 72) / 25.4

test("Google review plate keeps the QR fallback clear of the tap button", () => {
  const { button, qr, fallbackCaption } = GOOGLE_REVIEW_PLATE_LAYOUT_MM
  // The QR size comes from the design geometry (the render paths' single
  // source), so this invariant now guards the configured value too.
  const qrFrameTop =
    qr.y + nfcSquareGeometry().googleReviewQrOuterMm + qr.framePadding

  assert.ok(qrFrameTop < button.y, "QR frame clears the tap button")
  assert.ok(
    fallbackCaption.x + fallbackCaption.width < qr.x - qr.framePadding,
    "fallback caption clears the QR frame"
  )
})

test("NFC square bundle builds one valid 100×100 mm PDF for every production design", async () => {
  const attachments = await buildNfcSquarePdfAttachments({
    merchantName: "Old Crown Girton",
    locality: "Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    googleReviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJ-example",
    stampsRequired: 5,
  })

  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    NFC_SQUARE_PRODUCTION_DESIGNS.map(
      ({ id }) => `nabaperks-nfc-square-${id}.pdf`
    )
  )

  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/, `${attachment.filename} pdf`)
    assert.ok(
      Buffer.from(attachment.content, "base64").byteLength > 5_000,
      `${attachment.filename} has rendered artwork`
    )
    const document = await PDFDocument.load(attachment.content)
    assert.equal(document.getPageCount(), 1)
    const [page] = document.getPages()
    assert.ok(Math.abs(page.getWidth() - SQUARE_PT) < 0.2, "100 mm width")
    assert.ok(Math.abs(page.getHeight() - SQUARE_PT) < 0.2, "100 mm height")
  }
})

test("NFC square PDFs tolerate unusual venue glyphs", async () => {
  const attachments = await buildAllNfcSquarePdfAttachments({
    merchantName: "Dragon 🐉 Pub",
    shareUrl: "https://nabaperks.com/q/dragon",
    googleReviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJ-dragon",
    stampsRequired: 3,
  })
  assert.equal(attachments.length, NFC_SQUARE_DESIGN_IDS.length)
  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/)
  }
})

test("NFC square bundle omits the review plate without a valid review URL", async () => {
  const attachments = await buildNfcSquarePdfAttachments({
    merchantName: "Old Crown Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    stampsRequired: 3,
  })
  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    ["nabaperks-nfc-square-tap.pdf"]
  )
})
