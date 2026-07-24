export type TentDesignId =
  | "regulars"
  | "welcome"
  | "sealed"
  | "today"
  | "classic"

export type TentRollout = "production" | "review" | "experimental"

/** The visual treatment a face renders in — colourway plus emphasis. */
export type TentFaceVariant =
  | "loss"
  | "social"
  | "sealed"
  | "plan"
  | "urgency"
  | "scan"
  | "claim"

export type TentFaceTone = "paper" | "ink" | "sealed"

export type TentCollection = {
  readonly id: "table-tent"
  readonly name: string
  readonly description: string
  readonly format: "a4-tent"
  readonly sheet: "a4"
  readonly revision: number
}

export type TentGeometry = {
  readonly sheetWidthMm: 210
  readonly sheetHeightMm: 297
  readonly faceWidthMm: 210
  readonly faceHeightMm: 148.5
  readonly foldAtMm: 148.5
  readonly faceInsetMm: 5
}

export type TentQrModel = {
  readonly outerMm: number
  readonly quietZoneModules: 4
  readonly errorCorrectionLevel: "H"
  readonly ink: "#111111"
  readonly background: "#ffffff"
}

export type TentPaletteModel = {
  readonly paper: "#f6f1e6"
  readonly paperDeep: "#ece5d4"
  readonly card: "#fbf8f1"
  readonly ink: "#211c16"
  readonly inkSoft: "#4f473d"
  readonly accent: "#cf330a"
  readonly sun: "#f5a623"
  readonly leaf: "#16733c"
  readonly cobalt: "#2b43c8"
  readonly white: "#ffffff"
}

export type TentFontModel = {
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

export type TentFooterModel = {
  readonly left: string
  readonly right: string
}

export type TentTypeTiers = {
  readonly hookCqw: number
  readonly bodyCqw: number
  readonly metaCqw: number
}

/** One printed face of a tent — resolved copy plus its visual treatment. */
export type TentFaceContent = {
  readonly variant: TentFaceVariant
  readonly tone: TentFaceTone
  readonly badge: string | null
  readonly headline: readonly string[]
  readonly accent: string
  readonly body: string
  readonly showStamps: boolean
  readonly cta: string
}

export type TentContentBase = {
  readonly sheet: "a4"
  readonly kicker: string
  readonly reassurance: string
  readonly footer: TentFooterModel
  readonly friction: string
  readonly geometry: TentGeometry
  readonly qr: TentQrModel
  readonly palette: TentPaletteModel
  readonly fonts: TentFontModel
  readonly typeTiers: TentTypeTiers
}

export type TentContent = TentContentBase & {
  readonly id: TentDesignId
  readonly name: string
  readonly stampsRequired: number
  readonly faceA: TentFaceContent
  readonly faceB: TentFaceContent
}

export type TentDesignMetadata = {
  readonly id: TentDesignId
  readonly name: string
  readonly description: string
  readonly useCase: string
  readonly tone: string
  readonly collection: "table-tent"
  readonly format: "a4-tent"
  readonly sheet: "a4"
  readonly revision: number
  readonly rollout: TentRollout
}
