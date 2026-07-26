import type { PrimerPosterContent } from "@/lib/qr/poster-kit-content-types"
import type { BoxMm } from "@/lib/print/box"
import { createLedger } from "@/lib/print/ledger"
import type { Ledger } from "@/lib/print/ledger-types"
import { RHYTHM_BASE_MM } from "@/lib/print/rhythm"
import type { TextMetrics } from "@/lib/print/text"
import { blockHeightMm, mmToPt, ptToMm, wrapLines } from "@/lib/print/text"
import type { ZoneName, ZoneStack } from "@/lib/print/zones"
import { solveA4Zones } from "@/lib/print/zones"

/** Body copy leading, matching POSTER_PDF_TYPE.bodyLeading. */
const BODY_LEADING = 1.4
const BODY_PT = 12
const DISPLAY_LEADING = 1.06
/** Detail copy hangs beneath the clause number column. */
const CLAUSE_INDENT_MM = 14
/** Gap between a clause title and its detail run. */
const TITLE_TO_DETAIL_MM = 1.5

/**
 * The headline sets in bold display and the clause details in regular body,
 * so line counts must be measured with the matching font — one shared
 * measurer would mis-wrap one of them.
 */
export type PrimerMetrics = {
  readonly display: TextMetrics
  readonly body: TextMetrics
}

export type PrimerLayout = {
  readonly zones: ZoneStack
  readonly ledger: Ledger
  readonly headlineLines: readonly string[]
  readonly clauseDetailLines: readonly (readonly string[])[]
}

type ClauseBlock = {
  readonly number: string
  readonly title: string
  readonly detailLines: readonly string[]
  readonly heightMm: number
}

function measureClauses(
  content: PrimerPosterContent,
  metrics: TextMetrics,
  detailWidthMm: number
): readonly ClauseBlock[] {
  const titleMm = ptToMm(content.typeTiers.substantivePt)
  return content.clauses.map((clause) => {
    const detailLines = wrapLines(
      clause.detail,
      metrics,
      BODY_PT,
      mmToPt(detailWidthMm)
    )
    const detailMm = blockHeightMm(detailLines.length, BODY_PT, BODY_LEADING)
    return {
      number: clause.number,
      title: clause.title,
      detailLines,
      heightMm: titleMm + TITLE_TO_DETAIL_MM + detailMm,
    }
  })
}

function proofHeightMm(blocks: readonly ClauseBlock[]): number {
  const rows = blocks.reduce((total, block) => total + block.heightMm, 0)
  return rows + RHYTHM_BASE_MM * (blocks.length - 1)
}

/**
 * Pure layout for the primer sheet. Every clause rule is derived from the
 * measured bottom of the detail run above it, which is what stops the rules
 * landing on the text — the old renderer divided leftover space by clause
 * count, so rows compressed until the rules collided.
 */
export function primerLayout(
  content: PrimerPosterContent,
  metrics: PrimerMetrics
): PrimerLayout {
  const liveWidthMm = 174
  const detailWidthMm = liveWidthMm - CLAUSE_INDENT_MM
  const blocks = measureClauses(content, metrics.body, detailWidthMm)
  const zones = solveA4Zones(proofHeightMm(blocks))
  const ledger = createLedger()

  ledger.defineContainer("sheet", {
    xMm: 0,
    yMm: 0,
    widthMm: 210,
    heightMm: 297,
  })
  const zoneNames: readonly ZoneName[] = [
    "rail",
    "statement",
    "proof",
    "action",
    "legal",
  ]
  for (const name of zoneNames) {
    ledger.defineContainer(name, zones[name])
  }

  const headlineLines = wrapLines(
    content.headline,
    metrics.display,
    content.typeTiers.hookPt,
    mmToPt(zones.statement.widthMm)
  )
  const headlineLineMm = ptToMm(content.typeTiers.hookPt * DISPLAY_LEADING)
  headlineLines.forEach((line, index) => {
    ledger.add({
      kind: "text",
      role: "content",
      box: {
        xMm: zones.statement.xMm,
        yMm: zones.statement.yMm + index * headlineLineMm,
        widthMm: ptToMm(
          metrics.display.widthPt(line, content.typeTiers.hookPt)
        ),
        heightMm: headlineLineMm,
      },
      container: "statement",
      label: `headline-line-${index}`,
    })
  })

  const titleMm = ptToMm(content.typeTiers.substantivePt)
  const detailLineMm = ptToMm(BODY_PT * BODY_LEADING)
  let cursorMm = zones.proof.yMm
  blocks.forEach((block, index) => {
    const titleBox: BoxMm = {
      xMm: zones.proof.xMm,
      yMm: cursorMm,
      widthMm: zones.proof.widthMm,
      heightMm: titleMm,
    }
    ledger.add({
      kind: "text",
      role: "content",
      box: titleBox,
      container: "proof",
      label: `clause-title-${index}`,
    })
    const detailTopMm = cursorMm + titleMm + TITLE_TO_DETAIL_MM
    const detailHeightMm = block.detailLines.length * detailLineMm
    ledger.add({
      kind: "text",
      role: "content",
      box: {
        xMm: zones.proof.xMm + CLAUSE_INDENT_MM,
        yMm: detailTopMm,
        widthMm: detailWidthMm,
        heightMm: detailHeightMm,
      },
      container: "proof",
      label: `clause-detail-${index}`,
    })
    // A separator separates: n-1 rules, each centred in the rhythm gap BELOW
    // the measured detail bottom. Deriving it from the measured bottom is the
    // fix for the rule-on-text collision.
    if (index < blocks.length - 1) {
      ledger.add({
        kind: "rule",
        role: "chrome",
        box: {
          xMm: zones.proof.xMm,
          yMm: detailTopMm + detailHeightMm + RHYTHM_BASE_MM / 2,
          widthMm: zones.proof.widthMm,
          heightMm: 0.3,
        },
        container: "proof",
        label: `clause-rule-${index}`,
      })
    }
    cursorMm += block.heightMm + RHYTHM_BASE_MM
  })

  return {
    zones,
    ledger: ledger.snapshot(),
    headlineLines,
    clauseDetailLines: blocks.map((block) => block.detailLines),
  }
}
