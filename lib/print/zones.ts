import type { BoxMm } from "./box"
import { liveArea } from "./geometry"

export type ZoneName = "rail" | "statement" | "proof" | "action" | "legal"

export type ZoneStack = Readonly<Record<ZoneName, BoxMm>>

/**
 * Fixed chrome totals 182mm of the 297mm sheet (including both margins),
 * leaving 115mm shared between STATEMENT and PROOF. Because the sheet is
 * fully allocated, no space can pool into a dead band.
 */
export const A4_ZONES_MM = {
  railHeight: 8,
  railToStatement: 12,
  statementToProof: 18,
  proofToAction: 18,
  actionHeight: 64,
  actionToLegal: 12,
  legalHeight: 14,
  proofMinHeight: 24,
  proofMaxHeight: 40,
}

export const A4_FLEXIBLE_MM = 115

export function solveA4Zones(proofHeightMm: number): ZoneStack {
  if (
    proofHeightMm < A4_ZONES_MM.proofMinHeight ||
    proofHeightMm > A4_ZONES_MM.proofMaxHeight
  ) {
    throw new Error(
      `PROOF height ${proofHeightMm}mm is outside ${A4_ZONES_MM.proofMinHeight}-${A4_ZONES_MM.proofMaxHeight}mm`
    )
  }
  const live = liveArea("a4Poster")
  const band = (yMm: number, heightMm: number): BoxMm => ({
    xMm: live.xMm,
    yMm,
    widthMm: live.widthMm,
    heightMm,
  })

  const railY = live.yMm
  const statementY =
    railY + A4_ZONES_MM.railHeight + A4_ZONES_MM.railToStatement
  const statementHeight = A4_FLEXIBLE_MM - proofHeightMm
  const proofY = statementY + statementHeight + A4_ZONES_MM.statementToProof
  const actionY = proofY + proofHeightMm + A4_ZONES_MM.proofToAction
  const legalY = actionY + A4_ZONES_MM.actionHeight + A4_ZONES_MM.actionToLegal

  return {
    rail: band(railY, A4_ZONES_MM.railHeight),
    statement: band(statementY, statementHeight),
    proof: band(proofY, proofHeightMm),
    action: band(actionY, A4_ZONES_MM.actionHeight),
    legal: band(legalY, A4_ZONES_MM.legalHeight),
  }
}
