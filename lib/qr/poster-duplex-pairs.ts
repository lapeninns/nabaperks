import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"
import { QR_POSTER_PRODUCTION_TEMPLATES } from "@/lib/qr/poster-templates"

/**
 * Contrasting duplex pairs for print-kit export (front/back of one A4 sheet).
 * Export-only — email kits still send one PDF per design.
 */
export const QR_POSTER_PRODUCTION_DUPLEX_PAIRS = [
  { front: "primer", back: "lastcall" },
  { front: "window", back: "seal" },
  { front: "pinned", back: "tally" },
  { front: "receipt", back: "chalk" },
] as const satisfies ReadonlyArray<{
  readonly front: QrPosterTemplateId
  readonly back: QrPosterTemplateId
}>

export type QrPosterDuplexPair =
  (typeof QR_POSTER_PRODUCTION_DUPLEX_PAIRS)[number]

function assertDuplexPairsCoverProduction(): void {
  const productionIds = new Set(
    QR_POSTER_PRODUCTION_TEMPLATES.map(({ id }) => id)
  )
  const paired = new Set<string>()
  for (const { front, back } of QR_POSTER_PRODUCTION_DUPLEX_PAIRS) {
    if (front === back) {
      throw new Error(`Duplex pair repeats the same template: ${front}`)
    }
    if (!productionIds.has(front) || !productionIds.has(back)) {
      throw new Error(
        `Duplex pair ${front}+${back} includes a non-production template`
      )
    }
    if (paired.has(front) || paired.has(back)) {
      throw new Error(
        `Duplex pairs overlap: ${front}+${back} reuses a paired template`
      )
    }
    paired.add(front)
    paired.add(back)
  }
  if (paired.size !== productionIds.size) {
    throw new Error(
      `Duplex pairs cover ${paired.size} templates; production has ${productionIds.size}`
    )
  }
}

assertDuplexPairsCoverProduction()

export function duplexPosterFilename(pair: QrPosterDuplexPair): string {
  return `nabaperks-poster-${pair.front}-${pair.back}.pdf`
}
