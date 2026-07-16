import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument, StandardFonts } from "pdf-lib"

import {
  fitSingleLineText,
  posterStyle,
  standardFontText,
  stampRowLabel,
} from "@/lib/notifications/poster-pdf-style"
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
    const isTableTent = attachment.filename.includes("table-tent")
    const expectedWidth = isTableTent ? 498.9 : 595.28
    const expectedHeight = isTableTent ? 708.66 : 841.89
    assert.ok(
      Math.abs(page.getWidth() - expectedWidth) < 0.2,
      `${attachment.filename} has expected ${isTableTent ? "B5" : "A4"} width`
    )
    assert.ok(
      Math.abs(page.getHeight() - expectedHeight) < 0.2,
      `${attachment.filename} has expected ${isTableTent ? "B5" : "A4"} height`
    )
  }
})

test("poster PDFs tolerate venue names with glyphs outside the standard PDF font", async () => {
  // Given a valid merchant name containing a glyph unavailable in WinAnsi.
  // When the attachment bundle is generated, the printed label falls back
  // without losing the merchant's original name from email or app state.
  const attachments = await buildPosterPdfAttachments({
    merchantName: "Dragon 🐉 Pub",
    shareUrl: "https://nabaperks.com/q/dragon-pub",
    stampsRequired: 5,
  })

  // Then PDF generation still completes for every layout.
  assert.equal(attachments.length, QR_POSTER_TEMPLATES.length)
  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/)
  }
})

test("poster PDF venue labels stay on one line inside the A4 header", async () => {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.CourierBold)
  const maxWidth = 479
  const label = fitSingleLineText(
    "THE EXTRAORDINARILY LONG CROWN AND ANCHOR COMMUNITY PUBLIC HOUSE IN CAMBRIDGE",
    font,
    12,
    maxWidth
  )

  assert.match(label, /\.\.\.$/)
  assert.ok(font.widthOfTextAtSize(label, 12) <= maxWidth)
  assert.doesNotMatch(label, /\n/)
})

test("poster copy and compact thresholds stay grammatical at valid card edges", () => {
  assert.equal(posterStyle("editorial", 1).headline, "One visit. One surprise.")
  assert.match(posterStyle("editorial", 1).support, /scan now to unlock/i)
  assert.match(posterStyle("northstar", 1).support, /claim it now/i)
  assert.match(posterStyle("northstar", 2).support, /1 more visit unlocks/i)
  assert.match(posterStyle("thermal", 1).support, /VISIT TO UNLOCK: 1/)
  assert.equal(
    posterStyle("table-tent", 1).headline,
    "Visit. Stamp. Unlock."
  )
  assert.match(posterStyle("table-tent", 3).support, /3 visits/)
  assert.equal(stampRowLabel(12), null)
  assert.equal(stampRowLabel(99), "99 VISITS TO UNLOCK")
})

test("poster PDF venue labels omit unsupported glyphs cleanly", async () => {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.CourierBold)

  assert.equal(standardFontText("DRAGON 🐉 PUB", font), "DRAGON PUB")
  assert.equal(standardFontText("🐉", font), "YOUR VENUE")
})
