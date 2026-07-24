export type NfcCardDesignId = "tap" | "google-review"

export type NfcCardRollout = "production" | "review" | "experimental"

export type NfcCardCollection = {
  readonly id: "nfc-card"
  readonly name: string
  readonly description: string
  readonly format: "cr80-nfc"
  readonly sheet: "cr80"
  readonly revision: number
}

export type NfcCardGeometry = {
  readonly cardWidthMm: 85.5
  readonly cardHeightMm: 54
  readonly cornerRadiusMm: number
  readonly frameInsetMm: number
  readonly qrOuterMm: number
  readonly googleReviewQrOuterMm: number
}

export type NfcCardQrModel = {
  readonly outerMm: number
  readonly quietZoneModules: 4
  readonly errorCorrectionLevel: "H"
  readonly ink: "#111111"
  readonly background: "#ffffff"
}

export type NfcCardPaletteModel = {
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

export type NfcCardFontModel = {
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

export type NfcCardTypeTiers = {
  readonly floorPt: number
  readonly metaPt: number
  readonly bodyPt: number
  readonly titlePt: number
  readonly displayPt: number
  readonly sealPt: number
}

export type NfcCardFrontContent = {
  readonly brandEyebrow: string
  readonly brandName: string
  readonly tapWord: string
  readonly tapSub: string
  readonly stampCue: string
  readonly claimKicker: string
  readonly claimLine: string
  readonly flow: readonly string[]
}

export type NfcCardBackStep = {
  readonly title: string
  readonly detail: string
}

export type NfcCardBackContent = {
  readonly strap: string
  readonly badge: string
  readonly teaseLead: string
  readonly teaseAccent: string
  readonly sealLabel: string
  readonly steps: readonly NfcCardBackStep[]
  readonly footBrand: string
}

export type NfcCardContentBase = {
  readonly sheet: "cr80"
  readonly reassurance: string
  /** Short rule that survives cutting — printed on the CR80 die itself. */
  readonly dieRule: string
  readonly friction: string
  readonly claimFriction: string
  readonly geometry: NfcCardGeometry
  readonly qr: NfcCardQrModel
  readonly palette: NfcCardPaletteModel
  readonly fonts: NfcCardFontModel
  readonly typeTiers: NfcCardTypeTiers
}

export type NfcCardContent = NfcCardContentBase & {
  readonly id: NfcCardDesignId
  readonly name: string
  readonly stampsRequired: number
  readonly front: NfcCardFrontContent
  readonly back: NfcCardBackContent
}

export type NfcCardDesignMetadata = {
  readonly id: NfcCardDesignId
  readonly name: string
  readonly description: string
  readonly useCase: string
  readonly tone: string
  readonly collection: "nfc-card"
  readonly format: "cr80-nfc"
  readonly sheet: "cr80"
  readonly revision: number
  readonly rollout: NfcCardRollout
}
