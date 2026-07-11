import { rgb, type RGB } from "pdf-lib"

import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

export type PosterStyle = {
  readonly background: RGB
  readonly foreground: RGB
  readonly accent: RGB
  readonly panel: RGB
  readonly headline: string
  readonly support: string
  readonly friction: string
  readonly qrCaption: string
}

export const POSTER_PDF_COLOR = {
  ink: rgb(0.13, 0.11, 0.09),
  paper: rgb(0.97, 0.94, 0.86),
  white: rgb(1, 1, 1),
} as const

const RED = rgb(0.81, 0.2, 0.04)
const BLUE = rgb(0.12, 0.27, 0.73)
const YELLOW = rgb(1, 0.78, 0.12)

export function posterStyle(
  template: QrPosterTemplateId,
  stamps: number
): PosterStyle {
  const firstStamp =
    stamps === 1
      ? "Your reward unlocks straight after."
      : "The rest unlock the mystery."
  const styles: Record<QrPosterTemplateId, PosterStyle> = {
    editorial: {
      background: POSTER_PDF_COLOR.paper,
      foreground: POSTER_PDF_COLOR.ink,
      accent: BLUE,
      panel: POSTER_PDF_COLOR.white,
      headline: `${stamps} visits. One surprise.`,
      support:
        "Your first stamp is already waiting. Collect the rest to unlock the mystery.",
      friction: "NO APP  |  OPENS IN YOUR BROWSER",
      qrCaption: "Scan to unlock your mystery reward",
    },
    bold: {
      background: POSTER_PDF_COLOR.ink,
      foreground: POSTER_PDF_COLOR.paper,
      accent: RED,
      panel: POSTER_PDF_COLOR.white,
      headline: "Everyone wins something.",
      support:
        "Your first stamp is already waiting. We are not allowed to tell you the reward.",
      friction: "NO APP  |  NO DOWNLOAD  |  NO SPAM",
      qrCaption: "Scan to claim your free stamp",
    },
    ticket: {
      background: POSTER_PDF_COLOR.paper,
      foreground: POSTER_PDF_COLOR.ink,
      accent: RED,
      panel: POSTER_PDF_COLOR.white,
      headline: "First stamp's free.",
      support: `Claim stamp one today. ${firstStamp}`,
      friction: "NO ACCOUNT NEEDED  |  SCAN WITH YOUR CAMERA",
      qrCaption: "Scan here to claim your free stamp",
    },
    northstar: {
      background: POSTER_PDF_COLOR.ink,
      foreground: POSTER_PDF_COLOR.paper,
      accent: YELLOW,
      panel: POSTER_PDF_COLOR.white,
      headline: "Everyone wins something.",
      support: `You are one stamp in. ${Math.max(0, stamps - 1)} more visits unlock the mystery.`,
      friction: "NO APP  |  NO DOWNLOAD  |  NO SPAM",
      qrCaption: "Scan to claim your free stamp",
    },
    thermal: {
      background: POSTER_PDF_COLOR.paper,
      foreground: POSTER_PDF_COLOR.ink,
      accent: RED,
      panel: POSTER_PDF_COLOR.white,
      headline: "Loyalty receipt",
      support: `TODAY'S FIRST STAMP: FREE     VISITS TO UNLOCK: ${stamps}`,
      friction: "TOTAL TO JOIN: GBP 0.00",
      qrCaption: "Scan to claim your free stamp",
    },
  }
  return styles[template]
}
