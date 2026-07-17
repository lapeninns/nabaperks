import type { PDFPage, RGB } from "pdf-lib"
import type { B5Geometry } from "@/lib/qr/poster-content"

import { drawHardBox, mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import { drawFactsRail, drawIdentityRail } from "./poster-pdf-layout"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export type B5FaceGeometry = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly identityY: number
  readonly identityHeight: number
  readonly foldCorridorHeight: number
  readonly factsY: number
  readonly factsHeight: number
  readonly mainY: number
  readonly mainHeight: number
  readonly blankHeight: number
}

export function b5FaceGeometry(
  panelBottom: number,
  model: B5Geometry
): B5FaceGeometry {
  const inset = mm(model.liveInsetMm)
  const foldCorridorHeight = mm(model.foldCorridorMm / 2)
  const railHeight = mm((model.identityRowMm - model.foldCorridorMm / 2) / 2)
  const identityHeight = railHeight
  const factsHeight = railHeight
  const mainHeight = mm(model.mainRowMm)
  const blankHeight = mm(model.lowerOcclusionRowMm)
  const y = panelBottom
  const mainY = y + blankHeight
  const factsY = mainY + mainHeight
  const identityY = factsY + factsHeight
  return {
    x: inset,
    y,
    width: mm(model.sheetWidthMm) - inset * 2,
    height: mm(model.faceHeightMm),
    identityY,
    identityHeight,
    foldCorridorHeight,
    factsY,
    factsHeight,
    mainY,
    mainHeight,
    blankHeight,
  }
}

export function drawB5FaceFrame(
  context: PosterPdfBaseContext,
  geometry: B5FaceGeometry,
  options: {
    readonly reassurance: string
    readonly background: RGB
    readonly foreground: RGB
    readonly accent: RGB
    readonly identityBackground?: RGB
    readonly identityForeground?: RGB
    readonly identityAccent?: RGB
    readonly factsBackground?: RGB
    readonly factsSize: number
  }
): void {
  const identityRowHeight =
    geometry.height - geometry.blankHeight - geometry.mainHeight
  for (const band of [
    {
      y: geometry.y,
      height: geometry.blankHeight,
    },
    {
      y: geometry.mainY,
      height: geometry.mainHeight,
    },
    {
      y: geometry.factsY,
      height: identityRowHeight,
    },
    {
      y: geometry.y + geometry.height - geometry.foldCorridorHeight,
      height: geometry.foldCorridorHeight,
    },
  ]) {
    context.page.drawRectangle({
      x: geometry.x,
      y: band.y,
      width: geometry.width,
      height: band.height,
      color: options.background,
    })
  }
  drawHardBox(context.page, {
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    fill: options.background,
    border: options.foreground,
  })
  drawIdentityRail(context.page, {
    merchantName: context.merchantName,
    x: geometry.x,
    y: geometry.identityY,
    width: geometry.width,
    height: geometry.identityHeight,
    foreground: options.identityForeground ?? options.foreground,
    accent: options.identityAccent ?? options.accent,
    background: options.identityBackground,
    fonts: context.fonts,
    size: options.factsSize,
  })
  drawFactsRail(context.page, options.reassurance, {
    x: geometry.x,
    y: geometry.factsY,
    width: geometry.width,
    height: geometry.factsHeight,
    font: context.fonts.mono,
    color: options.foreground,
    background: options.factsBackground,
    size: options.factsSize,
  })
}

export function drawB5FoldGuide(page: PDFPage, model: B5Geometry): void {
  const centreY = mm(model.sheetHeightMm) / 2
  for (
    let x = mm(model.liveInsetMm);
    x < mm(model.sheetWidthMm - model.liveInsetMm);
    x += 11
  ) {
    page.drawRectangle({
      x,
      y: centreY - 0.5,
      width: 7,
      height: 1,
      color: POSTER_PDF_COLOR.ink,
      opacity: 0.45,
    })
  }
}
