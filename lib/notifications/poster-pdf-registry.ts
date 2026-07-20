import type {
  PosterContent,
  PosterDesignId,
} from "@/lib/qr/poster-content-types"

import { drawCounterKitA4 } from "./poster-pdf-a4-kit"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

type PosterPdfRenderer = (
  context: PosterPdfBaseContext,
  content: PosterContent
) => void

function renderCounterKit(
  context: PosterPdfBaseContext,
  content: PosterContent
) {
  drawCounterKitA4(context, content)
}

const POSTER_PDF_RENDERERS = {
  primer: renderCounterKit,
  window: renderCounterKit,
  pinned: renderCounterKit,
  seal: renderCounterKit,
  tally: renderCounterKit,
  lastcall: renderCounterKit,
  receipt: renderCounterKit,
  chalk: renderCounterKit,
} satisfies Record<PosterDesignId, PosterPdfRenderer>

export function drawPosterPdf(
  context: PosterPdfBaseContext,
  content: PosterContent
): void {
  POSTER_PDF_RENDERERS[content.id](context, content)
}
