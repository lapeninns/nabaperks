import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

import {
  fitSingleLineText,
  mm,
  standardFontText,
} from "@/lib/notifications/poster-pdf-style"
import { drawIdentityRail } from "@/lib/notifications/poster-pdf-layout"
import { buildPosterPdfAttachments } from "@/lib/notifications/poster-pdf"
import { QR_POSTER_TEMPLATES } from "@/lib/qr/poster-templates"

test("poster email builds one valid print-size PDF attachment for every registered template", async () => {
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

test("identity rail truncates a 120-character venue inside the rail", async () => {
  // Given a venue name at the 120-character profile limit and a rail too
  // narrow to hold it even at the minimum 6pt size.
  const document = await PDFDocument.create()
  const fonts = {
    regular: await document.embedFont(StandardFonts.Courier),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    mono: await document.embedFont(StandardFonts.Courier),
    monoBold: await document.embedFont(StandardFonts.CourierBold),
  }
  const drawn = []
  const page = {
    drawText: (text, options) => drawn.push({ text, options }),
    drawRectangle: () => {},
  }
  const railWidth = 300

  // When the identity rail is drawn.
  drawIdentityRail(page, {
    merchantName: "x".repeat(120),
    x: 0,
    y: 0,
    width: railWidth,
    height: 24,
    foreground: rgb(0, 0, 0),
    accent: rgb(1, 0, 0),
    fonts,
  })

  // Then the venue label is truncated with dots and fits the rail.
  const [venue] = drawn
  assert.match(venue.text, /\.\.\.$/)
  assert.ok(
    fonts.monoBold.widthOfTextAtSize(venue.text, venue.options.size) < railWidth
  )
})
