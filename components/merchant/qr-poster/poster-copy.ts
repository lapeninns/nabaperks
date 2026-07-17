import type { CSSProperties } from "react"

import { resolveCopyDrivenContent } from "@/lib/qr/poster-content"

/**
 * Copy-driven templates resolved through getPosterCopy. Hooks live in
 * config/poster-designs.json via lib/qr/poster-designs.ts. Concept posters
 * (northstar, thermal, table-tent faces) keep their own strings there too.
 */
export type CopyPosterTemplateId = "editorial" | "bold" | "ticket"

export type PosterData = {
  readonly businessName: string
  /** Stamps needed to unlock the mystery reward. */
  readonly stampsRequired: number
}

export type PosterHeadline = {
  readonly beforeAccent: string
  readonly accent: string
  readonly afterAccent: string
}

export type PosterCopy = PosterData & {
  readonly template: CopyPosterTemplateId
  /** Giant headline with one accent word. */
  readonly headline: PosterHeadline
  /** Tiny trust/identity eyebrow. */
  readonly eyebrow: string
  /** Supporting line under the hook. */
  readonly support: string
  /** Forbidden-fruit teaser — intrigue on the mystery reward. */
  readonly rewardDetail: string
  readonly qrOuterMm: number
  readonly geometry: {
    readonly sheetWidthMm: number
    readonly sheetHeightMm: number
  }
  readonly typeTiers: {
    readonly hookPt: number
    readonly substantivePt: number
    readonly factsPt: number
  }
  /** The friction-killer strip. */
  readonly frictionLine: string
  /** The QR imperative. */
  readonly qrCaption: string
  /** Endowed-progress line, mystery framing. */
  readonly progress: string
  /** Tiny reassurance — never names the reward. */
  readonly reassurance: string
}

export function getPosterCopy(
  data: PosterData,
  template: CopyPosterTemplateId
): PosterCopy {
  const content = resolveCopyDrivenContent(template, data.stampsRequired)

  return {
    ...data,
    template,
    stampsRequired: data.stampsRequired,
    eyebrow: data.businessName.trim(),
    headline: content.headline,
    support: content.support,
    rewardDetail: content.rewardDetail,
    qrOuterMm: content.qr.outerMm,
    geometry: content.geometry,
    typeTiers: content.typeTiers,
    frictionLine: content.frictionLine,
    qrCaption: content.qrCaption,
    progress: content.progress,
    reassurance: content.reassurance,
  }
}

type A4PosterCssProperties = CSSProperties & {
  readonly "--poster-a4-hook-size": string
  readonly "--poster-a4-substantive-size": string
  readonly "--poster-a4-facts-size": string
}

export function a4PosterStyle(content: {
  readonly typeTiers: PosterCopy["typeTiers"]
}): A4PosterCssProperties {
  return {
    "--poster-a4-hook-size": `${content.typeTiers.hookPt}pt`,
    "--poster-a4-substantive-size": `${content.typeTiers.substantivePt}pt`,
    "--poster-a4-facts-size": `${content.typeTiers.factsPt}pt`,
  }
}
