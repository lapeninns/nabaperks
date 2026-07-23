import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument } from "pdf-lib"

import {
  buildAllNfcCardPdfAttachments,
  buildNfcCardPdfAttachments,
} from "@/lib/notifications/nfc-card-pdf"
import {
  NFC_CARD_DESIGN_IDS,
  NFC_CARD_PRODUCTION_DESIGNS,
} from "@/lib/qr/nfc-card-templates"

test("NFC card bundle builds a two-page CR80 PDF for every production design", async () => {
  const attachments = await buildNfcCardPdfAttachments({
    merchantName: "Old Crown Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    stampsRequired: 5,
  })

  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    NFC_CARD_PRODUCTION_DESIGNS.map(({ id }) => `nabaperks-nfc-${id}.pdf`)
  )

  const cr80Width = (85.5 * 72) / 25.4
  const cr80Height = (54 * 72) / 25.4

  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/, `${attachment.filename} pdf`)
    assert.ok(
      Buffer.from(attachment.content, "base64").byteLength > 5_000,
      `${attachment.filename} has rendered artwork`
    )
    const document = await PDFDocument.load(attachment.content)
    assert.equal(
      document.getPageCount(),
      2,
      `${attachment.filename} front+back`
    )
    for (const page of document.getPages()) {
      assert.ok(Math.abs(page.getWidth() - cr80Width) < 0.2, "CR80 width")
      assert.ok(Math.abs(page.getHeight() - cr80Height) < 0.2, "CR80 height")
    }
  }
})

test("NFC card PDFs tolerate venue names with glyphs outside the standard font", async () => {
  const attachments = await buildAllNfcCardPdfAttachments({
    merchantName: "Dragon 🐉 Pub",
    shareUrl: "https://nabaperks.com/q/dragon",
    stampsRequired: 3,
  })
  assert.equal(attachments.length, NFC_CARD_DESIGN_IDS.length)
  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/)
  }
})

test("NFC card PDFs cover every supported stamp count", async () => {
  for (const stampsRequired of [1, 6]) {
    const attachments = await buildAllNfcCardPdfAttachments({
      merchantName: "Old Crown Girton",
      shareUrl: "https://nabaperks.com/q/abc123",
      stampsRequired,
    })
    assert.equal(attachments.length, NFC_CARD_DESIGN_IDS.length)
    for (const attachment of attachments) {
      assert.match(attachment.content, /^JVBERi0/)
    }
  }
})
