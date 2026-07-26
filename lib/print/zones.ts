import type { BoxMm } from "./box"
import { liveArea } from "./geometry"

export type ZoneName = "rail" | "statement" | "proof" | "action" | "legal"

export type ZoneStack = Readonly<Record<ZoneName, BoxMm>>

/**
 * Calibrated against `primer`, the densest sheet in the kit. Fixed chrome
 * totals 160mm of the 297mm sheet (both margins, RAIL, ACTION, LEGAL and the
 * four gaps), leaving 137mm shared between STATEMENT and PROOF. Because the
 * sheet is fully allocated, no space can pool into a dead band.
 *
 * ACTION is 60mm: a 54mm QR outer box plus a 6mm caption line. It is reserved
 * because getting a phone scanned is the poster's whole job.
 */
export const A4_ZONES_MM = {
  railHeight: 8,
  railToStatement: 12,
  statementToProof: 12,
  proofToAction: 12,
  actionHeight: 60,
  actionToLegal: 6,
  legalHeight: 14,
  proofMinHeight: 24,
  /** Two lines of display type at the 60pt hook floor. */
  statementMinHeight: 44,
}

export const A4_FLEXIBLE_MM = 137

export const A4_PROOF_MAX_MM = A4_FLEXIBLE_MM - A4_ZONES_MM.statementMinHeight

export function solveA4Zones(proofHeightMm: number): ZoneStack {
  if (
    proofHeightMm < A4_ZONES_MM.proofMinHeight ||
    proofHeightMm > A4_PROOF_MAX_MM
  ) {
    throw new Error(
      `PROOF height ${proofHeightMm}mm is outside ${A4_ZONES_MM.proofMinHeight}-${A4_PROOF_MAX_MM}mm`
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
