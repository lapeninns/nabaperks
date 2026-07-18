export type PosterDesignId =
  | "editorial"
  | "bold"
  | "ticket"
  | "northstar"
  | "thermal"
  | "table-tent"
  | "table-tent-night"
  | "table-tent-studio"

export type CopyDrivenPosterId = "editorial" | "bold" | "ticket"
export type PosterTableTentId =
  | "table-tent"
  | "table-tent-night"
  | "table-tent-studio"

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

export type B5TypeTierModel = {
  readonly hookPt: number
  readonly substantivePt: number
  readonly factsPt: number
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

export type B5Geometry = {
  readonly sheetWidthMm: 176
  readonly sheetHeightMm: 250
  readonly faceHeightMm: 125
  readonly liveInsetMm: 5
  readonly foldCorridorMm: 10
  readonly identityRowMm: 25
  readonly mainRowMm: 80
  readonly lowerOcclusionRowMm: 20
  readonly topRotationDeg: 180
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

export type B5ContentBase = {
  readonly sheet: "b5"
  readonly reassurance: string
  readonly geometry: B5Geometry
  readonly fonts: PosterFontModel
  readonly palette: PosterPaletteModel
  readonly typeTiers: B5TypeTierModel
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

export type MysteryFaceContent = {
  readonly qr: PosterQrModel
  readonly editionLabel: string
  readonly stack: readonly [string, string, string]
  readonly rewardLine: string
  readonly scanLabel: string
  readonly scanCta: readonly [string, string]
  readonly frictionLine: string
  readonly footerLeft: string
  readonly footerCentre: string
  readonly footerRight: string
}

export type TicketFaceContent = {
  readonly qr: PosterQrModel
  readonly headline: string
  readonly support: string
  readonly frictionLine: string
  readonly qrCaption: string
  readonly reassurance: string
}

export type NightFaceContent = {
  readonly qr: PosterQrModel
  readonly chip: string
  readonly headline: string
  readonly headlineAccent: string
  readonly ease: string
  readonly promise: string
  readonly qrCaption: string
  readonly reassurance: string
}

export type ReceiptFaceContent = {
  readonly qr: PosterQrModel
  readonly meta: string
  readonly headline: string
  readonly headlineAccent: string
  readonly items: readonly ReceiptItem[]
  readonly totalLabel: string
  readonly totalValue: string
  readonly friction: string
  readonly qrCaption: string
  readonly reassurance: string
}

export type EditorialFaceContent = {
  readonly qr: PosterQrModel
  readonly headline: string
  readonly support: string
  readonly frictionLine: string
  readonly qrCaption: string
  readonly reassurance: string
}

export type BoldFaceContent = EditorialFaceContent

export type BaseTentContent = B5ContentBase & {
  readonly id: "table-tent"
  readonly faces: {
    readonly bottom: MysteryFaceContent
    readonly top: TicketFaceContent
  }
}

export type NightTentContent = B5ContentBase & {
  readonly id: "table-tent-night"
  readonly faces: {
    readonly bottom: NightFaceContent
    readonly top: ReceiptFaceContent
  }
}

export type StudioTentContent = B5ContentBase & {
  readonly id: "table-tent-studio"
  readonly faces: {
    readonly bottom: EditorialFaceContent
    readonly top: BoldFaceContent
  }
}

export type PosterContent =
  | CopyDrivenPosterContent
  | NorthstarPosterContent
  | ThermalPosterContent
  | BaseTentContent
  | NightTentContent
  | StudioTentContent
