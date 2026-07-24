import {
  requireNumber,
  requireRecordField,
  requireString,
} from "./poster-json-readers"
import {
  nfcSquareSharedArray,
  nfcSquareSharedRecord,
  nfcSquareSharedString,
} from "./nfc-square-design-reader"
import type {
  NfcSquareFontModel,
  NfcSquareGeometry,
  NfcSquarePaletteModel,
  NfcSquareQrModel,
  NfcSquareTypeTiers,
} from "./nfc-square-content-types"

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g

export function validateNfcSquareStamps(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error("NFC square stampsRequired must be an integer from 1 to 6")
  }
  return value
}

function numberWord(stampsRequired: number): string {
  const words = nfcSquareSharedArray("numberWords")
  const word = words[stampsRequired]
  return typeof word === "string" ? word : String(stampsRequired)
}

export function resolveNfcSquareText(
  value: string,
  stampsRequired: number
): string {
  const stamps = validateNfcSquareStamps(stampsRequired)
  const resolved = value.replace(PLACEHOLDER_PATTERN, (token, name: string) => {
    if (name === "stamps") return String(stamps)
    if (name === "StampsWord") {
      const word = numberWord(stamps)
      return word.charAt(0).toUpperCase() + word.slice(1)
    }
    throw new Error(`Unsupported NFC square placeholder ${token}`)
  })
  if (resolved.includes("{") || resolved.includes("}")) {
    throw new Error(`Unresolved NFC square placeholder in ${value}`)
  }
  return resolved
}

function exactString<const Value extends string>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  expected: Value
): Value {
  if (requireString(record, key, path) !== expected) {
    throw new Error(`Expected ${expected} at ${path}.${key}`)
  }
  return expected
}

function exactNumber<const Value extends number>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  expected: Value
): Value {
  if (requireNumber(record, key, path) !== expected) {
    throw new Error(`Expected ${expected} at ${path}.${key}`)
  }
  return expected
}

export function nfcSquareGeometry(): NfcSquareGeometry {
  const square = requireRecordField(
    nfcSquareSharedRecord("geometry"),
    "square",
    "nfcSquareDesigns.shared.geometry"
  )
  const path = "nfcSquareDesigns.shared.geometry.square"
  return {
    cardWidthMm: exactNumber(square, "cardWidthMm", path, 100),
    cardHeightMm: exactNumber(square, "cardHeightMm", path, 100),
    cornerRadiusMm: requireNumber(square, "cornerRadiusMm", path),
    frameInsetMm: requireNumber(square, "frameInsetMm", path),
    qrOuterMm: requireNumber(square, "qrOuterMm", path),
    googleReviewQrOuterMm: requireNumber(square, "googleReviewQrOuterMm", path),
  }
}

export function nfcSquareQr(): NfcSquareQrModel {
  const qr = nfcSquareSharedRecord("qr")
  const tokens = nfcSquareSharedRecord("tokens")
  const geometry = nfcSquareGeometry()
  const path = "nfcSquareDesigns.shared.qr"
  return {
    outerMm: geometry.qrOuterMm,
    quietZoneModules: exactNumber(qr, "quietZoneModules", path, 4),
    errorCorrectionLevel: exactString(qr, "errorCorrectionLevel", path, "H"),
    ink: exactString(tokens, "qr", "nfcSquareDesigns.shared.tokens", "#111111"),
    background: exactString(
      tokens,
      "qrBg",
      "nfcSquareDesigns.shared.tokens",
      "#ffffff"
    ),
  }
}

export function nfcSquarePalette(): NfcSquarePaletteModel {
  const t = nfcSquareSharedRecord("tokens")
  const p = "nfcSquareDesigns.shared.tokens"
  return {
    paper: exactString(t, "paper", p, "#f6f1e6"),
    paperDeep: exactString(t, "paperDeep", p, "#ece5d4"),
    card: exactString(t, "card", p, "#fbf8f1"),
    ink: exactString(t, "ink", p, "#211c16"),
    inkSoft: exactString(t, "inkSoft", p, "#4f473d"),
    accent: exactString(t, "accent", p, "#cf330a"),
    sun: exactString(t, "sun", p, "#f5a623"),
    leaf: exactString(t, "leaf", p, "#16733c"),
    cobalt: exactString(t, "cobalt", p, "#2b43c8"),
    white: exactString(t, "white", p, "#ffffff"),
  }
}

export function nfcSquareFonts(): NfcSquareFontModel {
  const fonts = requireRecordField(
    nfcSquareSharedRecord("tokens"),
    "fonts",
    "nfcSquareDesigns.shared.tokens"
  )
  const display = requireRecordField(
    fonts,
    "display",
    "nfcSquareDesigns.shared.tokens.fonts"
  )
  const mono = requireRecordField(
    fonts,
    "mono",
    "nfcSquareDesigns.shared.tokens.fonts"
  )
  const dp = "nfcSquareDesigns.shared.tokens.fonts.display"
  const mp = "nfcSquareDesigns.shared.tokens.fonts.mono"
  return {
    display: {
      family: exactString(display, "family", dp, "Bricolage Grotesque"),
      regularFile: exactString(
        display,
        "regularFile",
        dp,
        "BricolageGrotesque-Regular.ttf"
      ),
      boldFile: exactString(
        display,
        "boldFile",
        dp,
        "BricolageGrotesque-Bold.ttf"
      ),
    },
    mono: {
      family: exactString(mono, "family", mp, "Space Mono"),
      regularFile: exactString(
        mono,
        "regularFile",
        mp,
        "SpaceMono-Regular.ttf"
      ),
      boldFile: exactString(mono, "boldFile", mp, "SpaceMono-Bold.ttf"),
    },
  }
}

export function nfcSquareTypeTiers(): NfcSquareTypeTiers {
  const tiers = nfcSquareSharedRecord("typeTiersPt")
  const path = "nfcSquareDesigns.shared.typeTiersPt"
  return {
    floorPt: requireNumber(tiers, "floor", path),
    metaPt: requireNumber(tiers, "meta", path),
    bodyPt: requireNumber(tiers, "body", path),
    titlePt: requireNumber(tiers, "title", path),
    displayPt: requireNumber(tiers, "display", path),
    sealPt: requireNumber(tiers, "seal", path),
  }
}

export function nfcSquareReassurance(): string {
  return nfcSquareSharedString("reassurance")
}

export function nfcSquareFriction(): string {
  return nfcSquareSharedString("friction")
}

export function nfcSquareClaimFriction(): string {
  return nfcSquareSharedString("claimFriction")
}

export function nfcSquareDieRule(): string {
  return nfcSquareSharedString("dieRule")
}

export function requireNfcSquareStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string
): readonly string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`)
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Expected string at ${path}.${key}[${index}]`)
    }
    return entry
  })
}
