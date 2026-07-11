import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument } from "pdf-lib"

import { buildPosterPdfAttachments } from "@/lib/notifications/poster-pdf"
import { QR_POSTER_TEMPLATES } from "@/lib/qr/poster-templates"

test("poster email builds one valid A4 PDF attachment for every registered template", async () => {
  // Given a merchant with a printable QR and a five-visit card.
  // When the email attachment bundle is generated.
  const attachments = await buildPosterPdfAttachments({
    merchantName: "Old Crown Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    stampsRequired: 5,
  })

  // Then every registered poster is present as a readable, single-page A4 PDF.
  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    QR_POSTER_TEMPLATES.map(({ id }) => `nabaperks-poster-${id}.pdf`)
  )

  for (const attachment of attachments) {
    assert.match(
      attachment.content,
      /^JVBERi0/,
      `${attachment.filename} is Base64 PDF data`
    )
    const document = await PDFDocument.load(attachment.content)
    const [page] = document.getPages()
    assert.equal(
      document.getPageCount(),
      1,
      `${attachment.filename} has one page`
    )
    assert.ok(page, `${attachment.filename} includes its A4 page`)
    assert.ok(
      Math.abs(page.getWidth() - 595.28) < 0.1,
      `${attachment.filename} is A4 width`
    )
    assert.ok(
      Math.abs(page.getHeight() - 841.89) < 0.1,
      `${attachment.filename} is A4 height`
    )
  }
})
