import assert from "node:assert/strict"
import test from "node:test"

import { PDFDocument } from "pdf-lib"

import { mergePdfBase64Documents } from "@/lib/notifications/print-kit-pdf-merge"
import {
  duplexPosterFilename,
  QR_POSTER_PRODUCTION_DUPLEX_PAIRS,
} from "@/lib/qr/poster-duplex-pairs"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"

test("duplex pairs cover each production poster exactly once", () => {
  const production = new Set(QR_POSTER_PRODUCTION_TEMPLATES.map(({ id }) => id))
  const paired = []
  for (const { front, back } of QR_POSTER_PRODUCTION_DUPLEX_PAIRS) {
    paired.push(front, back)
  }
  assert.equal(QR_POSTER_PRODUCTION_DUPLEX_PAIRS.length, 4)
  assert.equal(paired.length, production.size)
  assert.deepEqual(new Set(paired), production)
})

test("duplex poster filenames use front-back kebab ids", () => {
  assert.equal(
    duplexPosterFilename(QR_POSTER_PRODUCTION_DUPLEX_PAIRS[0]),
    "nabaperks-poster-primer-lastcall.pdf"
  )
})

test("mergePdfBase64Documents concatenates pages", async () => {
  async function onePagePdf() {
    const doc = await PDFDocument.create()
    doc.addPage([210, 297])
    return Buffer.from(await doc.save()).toString("base64")
  }
  const merged = await mergePdfBase64Documents([
    await onePagePdf(),
    await onePagePdf(),
  ])
  const loaded = await PDFDocument.load(Buffer.from(merged, "base64"))
  assert.equal(loaded.getPageCount(), 2)
})
