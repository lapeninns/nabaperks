import assert from "node:assert/strict"
import { after, test } from "node:test"

import { PDFDocument } from "pdf-lib"

import {
  buildGoogleReviewCardPdfAttachment,
  buildGoogleReviewPlatePdfAttachment,
  buildGoogleReviewPdfAttachments,
  closeGoogleReviewPdfBrowser,
} from "@/lib/notifications/google-review-pdf"

const INPUT = {
  merchantName: "Old Crown Girton",
  locality: "Girton",
  reviewUrl:
    "https://search.google.com/local/writereview?placeid=ChIJr-Lmrdt22EcRpM90SQtZug4",
}

after(async () => {
  await closeGoogleReviewPdfBrowser()
})

test(
  "Google review card is a two-page CR80 PDF",
  { timeout: 60_000 },
  async () => {
    const attachment = await buildGoogleReviewCardPdfAttachment(INPUT)

    assert.equal(attachment.filename, "nabaperks-google-card.pdf")
    assert.match(attachment.content, /^JVBERi0/)

    const cr80Width = (85.6 * 72) / 25.4
    const cr80Height = (54 * 72) / 25.4
    const document = await PDFDocument.load(attachment.content)
    assert.equal(document.getPageCount(), 2)
    for (const page of document.getPages()) {
      assert.ok(Math.abs(page.getWidth() - cr80Width) < 1.5, "CR80 width")
      assert.ok(Math.abs(page.getHeight() - cr80Height) < 1.5, "CR80 height")
    }
    assert.ok(Buffer.from(attachment.content, "base64").byteLength > 4_000)
  }
)

test(
  "Google review plate is a single 100×100 mm PDF",
  { timeout: 60_000 },
  async () => {
    const attachment = await buildGoogleReviewPlatePdfAttachment(INPUT)

    assert.equal(attachment.filename, "nabaperks-google-plate.pdf")
    assert.match(attachment.content, /^JVBERi0/)

    const side = (100 * 72) / 25.4
    const document = await PDFDocument.load(attachment.content)
    assert.equal(document.getPageCount(), 1)
    const [page] = document.getPages()
    assert.ok(Math.abs(page.getWidth() - side) < 1.5)
    assert.ok(Math.abs(page.getHeight() - side) < 1.5)
  }
)

test(
  "Google review bundle returns card and plate for a valid review URL",
  { timeout: 90_000 },
  async () => {
    const attachments = await buildGoogleReviewPdfAttachments(INPUT)
    assert.deepEqual(
      attachments.map(({ filename }) => filename),
      ["nabaperks-google-card.pdf", "nabaperks-google-plate.pdf"]
    )
  }
)

test("Google review bundle is empty when the review URL is missing", async () => {
  const attachments = await buildGoogleReviewPdfAttachments({
    merchantName: "Old Crown Girton",
    locality: "Girton",
    reviewUrl: null,
  })
  assert.deepEqual(attachments, [])
})

test(
  "Google review PDFs tolerate venue names with unsupported glyphs",
  { timeout: 90_000 },
  async () => {
    const attachments = await buildGoogleReviewPdfAttachments({
      merchantName: "Dragon 🐉 Pub",
      locality: "Cambridge",
      reviewUrl: INPUT.reviewUrl,
    })
    assert.equal(attachments.length, 2)
    for (const attachment of attachments) {
      assert.match(attachment.content, /^JVBERi0/)
    }
  }
)
