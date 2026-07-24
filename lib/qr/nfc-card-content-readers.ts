import {
  requireArray,
  requireNumber,
  requireRecordField,
  requireString,
} from "./poster-json-readers"
import {
  nfcCardSharedArray,
  nfcCardSharedRecord,
  nfcCardSharedString,
} from "./nfc-card-design-reader"
import type {
  NfcCardFontModel,
  NfcCardGeometry,
  NfcCardPaletteModel,
  NfcCardQrModel,
  NfcCardTypeTiers,
} from "./nfc-card-content-types"

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g

export function validateNfcCardStamps(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error("NFC card stampsRequired must be an integer from 1 to 6")
  }
  return value
}

function numberWord(stampsRequired: number): string {
  const words = nfcCardSharedArray("numberWords")
  const word = words[stampsRequired]
  return typeof word === "string" ? word : String(stampsRequired)
}

export function resolveNfcCardText(
  value: string,
  stampsRequired: number
): string {
  const stamps = validateNfcCardStamps(stampsRequired)
  const resolved = value.replace(PLACEHOLDER_PATTERN, (token, name: string) => {
    if (name === "stamps") return String(stamps)
    if (name === "StampsWord") {
      const word = numberWord(stamps)
      return word.charAt(0).toUpperCase() + word.slice(1)
    }
    throw new Error(`Unsupported NFC card placeholder ${token}`)
  })
  if (resolved.includes("{") || resolved.includes("}")) {
    throw new Error(`Unresolved NFC card placeholder in ${value}`)
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

export function nfcCardGeometry(): NfcCardGeometry {
  const cr80 = requireRecordField(
    nfcCardSharedRecord("geometry"),
    "cr80",
    "nfcCardDesigns.shared.geometry"
  )
  const path = "nfcCardDesigns.shared.geometry.cr80"
  return {
    cardWidthMm: exactNumber(cr80, "cardWidthMm", path, 85.5),
    cardHeightMm: exactNumber(cr80, "cardHeightMm", path, 54),
    cornerRadiusMm: requireNumber(cr80, "cornerRadiusMm", path),
    frameInsetMm: requireNumber(cr80, "frameInsetMm", path),
    qrOuterMm: requireNumber(cr80, "qrOuterMm", path),
    googleReviewQrOuterMm: requireNumber(cr80, "googleReviewQrOuterMm", path),
  }
}

export function nfcCardQr(): NfcCardQrModel {
  const qr = nfcCardSharedRecord("qr")
  const tokens = nfcCardSharedRecord("tokens")
  const geometry = nfcCardGeometry()
  const path = "nfcCardDesigns.shared.qr"
  return {
    outerMm: geometry.qrOuterMm,
    quietZoneModules: exactNumber(qr, "quietZoneModules", path, 4),
    errorCorrectionLevel: exactString(qr, "errorCorrectionLevel", path, "H"),
    ink: exactString(tokens, "qr", "nfcCardDesigns.shared.tokens", "#111111"),
    background: exactString(
      tokens,
      "qrBg",
      "nfcCardDesigns.shared.tokens",
      "#ffffff"
    ),
  }
}

export function nfcCardPalette(): NfcCardPaletteModel {
  const t = nfcCardSharedRecord("tokens")
  const p = "nfcCardDesigns.shared.tokens"
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

export function nfcCardFonts(): NfcCardFontModel {
  const fonts = requireRecordField(
    nfcCardSharedRecord("tokens"),
    "fonts",
    "nfcCardDesigns.shared.tokens"
  )
  const display = requireRecordField(
    fonts,
    "display",
    "nfcCardDesigns.shared.tokens.fonts"
  )
  const mono = requireRecordField(
    fonts,
    "mono",
    "nfcCardDesigns.shared.tokens.fonts"
  )
  const dp = "nfcCardDesigns.shared.tokens.fonts.display"
  const mp = "nfcCardDesigns.shared.tokens.fonts.mono"
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

export function nfcCardTypeTiers(): NfcCardTypeTiers {
  const tiers = nfcCardSharedRecord("typeTiersPt")
  const path = "nfcCardDesigns.shared.typeTiersPt"
  return {
    floorPt: requireNumber(tiers, "floor", path),
    metaPt: requireNumber(tiers, "meta", path),
    bodyPt: requireNumber(tiers, "body", path),
    titlePt: requireNumber(tiers, "title", path),
    displayPt: requireNumber(tiers, "display", path),
    sealPt: requireNumber(tiers, "seal", path),
  }
}

export function nfcCardReassurance(): string {
  return nfcCardSharedString("reassurance")
}

export function nfcCardDieRule(): string {
  return nfcCardSharedString("dieRule")
}

export function nfcCardFriction(): string {
  return nfcCardSharedString("friction")
}

export function nfcCardClaimFriction(): string {
  return nfcCardSharedString("claimFriction")
}

export function requireStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string
): readonly string[] {
  return requireArray(record, key, path).map((value, index) => {
    if (typeof value !== "string") {
      throw new Error(`Expected NFC card string at ${path}.${key}[${index}]`)
    }
    return value
  })
}
