import {
  faceNumber,
  requireNumber,
  requireRecordField,
  sharedRecord,
  sharedString,
  templateNumber,
} from "./poster-design-reader"
import type {
  A4ContentBase,
  B5ContentBase,
  PosterDesignId,
  PosterQrModel,
  PosterTableTentId,
} from "./poster-content-types"
import {
  posterA4TypeTiers,
  posterB5TypeTiers,
  posterFonts,
  posterPalette,
  posterQrDefaults,
} from "./poster-token-readers"

function exactNumber<const Value extends number>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  expected: Value
): Value {
  const value = requireNumber(record, key, path)
  if (value !== expected) {
    throw new Error(`Expected ${expected} at ${path}.${key}`)
  }
  return expected
}

function posterQr(outerMm: number): PosterQrModel {
  return { outerMm, ...posterQrDefaults() }
}

export function a4ContentBase(templateId: PosterDesignId): A4ContentBase {
  const geometry = requireRecordField(
    sharedRecord("geometry"),
    "a4",
    "posterDesigns.shared.geometry"
  )
  return {
    sheet: "a4",
    reassurance: sharedString("reassurance"),
    geometry: {
      sheetWidthMm: exactNumber(
        geometry,
        "sheetWidthMm",
        "posterDesigns.shared.geometry.a4",
        210
      ),
      sheetHeightMm: exactNumber(
        geometry,
        "sheetHeightMm",
        "posterDesigns.shared.geometry.a4",
        297
      ),
      safeMarginMm: exactNumber(
        geometry,
        "safeMarginMm",
        "posterDesigns.shared.geometry.a4",
        15
      ),
    },
    fonts: posterFonts(),
    palette: posterPalette(),
    typeTiers: posterA4TypeTiers(templateId),
    qr: posterQr(templateNumber(templateId, "qrOuterMm")),
  }
}

export function b5ContentBase(): B5ContentBase {
  const geometry = requireRecordField(
    sharedRecord("geometry"),
    "b5",
    "posterDesigns.shared.geometry"
  )
  const path = "posterDesigns.shared.geometry.b5"
  return {
    sheet: "b5",
    reassurance: sharedString("reassurance"),
    geometry: {
      sheetWidthMm: exactNumber(geometry, "sheetWidthMm", path, 176),
      sheetHeightMm: exactNumber(geometry, "sheetHeightMm", path, 250),
      faceHeightMm: exactNumber(geometry, "faceHeightMm", path, 125),
      liveInsetMm: exactNumber(geometry, "liveInsetMm", path, 5),
      foldCorridorMm: exactNumber(geometry, "foldCorridorMm", path, 10),
      identityRowMm: exactNumber(geometry, "identityRowMm", path, 25),
      mainRowMm: exactNumber(geometry, "mainRowMm", path, 80),
      lowerOcclusionRowMm: exactNumber(
        geometry,
        "lowerOcclusionRowMm",
        path,
        20
      ),
      topRotationDeg: exactNumber(geometry, "topRotationDeg", path, 180),
    },
    fonts: posterFonts(),
    palette: posterPalette(),
    typeTiers: posterB5TypeTiers(),
  }
}

export function b5FaceQr(
  templateId: PosterTableTentId,
  face: "top" | "bottom"
): PosterQrModel {
  return posterQr(faceNumber(templateId, face, "qrOuterMm"))
}
