import {
  requireNumber,
  requireRecordField,
  requireString,
  sharedRecord,
  templateRecordField,
} from "./poster-design-reader"
import type {
  A4TypeTierModel,
  PosterDesignId,
  PosterFontModel,
  PosterPaletteModel,
  PosterQrModel,
} from "./poster-content-types"

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

export function posterFonts(): PosterFontModel {
  const tokens = sharedRecord("tokens")
  const fonts = requireRecordField(
    tokens,
    "fonts",
    "posterDesigns.shared.tokens"
  )
  const display = requireRecordField(
    fonts,
    "display",
    "posterDesigns.shared.tokens.fonts"
  )
  const mono = requireRecordField(
    fonts,
    "mono",
    "posterDesigns.shared.tokens.fonts"
  )
  return {
    display: {
      family: exactString(
        display,
        "family",
        "posterDesigns.shared.tokens.fonts.display",
        "Bricolage Grotesque"
      ),
      regularFile: exactString(
        display,
        "regularFile",
        "posterDesigns.shared.tokens.fonts.display",
        "BricolageGrotesque-Regular.ttf"
      ),
      boldFile: exactString(
        display,
        "boldFile",
        "posterDesigns.shared.tokens.fonts.display",
        "BricolageGrotesque-Bold.ttf"
      ),
    },
    mono: {
      family: exactString(
        mono,
        "family",
        "posterDesigns.shared.tokens.fonts.mono",
        "Space Mono"
      ),
      regularFile: exactString(
        mono,
        "regularFile",
        "posterDesigns.shared.tokens.fonts.mono",
        "SpaceMono-Regular.ttf"
      ),
      boldFile: exactString(
        mono,
        "boldFile",
        "posterDesigns.shared.tokens.fonts.mono",
        "SpaceMono-Bold.ttf"
      ),
    },
  }
}

export function posterPalette(): PosterPaletteModel {
  const tokens = sharedRecord("tokens")
  const path = "posterDesigns.shared.tokens"
  return {
    paper: exactString(tokens, "paper", path, "#f6f1e6"),
    paperDeep: exactString(tokens, "paperDeep", path, "#ece5d4"),
    ink: exactString(tokens, "ink", path, "#211c16"),
    inkSoft: exactString(tokens, "inkSoft", path, "#4f473d"),
    accent: exactString(tokens, "accent", path, "#cf330a"),
    sun: exactString(tokens, "sun", path, "#f5a623"),
    leaf: exactString(tokens, "leaf", path, "#16733c"),
    cobalt: exactString(tokens, "cobalt", path, "#2b43c8"),
    white: exactString(tokens, "white", path, "#ffffff"),
  }
}

export function posterA4TypeTiers(templateId: PosterDesignId): A4TypeTierModel {
  const sharedTiers = sharedRecord("typeTiersPt")
  const tiers = templateRecordField(templateId, "typeTiersPt")
  const path = `posterDesigns.templates.${templateId}.typeTiersPt`

  function templateTier(
    name: string,
    minimumName: string,
    maximumName: string
  ): number {
    const value = requireNumber(tiers, name, path)
    const minimum = requireNumber(
      sharedTiers,
      minimumName,
      "posterDesigns.shared.typeTiersPt"
    )
    const maximum = requireNumber(
      sharedTiers,
      maximumName,
      "posterDesigns.shared.typeTiersPt"
    )
    if (value < minimum || value > maximum) {
      throw new Error(
        `Expected ${path}.${name} between ${minimum} and ${maximum}`
      )
    }
    return value
  }

  return {
    hookPt: templateTier("hook", "a4HookMin", "a4HookMax"),
    substantivePt: templateTier(
      "substantive",
      "a4SubstantiveMin",
      "a4SubstantiveMax"
    ),
    factsPt: templateTier("facts", "a4FactsMin", "a4FactsMax"),
  }
}

export function posterQrDefaults(): Omit<PosterQrModel, "outerMm"> {
  const qr = sharedRecord("qr")
  const tokens = sharedRecord("tokens")
  return {
    quietZoneModules: exactNumber(
      qr,
      "quietZoneModules",
      "posterDesigns.shared.qr",
      4
    ),
    errorCorrectionLevel: exactString(
      qr,
      "errorCorrectionLevel",
      "posterDesigns.shared.qr",
      "H"
    ),
    ink: exactString(tokens, "qr", "posterDesigns.shared.tokens", "#111111"),
    background: exactString(
      tokens,
      "qrBg",
      "posterDesigns.shared.tokens",
      "#ffffff"
    ),
  }
}
