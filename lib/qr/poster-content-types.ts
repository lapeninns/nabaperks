export type PosterDesignId =
  | "editorial"
  | "bold"
  | "ticket"
  | "northstar"
  | "thermal"

export type CopyDrivenPosterId = "editorial" | "bold" | "ticket"
export type PosterCollectionId = "counter"
export type PosterFormatId = "a4-counter"

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
}

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
  readonly safeMarginMm: 15
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

export type CopyDrivenPosterContent = A4ContentBase & {
  readonly id: CopyDrivenPosterId
  readonly headline: AccentHeadline
  readonly support: string
  readonly rewardDetail: string
  readonly frictionLine: string
  readonly qrCaption: string
  readonly progress: string
}

export type NorthstarPosterContent = A4ContentBase & {
  readonly id: "northstar"
  readonly headline: string
  readonly headlineAccent: string
  readonly ease: string
  readonly chip: string
  readonly qrCaption: string
  readonly promise: string
}

export type ReceiptItem = {
  readonly label: string
  readonly value: string
  readonly accent: boolean
}

export type ThermalPosterContent = A4ContentBase & {
  readonly id: "thermal"
  readonly meta: string
  readonly friction: string
  readonly headline: string
  readonly headlineAccent: string
  readonly items: readonly ReceiptItem[]
  readonly totalLabel: string
  readonly totalValue: string
  readonly qrCaption: string
}

export type PosterContent =
  | CopyDrivenPosterContent
  | NorthstarPosterContent
  | ThermalPosterContent
