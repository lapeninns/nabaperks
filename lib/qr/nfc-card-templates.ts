import {
  nfcCardCollection,
  nfcCardDesignIds,
  nfcCardDesignMetadata,
} from "./nfc-card-design-reader"
import type {
  NfcCardCollection,
  NfcCardDesignId,
  NfcCardDesignMetadata,
} from "./nfc-card-content-types"

export const NFC_CARD_DESIGN_IDS = nfcCardDesignIds()

export type { NfcCardDesignId }

const NFC_CARD_DESIGN_ID_SET = new Set<string>(NFC_CARD_DESIGN_IDS)

export function isNfcCardDesignId(
  designId: string
): designId is NfcCardDesignId {
  return NFC_CARD_DESIGN_ID_SET.has(designId)
}

export type NfcCardDesign = NfcCardDesignMetadata

export const NFC_CARD_DESIGNS: readonly NfcCardDesign[] =
  NFC_CARD_DESIGN_IDS.map((id) => nfcCardDesignMetadata(id))

/** Designs exposed to merchants — pickers and the print-kit email bundle. */
export const NFC_CARD_PRODUCTION_DESIGNS: readonly NfcCardDesign[] =
  NFC_CARD_DESIGNS.filter(({ rollout }) => rollout === "production")

export const NFC_CARD_COLLECTION: NfcCardCollection = nfcCardCollection()

export function getNfcCardDesign(designId: string): NfcCardDesign | null {
  if (!isNfcCardDesignId(designId)) return null
  return nfcCardDesignMetadata(designId)
}
