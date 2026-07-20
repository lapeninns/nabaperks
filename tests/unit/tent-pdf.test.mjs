import assert from "node:assert/strict"
import { test } from "node:test"

import { PDFDocument, StandardFonts } from "pdf-lib"

import { drawTentFace } from "@/lib/notifications/tent-pdf-face"
import { TENT_TYPE } from "@/lib/notifications/tent-pdf-typography"
import {
  buildAllTentPdfAttachments,
  buildTentPdfAttachments,
} from "@/lib/notifications/tent-pdf"
import { mm } from "@/lib/notifications/poster-pdf-style"
import { resolveTentContent } from "@/lib/qr/tent-content"
import {
  TENT_DESIGN_IDS,
  TENT_PRODUCTION_DESIGNS,
} from "@/lib/qr/tent-templates"

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

test("tent faces obey the locked type scale on every design", async () => {
  // Given real catalogue content drawn through a recording page stub.
  const document = await PDFDocument.create()
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    mono: await document.embedFont(StandardFonts.Courier),
    monoBold: await document.embedFont(StandardFonts.CourierBold),
  }
  const qrModules = { size: 21, get: () => false }

  for (const design of TENT_DESIGN_IDS) {
    const content = resolveTentContent(design, 5)
    for (const face of [content.faceA, content.faceB]) {
      const drawn = []
      const page = {
        drawText: (text, options) => drawn.push({ text, ...options }),
        drawRectangle: () => {},
        drawCircle: () => {},
        drawLine: () => {},
        pushOperators: () => {},
      }
      drawTentFace(page, content, face, {
        originX: mm(5),
        originY: mm(5),
        width: mm(200),
        height: mm(138.5),
        venue: "Old Crown Girton",
        fonts,
        qrModules,
      })

      // Then the headline sets at one fitted display size inside the hook
      // band — never the old fixed 26 pt path.
      const headline = drawn.filter((item) =>
        face.headline.some((line) => item.text === line.toUpperCase())
      )
      assert.equal(
        headline.length,
        face.headline.length,
        `${design} ${face.variant} headline lines`
      )
      const [first] = headline
      assert.ok(headline.every(({ size }) => size === first.size))
      assert.ok(first.size >= TENT_TYPE.hookMinPt)
      assert.ok(first.size <= TENT_TYPE.hookMaxPt)
      // Display leading mirrors product TentFace (tight 0.92× step).
      for (let index = 1; index < headline.length; index += 1) {
        const step = headline[index - 1].y - headline[index].y
        assert.ok(
          step >= first.size * TENT_TYPE.displayLeading - 0.01,
          `${design} ${face.variant} display leading`
        )
        assert.ok(
          step <= first.size * TENT_TYPE.displayLeading + 0.01,
          `${design} ${face.variant} display leading match`
        )
      }

      // Product body is bold at the locked body tier.
      const body = drawn.filter(
        (item) =>
          item.font === fonts.bold &&
          item.size === TENT_TYPE.bodyPt &&
          !face.headline.some((line) => item.text === line.toUpperCase())
      )
      assert.ok(body.length > 0, `${design} ${face.variant} bold body`)

      // Brand pieces share the rail baseline with the kicker label.
      const brandA = drawn.find(
        (item) =>
          item.text === "a" &&
          item.size === TENT_TYPE.brandPt &&
          item.font === fonts.bold
      )
      assert.ok(brandA, `${design} ${face.variant} brand accent`)
      const kicker = drawn.find(
        (item) =>
          item.size === TENT_TYPE.kickerPt &&
          item.y === brandA.y &&
          item.font === fonts.monoBold
      )
      assert.ok(kicker, `${design} ${face.variant} shared rail baseline`)
    }
  }
})
