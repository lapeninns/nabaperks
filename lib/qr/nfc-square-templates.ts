import {
  nfcSquareCollection,
  nfcSquareDesignIds,
  nfcSquareDesignMetadata,
} from "./nfc-square-design-reader"
import type {
  NfcSquareCollection,
  NfcSquareDesignId,
  NfcSquareDesignMetadata,
} from "./nfc-square-content-types"

export const NFC_SQUARE_DESIGN_IDS = nfcSquareDesignIds()

export type { NfcSquareDesignId }

const NFC_SQUARE_DESIGN_ID_SET = new Set<string>(NFC_SQUARE_DESIGN_IDS)

export function isNfcSquareDesignId(
  designId: string
): designId is NfcSquareDesignId {
  return NFC_SQUARE_DESIGN_ID_SET.has(designId)
}

export type NfcSquareDesign = NfcSquareDesignMetadata

export const NFC_SQUARE_DESIGNS: readonly NfcSquareDesign[] =
  NFC_SQUARE_DESIGN_IDS.map((id) => nfcSquareDesignMetadata(id))

/** Designs exposed to merchants — pickers and the print-kit email bundle. */
export const NFC_SQUARE_PRODUCTION_DESIGNS: readonly NfcSquareDesign[] =
  NFC_SQUARE_DESIGNS.filter(({ rollout }) => rollout === "production")

export const NFC_SQUARE_COLLECTION: NfcSquareCollection = nfcSquareCollection()

export function getNfcSquareDesign(designId: string): NfcSquareDesign | null {
  if (!isNfcSquareDesignId(designId)) return null
  return nfcSquareDesignMetadata(designId)
}
