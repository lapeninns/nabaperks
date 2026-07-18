import type { BaseTentContent } from "@/lib/qr/poster-content"

import {
  drawDashedLine,
  drawOfferedStampRow,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import { drawQrAction } from "./poster-pdf-layout"
import { drawB5FaceFrame, type B5FaceGeometry } from "./poster-pdf-b5-layout"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawMysteryB5Face(
  context: PosterPdfBaseContext,
  content: BaseTentContent,
  geometry: B5FaceGeometry
): void {
  const copy = content.faces.bottom
  const { hookPt, substantivePt, factsPt } = content.typeTiers
  drawB5FaceFrame(context, geometry, {
    reassurance: content.reassurance,
    background: POSTER_PDF_COLOR.paper,
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.sun,
    identityBackground: POSTER_PDF_COLOR.ink,
    identityForeground: POSTER_PDF_COLOR.paper,
    identityAccent: POSTER_PDF_COLOR.sun,
    factsBackground: POSTER_PDF_COLOR.paper,
    factsSize: factsPt,
  })
  const split = geometry.x + geometry.width * 0.58
  const left = geometry.x + mm(4)
  const mainTop = geometry.mainY + geometry.mainHeight
  context.page.drawText(copy.editionLabel.toUpperCase(), {
    x: left,
    y: mainTop - mm(5),
    size: 8,
    font: context.fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  copy.stack.forEach((line, index) => {
    context.page.drawText(line.toUpperCase(), {
      x: left,
      y: mainTop - mm(12) - index * 31,
      size: hookPt,
      font: context.fonts.bold,
      color: index === 2 ? POSTER_PDF_COLOR.sun : POSTER_PDF_COLOR.ink,
    })
  })
  drawWrappedText(context.page, copy.rewardLine, {
    x: left,
    y: geometry.mainY + mm(18),
    maxWidth: split - left - mm(4),
    font: context.fonts.bold,
    size: substantivePt,
    lineHeight: substantivePt + 2,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 3,
  })
  drawWrappedText(context.page, copy.frictionLine, {
    x: left,
    y: geometry.mainY + mm(31),
    maxWidth: split - left - mm(4),
    font: context.fonts.mono,
    size: factsPt,
    lineHeight: factsPt + 2,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 2,
  })
  drawOfferedStampRow(context.page, context.stampsRequired, {
    x: left,
    y: geometry.mainY + mm(9),
    width: split - left - mm(4),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: context.fonts.mono,
  })
  context.page.drawRectangle({
    x: split,
    y: geometry.mainY,
    width: geometry.x + geometry.width - split,
    height: geometry.mainHeight,
    color: POSTER_PDF_COLOR.accent,
  })
  const qrSize = mm(copy.qr.outerMm)
  const qrX = split + (geometry.x + geometry.width - split - qrSize) / 2
  const qrY = geometry.mainY + (geometry.mainHeight - qrSize) / 2 + mm(2)
  context.page.drawText(copy.scanLabel.toUpperCase(), {
    x: qrX,
    y: geometry.mainY + geometry.mainHeight - mm(6),
    size: factsPt,
    font: context.fonts.mono,
    color: POSTER_PDF_COLOR.white,
  })
  drawQrAction(context.page, context.qrModules, copy.scanCta.join(" "), {
    x: qrX,
    y: qrY,
    size: qrSize,
    font: context.fonts.bold,
    color: POSTER_PDF_COLOR.white,
    border: POSTER_PDF_COLOR.ink,
    captionSize: substantivePt,
  })
}

export function drawTicketB5Face(
  context: PosterPdfBaseContext,
  content: BaseTentContent,
  geometry: B5FaceGeometry
): void {
  const copy = content.faces.top
  const { hookPt, substantivePt, factsPt } = content.typeTiers
  drawB5FaceFrame(context, geometry, {
    reassurance: copy.reassurance,
    background: POSTER_PDF_COLOR.paperDeep,
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.white,
    identityBackground: POSTER_PDF_COLOR.accent,
    identityForeground: POSTER_PDF_COLOR.white,
    identityAccent: POSTER_PDF_COLOR.white,
    factsBackground: POSTER_PDF_COLOR.paperDeep,
    factsSize: factsPt,
  })
  const split = geometry.x + geometry.width * 0.64
  const left = geometry.x + mm(4)
  drawWrappedText(context.page, copy.headline.toUpperCase(), {
    x: left,
    y: geometry.mainY + geometry.mainHeight - mm(12),
    maxWidth: split - left - mm(5),
    font: context.fonts.bold,
    size: hookPt,
    lineHeight: hookPt,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 3,
  })
  drawWrappedText(context.page, copy.support, {
    x: left,
    y: geometry.mainY + mm(23),
    maxWidth: split - left - mm(5),
    font: context.fonts.bold,
    size: substantivePt,
    lineHeight: substantivePt + 2,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 3,
  })
  context.page.drawText(copy.frictionLine.toUpperCase(), {
    x: left,
    y: geometry.mainY + mm(4),
    size: factsPt,
    font: context.fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawOfferedStampRow(context.page, context.stampsRequired, {
    x: left,
    y: geometry.mainY + mm(14),
    width: split - left - mm(5),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: context.fonts.mono,
  })
  drawDashedLine(context.page, {
    x1: split,
    y1: geometry.mainY,
    x2: split,
    y2: geometry.mainY + geometry.mainHeight,
    color: POSTER_PDF_COLOR.ink,
  })
  const qrSize = mm(copy.qr.outerMm)
  drawQrAction(context.page, context.qrModules, copy.qrCaption, {
    x: split + (geometry.x + geometry.width - split - qrSize) / 2,
    y: geometry.mainY + (geometry.mainHeight - qrSize) / 2,
    size: qrSize,
    font: context.fonts.bold,
    color: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    captionSize: substantivePt,
  })
}
