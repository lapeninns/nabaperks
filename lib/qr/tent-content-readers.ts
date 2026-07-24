import {
  requireArray,
  requireNumber,
  requireRecordField,
  requireString,
} from "./poster-json-readers"
import {
  tentSharedArray,
  tentSharedRecord,
  tentSharedString,
} from "./tent-design-reader"
import type {
  TentFontModel,
  TentFooterModel,
  TentGeometry,
  TentPaletteModel,
  TentQrModel,
  TentTypeTiers,
} from "./tent-content-types"

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g

export function validateTentStamps(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error("Table-tent stampsRequired must be an integer from 1 to 6")
  }
  return value
}

function numberWord(stampsRequired: number): string {
  const words = tentSharedArray("numberWords")
  const word = words[stampsRequired]
  return typeof word === "string" ? word : String(stampsRequired)
}

export function resolveTentText(value: string, stampsRequired: number): string {
  const stamps = validateTentStamps(stampsRequired)
  const resolved = value.replace(PLACEHOLDER_PATTERN, (token, name: string) => {
    if (name === "stamps") return String(stamps)
    if (name === "StampsWord") {
      const word = numberWord(stamps)
      return word.charAt(0).toUpperCase() + word.slice(1)
    }
    throw new Error(`Unsupported table-tent placeholder ${token}`)
  })
  if (resolved.includes("{") || resolved.includes("}")) {
    throw new Error(`Unresolved table-tent placeholder in ${value}`)
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

export function tentGeometry(): TentGeometry {
  const a4 = requireRecordField(
    tentSharedRecord("geometry"),
    "a4",
    "tableTentDesigns.shared.geometry"
  )
  const path = "tableTentDesigns.shared.geometry.a4"
  return {
    sheetWidthMm: exactNumber(a4, "sheetWidthMm", path, 210),
    sheetHeightMm: exactNumber(a4, "sheetHeightMm", path, 297),
    faceWidthMm: exactNumber(a4, "faceWidthMm", path, 210),
    faceHeightMm: exactNumber(a4, "faceHeightMm", path, 148.5),
    foldAtMm: exactNumber(a4, "foldAtMm", path, 148.5),
    faceInsetMm: exactNumber(a4, "faceInsetMm", path, 5),
  }
}

export function tentQr(): TentQrModel {
  const qr = tentSharedRecord("qr")
  const tokens = tentSharedRecord("tokens")
  const path = "tableTentDesigns.shared.qr"
  return {
    outerMm: requireNumber(qr, "outerMm", path),
    quietZoneModules: exactNumber(qr, "quietZoneModules", path, 4),
    errorCorrectionLevel: exactString(qr, "errorCorrectionLevel", path, "H"),
    ink: exactString(tokens, "qr", "tableTentDesigns.shared.tokens", "#111111"),
    background: exactString(
      tokens,
      "qrBg",
      "tableTentDesigns.shared.tokens",
      "#ffffff"
    ),
  }
}

export function tentPalette(): TentPaletteModel {
  const t = tentSharedRecord("tokens")
  const p = "tableTentDesigns.shared.tokens"
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

export function tentFonts(): TentFontModel {
  const fonts = requireRecordField(
    tentSharedRecord("tokens"),
    "fonts",
    "tableTentDesigns.shared.tokens"
  )
  const display = requireRecordField(
    fonts,
    "display",
    "tableTentDesigns.shared.tokens.fonts"
  )
  const mono = requireRecordField(
    fonts,
    "mono",
    "tableTentDesigns.shared.tokens.fonts"
  )
  const dp = "tableTentDesigns.shared.tokens.fonts.display"
  const mp = "tableTentDesigns.shared.tokens.fonts.mono"
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

export function tentFooter(): TentFooterModel {
  const footer = tentSharedRecord("footer")
  const path = "tableTentDesigns.shared.footer"
  return {
    left: requireString(footer, "left", path),
    right: requireString(footer, "right", path),
  }
}

export function tentTypeTiers(): TentTypeTiers {
  const tiers = tentSharedRecord("typeTiersCqw")
  const path = "tableTentDesigns.shared.typeTiersCqw"
  return {
    hookCqw: requireNumber(tiers, "hook", path),
    bodyCqw: requireNumber(tiers, "body", path),
    metaCqw: requireNumber(tiers, "meta", path),
  }
}

export function tentKicker(): string {
  return tentSharedString("kicker")
}

export function tentReassurance(): string {
  return tentSharedString("reassurance")
}

export function tentFriction(): string {
  return tentSharedString("friction")
}

export function requireStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string
): readonly string[] {
  return requireArray(record, key, path).map((value, index) => {
    if (typeof value !== "string") {
      throw new Error(`Expected table-tent string at ${path}.${key}[${index}]`)
    }
    return value
  })
}
