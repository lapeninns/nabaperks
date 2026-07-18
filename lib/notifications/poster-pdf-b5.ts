import {
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
} from "pdf-lib"

import type {
  BaseTentContent,
  NightTentContent,
  StudioTentContent,
} from "@/lib/qr/poster-content"

import { drawMysteryB5Face, drawTicketB5Face } from "./poster-pdf-b5-base"
import { b5FaceGeometry, drawB5FoldGuide } from "./poster-pdf-b5-layout"
import { drawNightB5Face, drawReceiptB5Face } from "./poster-pdf-b5-night"
import { drawBoldB5Face, drawEditorialB5Face } from "./poster-pdf-b5-studio"
import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

type TentContent = BaseTentContent | NightTentContent | StudioTentContent

function drawTopFace(
  context: PosterPdfBaseContext,
  content: TentContent
): void {
  const geometry = b5FaceGeometry(
    mm(content.geometry.faceHeightMm),
    content.geometry
  )
  if (content.id === "table-tent") {
    drawTicketB5Face(context, content, geometry)
  } else if (content.id === "table-tent-night") {
    drawReceiptB5Face(context, content, geometry)
  } else {
    drawBoldB5Face(context, content, geometry)
  }
}

function drawBottomFace(
  context: PosterPdfBaseContext,
  content: TentContent
): void {
  const geometry = b5FaceGeometry(0, content.geometry)
  if (content.id === "table-tent") {
    drawMysteryB5Face(context, content, geometry)
  } else if (content.id === "table-tent-night") {
    drawNightB5Face(context, content, geometry)
  } else {
    drawEditorialB5Face(context, content, geometry)
  }
}

export function drawTableTentPdf(
  context: PosterPdfBaseContext,
  content: TentContent
): void {
  const sheetWidth = mm(content.geometry.sheetWidthMm)
  const sheetHeight = mm(content.geometry.sheetHeightMm)
  context.page.drawRectangle({
    x: 0,
    y: 0,
    width: sheetWidth,
    height: sheetHeight,
    color: POSTER_PDF_COLOR.white,
  })
  const topCx = sheetWidth / 2
  const topCy = (sheetHeight * 3) / 4
  context.page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(-1, 0, 0, -1, 2 * topCx, 2 * topCy)
  )
  drawTopFace(context, content)
  context.page.pushOperators(popGraphicsState())
  drawBottomFace(context, content)
  drawB5FoldGuide(context.page, content.geometry)
}
