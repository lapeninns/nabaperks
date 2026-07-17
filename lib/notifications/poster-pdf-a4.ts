import type {
  CopyDrivenPosterContent,
  NorthstarPosterContent,
  ThermalPosterContent,
} from "@/lib/qr/poster-content"

import { drawNorthstarA4, drawThermalA4 } from "./poster-pdf-a4-concepts"
import { drawBoldA4, drawEditorialA4 } from "./poster-pdf-a4-standard"
import { drawTicketA4 } from "./poster-pdf-a4-ticket"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawCopyDrivenA4(
  context: PosterPdfBaseContext,
  content: CopyDrivenPosterContent
): void {
  if (content.id === "editorial") {
    drawEditorialA4(context, content)
  } else if (content.id === "bold") {
    drawBoldA4(context, content)
  } else {
    drawTicketA4(context, content)
  }
}

export function drawConceptA4(
  context: PosterPdfBaseContext,
  content: NorthstarPosterContent | ThermalPosterContent
): void {
  if (content.id === "northstar") {
    drawNorthstarA4(context, content)
  } else {
    drawThermalA4(context, content)
  }
}
