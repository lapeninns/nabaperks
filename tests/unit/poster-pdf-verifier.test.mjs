import assert from "node:assert/strict"
import { test } from "node:test"

import {
  assertPosterLayoutGeometry,
  parsePdfFonts,
  parsePdfInfo,
} from "../../scripts/verify-poster-pdfs.mjs"

test("poster PDF verifier parses physical page metadata", () => {
  assert.deepEqual(
    parsePdfInfo("Pages: 1\nPage size: 595.276 x 841.89 pts (A4)\n"),
    { pages: 1, widthPt: 595.276, heightPt: 841.89 }
  )
  assert.throws(() => parsePdfInfo("not pdfinfo"), /Invalid pdfinfo output/)
})

test("poster PDF verifier enforces measured A4 safe frames and catalogue hook tiers", () => {
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

test("poster PDF verifier enforces measured B5 rows, rotation, fold corridor, and blank bands", () => {
  const geometry = {
    sheetWidthMm: 176,
    faceHeightMm: 125,
    liveInsetMm: 5,
    identityRowMm: 25,
    mainRowMm: 80,
    lowerOcclusionRowMm: 20,
    foldCorridorMm: 10,
    topRotationDeg: 180,
  }
  const marker = (heightMm, yPositions) =>
    yPositions.map((yMm) => ({ xMm: 5, yMm, widthMm: 166, heightMm }))
  const layout = {
    textClearanceMm: { left: 7, right: 6 },
    qrClearanceMm: { left: 10, right: 10 },
    b5: {
      markers: {
        faces: marker(125, [0, 125]),
        identityRows: marker(25, [100, 125]),
        mainRows: marker(80, [20, 150]),
        blankRows: marker(20, [0, 230]),
        foldHalves: marker(5, [120, 125]),
      },
      rotation: {
        topFace180: true,
        bottomFace0: true,
        topLineCount: 8,
        bottomLineCount: 8,
      },
      clearZones: {
        topBlank20Mm: true,
        foldCorridor10Mm: true,
        bottomBlank20Mm: true,
      },
    },
  }
  const content = { sheet: "b5", geometry }

  assert.deepEqual(
    assertPosterLayoutGeometry(layout, content, "tent.pdf").rowsMm,
    [25, 80, 20]
  )
  assert.throws(
    () =>
      assertPosterLayoutGeometry(
        {
          ...layout,
          b5: {
            ...layout.b5,
            rotation: { ...layout.b5.rotation, topFace180: false },
          },
        },
        content,
        "tent.pdf"
      ),
    /rotated 180 degrees/
  )
  assert.throws(
    () =>
      assertPosterLayoutGeometry(
        {
          ...layout,
          b5: {
            ...layout.b5,
            clearZones: {
              ...layout.b5.clearZones,
              foldCorridor10Mm: false,
            },
          },
        },
        content,
        "tent.pdf"
      ),
    /Expected values to be strictly deep-equal/
  )
  assert.throws(
    () =>
      assertPosterLayoutGeometry(
        {
          ...layout,
          b5: {
            ...layout.b5,
            markers: {
              ...layout.b5.markers,
              mainRows: marker(80, [20, 20]),
            },
          },
        },
        content,
        "tent.pdf"
      ),
    /mainRows at 150 mm on both faces/
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
