import type { CounterKitPosterContent } from "./poster-kit-content-types"

export type PosterDesignId =
  | "primer"
  | "window"
  | "pinned"
  | "seal"
  | "tally"
  | "lastcall"
  | "receipt"
  | "chalk"

export type PosterCollectionId = "counter"
export type PosterFormatId = "a4-counter"

/**
 * Registered exposure state. Every rollout state renders on direct request;
 * merchant pickers and the poster email bundle expose "production" only.
 */
export type PosterRollout = "production" | "review" | "experimental"

export type PosterCollection = {
  readonly id: PosterCollectionId
  readonly name: string
  readonly description: string
  readonly format: PosterFormatId
  readonly sheet: "a4"
  readonly revision: number
}

export type PosterTemplateMetadata = {
  readonly id: PosterDesignId
  readonly name: string
  readonly description: string
  readonly useCase: string
  readonly collection: PosterCollectionId
  readonly format: PosterFormatId
  readonly sheet: "a4"
  readonly revision: number
  readonly rollout: PosterRollout
}

/** A headline with one spot-ink phrase, drawn by the PDF accent renderer. */
export type AccentHeadline = {
  readonly beforeAccent: string
  readonly accent: string
  readonly afterAccent: string
}

export type PosterQrModel = {
  readonly outerMm: number
  readonly quietZoneModules: 4
  readonly errorCorrectionLevel: "H"
  readonly ink: "#111111"
  readonly background: "#ffffff"
}

export type PosterFontModel = {
  readonly display: {
    readonly family: "Bricolage Grotesque"
    readonly regularFile: "BricolageGrotesque-Regular.ttf"
    readonly boldFile: "BricolageGrotesque-Bold.ttf"
  }
  readonly mono: {
    readonly family: "Space Mono"
    readonly regularFile: "SpaceMono-Regular.ttf"
    readonly boldFile: "SpaceMono-Bold.ttf"
  }
}

export type PosterPaletteModel = {
  readonly paper: "#f6f1e6"
  readonly paperDeep: "#ece5d4"
  readonly ink: "#211c16"
  readonly inkSoft: "#4f473d"
  readonly accent: "#cf330a"
  readonly sun: "#f5a623"
  readonly leaf: "#16733c"
  readonly cobalt: "#2b43c8"
  readonly white: "#ffffff"
}

export type A4TypeTierModel = {
  readonly hookPt: number
  readonly substantivePt: number
  readonly factsPt: number
}

export type A4Geometry = {
  readonly sheetWidthMm: 210
  readonly sheetHeightMm: 297
  readonly safeMarginMm: 18
}

export type A4ContentBase = {
  readonly sheet: "a4"
  readonly reassurance: string
  readonly geometry: A4Geometry
  readonly fonts: PosterFontModel
  readonly palette: PosterPaletteModel
  readonly typeTiers: A4TypeTierModel
  readonly qr: PosterQrModel
}

export type PosterContent = CounterKitPosterContent
