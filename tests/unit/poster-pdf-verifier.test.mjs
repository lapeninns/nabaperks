import assert from "node:assert/strict"
import { test } from "node:test"

import {
  assertPosterLayoutGeometry,
  parsePdfFonts,
  parsePdfInfo,
} from "../../scripts/verify-poster-pdfs.mjs"

test("poster PDF verifier parses physical A4 page metadata", () => {
  assert.deepEqual(
    parsePdfInfo("Pages: 1\nPage size: 595.276 x 841.89 pts (A4)\n"),
    { pages: 1, widthPt: 595.276, heightPt: 841.89 }
  )
  assert.throws(() => parsePdfInfo("not pdfinfo"), /Invalid pdfinfo output/)
})

test("poster PDF verifier enforces A4 safe frames and hook tiers", () => {
  const content = {
    sheet: "a4",
    geometry: { safeMarginMm: 15 },
    typeTiers: { hookPt: 60 },
  }
  const layout = {
    maxTextPt: 60,
    textClearanceMm: { left: 18, top: 19, right: 17, bottom: 16 },
    qrClearanceMm: { left: 100, top: 100, right: 15, bottom: 52 },
  }

  assert.equal(
    assertPosterLayoutGeometry(layout, content, "a4.pdf").safeMarginMm,
    15
  )
  assert.throws(
    () =>
      assertPosterLayoutGeometry(
        {
          ...layout,
          textClearanceMm: { ...layout.textClearanceMm, left: 10 },
        },
        content,
        "a4.pdf"
      ),
    /safe frame/
  )
  assert.throws(
    () =>
      assertPosterLayoutGeometry(
        { ...layout, maxTextPt: 55 },
        content,
        "a4.pdf"
      ),
    /hook tier/
  )
})

test("poster PDF verifier recognises embedded subset Unicode fonts", () => {
  const output = [
    "name type encoding emb sub uni object ID",
    "------------------------------------",
    "NABSMB+SpaceMono-Bold CID TrueType Identity-H yes yes yes 7 0",
    "NABBOL+BricolageGrotesque-Bold CID TrueType Identity-H yes yes yes 5 0",
  ].join("\n")
  assert.deepEqual(parsePdfFonts(output), [
    {
      name: "NABSMB+SpaceMono-Bold",
      embedded: true,
      subset: true,
      unicode: true,
    },
    {
      name: "NABBOL+BricolageGrotesque-Bold",
      embedded: true,
      subset: true,
      unicode: true,
    },
  ])
})
