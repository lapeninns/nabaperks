import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument } from "pdf-lib"

import {
  buildAllTentPdfAttachments,
  buildTentPdfAttachments,
} from "@/lib/notifications/tent-pdf"
import { TENT_PRODUCTION_DESIGNS } from "@/lib/qr/tent-templates"

test("tent bundle builds one valid A4 PDF for every production design", async () => {
  const attachments = await buildTentPdfAttachments({
    merchantName: "Old Crown Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    stampsRequired: 5,
  })

  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    TENT_PRODUCTION_DESIGNS.map(({ id }) => `nabaperks-tent-${id}.pdf`)
  )

  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/, `${attachment.filename} pdf`)
    assert.ok(
      Buffer.from(attachment.content, "base64").byteLength > 5_000,
      `${attachment.filename} has rendered artwork`
    )
    const document = await PDFDocument.load(attachment.content)
    assert.equal(document.getPageCount(), 1, `${attachment.filename} one page`)
    const [page] = document.getPages()
    assert.ok(Math.abs(page.getWidth() - 595.28) < 0.2, "A4 width")
    assert.ok(Math.abs(page.getHeight() - 841.89) < 0.2, "A4 height")
  }
})

test("tent PDFs tolerate venue names with glyphs outside the standard font", async () => {
  const attachments = await buildAllTentPdfAttachments({
    merchantName: "Dragon 🐉 Pub",
    shareUrl: "https://nabaperks.com/q/dragon",
    stampsRequired: 3,
  })
  assert.equal(attachments.length, 5)
  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/)
  }
})

test("tent PDFs cover every supported stamp count", async () => {
  for (const stampsRequired of [1, 6]) {
    const attachments = await buildAllTentPdfAttachments({
      merchantName: "Old Crown Girton",
      shareUrl: "https://nabaperks.com/q/abc123",
      stampsRequired,
    })
    assert.equal(attachments.length, 5)
    for (const attachment of attachments) {
      assert.match(attachment.content, /^JVBERi0/)
    }
  }
})
