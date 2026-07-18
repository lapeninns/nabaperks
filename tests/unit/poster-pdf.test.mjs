import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument, StandardFonts } from "pdf-lib"

import {
  fitSingleLineText,
  mm,
  standardFontText,
} from "@/lib/notifications/poster-pdf-style"
import { drawKitVenueLine } from "@/lib/notifications/poster-pdf-kit-venue"
import {
  buildAllPosterPdfAttachments,
  buildPosterPdfAttachments,
} from "@/lib/notifications/poster-pdf"
import {
  QR_POSTER_PRODUCTION_TEMPLATES,
  QR_POSTER_TEMPLATES,
} from "@/lib/qr/poster-templates"

test("poster email builds one valid print-size PDF attachment for every production template", async () => {
  // Given a merchant with a printable QR and a five-visit card.
  // When the email attachment bundle is generated.
  const attachments = await buildPosterPdfAttachments({
    merchantName: "Old Crown Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    stampsRequired: 5,
  })

  // Then every production poster is present as a readable, single-page A4 PDF.
  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    QR_POSTER_PRODUCTION_TEMPLATES.map(({ id }) => `nabaperks-poster-${id}.pdf`)
  )

  for (const attachment of attachments) {
    assert.match(
      attachment.content,
      /^JVBERi0/,
      `${attachment.filename} is Base64 PDF data`
    )
    const minimumArtworkBytes = 5_000
    assert.ok(
      Buffer.from(attachment.content, "base64").byteLength >
        minimumArtworkBytes,
      `${attachment.filename} contains rendered poster artwork`
    )
    const document = await PDFDocument.load(attachment.content)
    const [page] = document.getPages()
    assert.equal(
      document.getPageCount(),
      1,
      `${attachment.filename} has one page`
    )
    assert.ok(page, `${attachment.filename} includes its A4 page`)
    const expectedWidth = 595.28
    const expectedHeight = 841.89
    assert.ok(
      Math.abs(page.getWidth() - expectedWidth) < 0.2,
      `${attachment.filename} has expected A4 width`
    )
    assert.ok(
      Math.abs(page.getHeight() - expectedHeight) < 0.2,
      `${attachment.filename} has expected A4 height`
    )
  }
})

test("poster PDFs tolerate venue names with glyphs outside the standard PDF font", async () => {
  // Given a valid merchant name containing a glyph unavailable in WinAnsi.
  // When the full proof set is generated, the printed label falls back
  // without losing the merchant's original name from email or app state.
  const attachments = await buildAllPosterPdfAttachments({
    merchantName: "Dragon 🐉 Pub",
    shareUrl: "https://nabaperks.com/q/dragon-pub",
    stampsRequired: 5,
  })

  // Then PDF generation still completes for every registered layout.
  assert.equal(attachments.length, QR_POSTER_TEMPLATES.length)
  for (const attachment of attachments) {
    assert.match(attachment.content, /^JVBERi0/)
  }
})

test("every registered template renders a nonblank single-page A4 proof PDF", async () => {
  const attachments = await buildAllPosterPdfAttachments({
    merchantName: "Old Crown Girton",
    shareUrl: "https://nabaperks.com/q/abc123",
    stampsRequired: 6,
  })

  assert.deepEqual(
    attachments.map(({ filename }) => filename),
    QR_POSTER_TEMPLATES.map(({ id }) => `nabaperks-poster-${id}.pdf`)
  )
  for (const attachment of attachments) {
    const document = await PDFDocument.load(attachment.content)
    assert.equal(document.getPageCount(), 1, attachment.filename)
    assert.ok(
      Buffer.from(attachment.content, "base64").byteLength > 5_000,
      `${attachment.filename} contains rendered poster artwork`
    )
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

test("poster PDF dimensions convert physical QR guidance exactly", () => {
  assert.ok(Math.abs(mm(52) - 147.4) < 0.1)
  assert.ok(Math.abs(mm(55) - 155.91) < 0.1)
})

test("poster PDF venue labels omit unsupported glyphs cleanly", async () => {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.CourierBold)

  assert.equal(standardFontText("DRAGON 🐉 PUB", font), "DRAGON PUB")
  assert.equal(standardFontText("🐉", font), "YOUR VENUE")
})

test("kit venue lines keep a 120-character venue inside the lane", async () => {
  // Given a venue name at the 120-character profile limit and a lane too
  // narrow to hold it even at the floor size.
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.HelveticaBold)
  const drawn = []
  const page = {
    drawText: (text, options) => drawn.push({ text, options }),
  }
  const laneWidth = 300

  // When the venue line is drawn.
  const size = drawKitVenueLine(page, "x".repeat(120), {
    x: 0,
    y: 0,
    maxWidth: laneWidth,
    preferredSize: 19,
    font,
    color: undefined,
  })

  // Then the label steps down and, only past the floor, truncates to fit.
  const [venue] = drawn
  assert.ok(size < 19)
  assert.match(venue.text, /\.\.\.$/)
  assert.ok(font.widthOfTextAtSize(venue.text, size) <= laneWidth)
})
