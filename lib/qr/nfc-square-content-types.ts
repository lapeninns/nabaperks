export type NfcSquareDesignId = "tap"

export type NfcSquareRollout = "production" | "review" | "experimental"

export type NfcSquareCollection = {
  readonly id: "nfc-square"
  readonly name: string
  readonly description: string
  readonly format: "nfc-square-100"
  readonly sheet: "square-100"
  readonly revision: number
}

export type NfcSquareGeometry = {
  readonly cardWidthMm: 100
  readonly cardHeightMm: 100
  readonly cornerRadiusMm: number
  readonly frameInsetMm: number
  readonly qrOuterMm: number
}

export type NfcSquareQrModel = {
  readonly outerMm: number
  readonly quietZoneModules: 4
  readonly errorCorrectionLevel: "H"
  readonly ink: "#111111"
  readonly background: "#ffffff"
}

export type NfcSquarePaletteModel = {
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

export type NfcSquareFontModel = {
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

export type NfcSquareTypeTiers = {
  readonly floorPt: number
  readonly metaPt: number
  readonly bodyPt: number
  readonly titlePt: number
  readonly displayPt: number
  readonly sealPt: number
}

export type NfcSquareFrontContent = {
  readonly brandEyebrow: string
  readonly brandName: string
  readonly tapWord: string
  readonly tapSub: string
  readonly claimLine: string
  readonly mysteryKicker: string
  readonly mysteryAccent: string
  readonly flow: readonly [string, string, string]
}

export type NfcSquareContentBase = {
  readonly sheet: "square-100"
  readonly reassurance: string
  readonly dieRule: string
  readonly friction: string
  readonly claimFriction: string
  readonly geometry: NfcSquareGeometry
  readonly qr: NfcSquareQrModel
  readonly palette: NfcSquarePaletteModel
  readonly fonts: NfcSquareFontModel
  readonly typeTiers: NfcSquareTypeTiers
}

export type NfcSquareContent = NfcSquareContentBase & {
  readonly id: NfcSquareDesignId
  readonly name: string
  readonly stampsRequired: number
  readonly front: NfcSquareFrontContent
}

export type NfcSquareDesignMetadata = {
  readonly id: NfcSquareDesignId
  readonly name: string
  readonly description: string
  readonly useCase: string
  readonly tone: string
  readonly collection: "nfc-square"
  readonly format: "nfc-square-100"
  readonly sheet: "square-100"
  readonly revision: number
  readonly rollout: NfcSquareRollout
}
