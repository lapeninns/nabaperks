import type {
  CopyDrivenPosterContent,
  NorthstarPosterContent,
  PosterContent,
  PosterDesignId,
  ThermalPosterContent,
} from "@/lib/qr/poster-content-types"

import { drawConceptA4, drawCopyDrivenA4 } from "./poster-pdf-a4"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

type PosterPdfRenderer = (
  context: PosterPdfBaseContext,
  content: PosterContent
) => void

function copyDrivenContent(content: PosterContent): CopyDrivenPosterContent {
  if (
    content.id !== "editorial" &&
    content.id !== "bold" &&
    content.id !== "ticket"
  ) {
    throw new Error(`Expected copy-driven A4 content, received ${content.id}`)
  }
  return content
}

function conceptContent(
  content: PosterContent
): NorthstarPosterContent | ThermalPosterContent {
  if (content.id !== "northstar" && content.id !== "thermal") {
    throw new Error(`Expected concept A4 content, received ${content.id}`)
  }
  return content
}

function renderCopyDriven(
  context: PosterPdfBaseContext,
  content: PosterContent
) {
  drawCopyDrivenA4(context, copyDrivenContent(content))
}

function renderConcept(context: PosterPdfBaseContext, content: PosterContent) {
  drawConceptA4(context, conceptContent(content))
}

const POSTER_PDF_RENDERERS = {
  editorial: renderCopyDriven,
  bold: renderCopyDriven,
  ticket: renderCopyDriven,
  northstar: renderConcept,
  thermal: renderConcept,
} satisfies Record<PosterDesignId, PosterPdfRenderer>

export function drawPosterPdf(
  context: PosterPdfBaseContext,
  content: PosterContent
): void {
  POSTER_PDF_RENDERERS[content.id](context, content)
}
