import {
  requireNumber,
  requireRecordField,
  sharedRecord,
  sharedString,
  templateNumber,
} from "./poster-design-reader"
import type {
  A4ContentBase,
  PosterDesignId,
  PosterQrModel,
} from "./poster-content-types"
import {
  posterA4TypeTiers,
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
        18
      ),
    },
    fonts: posterFonts(),
    palette: posterPalette(),
    typeTiers: posterA4TypeTiers(templateId),
    qr: posterQr(templateNumber(templateId, "qrOuterMm")),
  }
}
