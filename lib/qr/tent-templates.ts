import {
  tentCollection,
  tentDesignIds,
  tentDesignMetadata,
} from "./tent-design-reader"
import type {
  TentCollection,
  TentDesignId,
  TentDesignMetadata,
} from "./tent-content-types"

export const TENT_DESIGN_IDS = tentDesignIds()

export type TableTentDesignId = TentDesignId

const TENT_DESIGN_ID_SET = new Set<string>(TENT_DESIGN_IDS)

export function isTentDesignId(
  designId: string
): designId is TableTentDesignId {
  return TENT_DESIGN_ID_SET.has(designId)
}

export type TableTentDesign = TentDesignMetadata

export const TENT_DESIGNS: readonly TableTentDesign[] = TENT_DESIGN_IDS.map(
  (id) => tentDesignMetadata(id)
)

/** Designs exposed to merchants — pickers and any tent email bundle. */
export const TENT_PRODUCTION_DESIGNS: readonly TableTentDesign[] =
  TENT_DESIGNS.filter(({ rollout }) => rollout === "production")

export const TENT_COLLECTION: TentCollection = tentCollection()

export function getTentDesign(designId: string): TableTentDesign | null {
  if (!isTentDesignId(designId)) return null
  return tentDesignMetadata(designId)
}
