import type { StudioTentContent } from "@/lib/qr/poster-content"

import {
  drawOfferedStampRow,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import { drawQrAction } from "./poster-pdf-layout"
import { drawB5FaceFrame, type B5FaceGeometry } from "./poster-pdf-b5-layout"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawEditorialB5Face(
  context: PosterPdfBaseContext,
  content: StudioTentContent,
  geometry: B5FaceGeometry
): void {
  const copy = content.faces.bottom
  const { hookPt, substantivePt, factsPt } = content.typeTiers
  drawB5FaceFrame(context, geometry, {
    reassurance: copy.reassurance,
    background: POSTER_PDF_COLOR.paper,
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    factsBackground: POSTER_PDF_COLOR.paper,
    factsSize: factsPt,
  })
  const split = geometry.x + geometry.width * 0.65
  drawWrappedText(context.page, copy.headline.toUpperCase(), {
    x: geometry.x + mm(4),
    y: geometry.mainY + geometry.mainHeight - mm(13),
    maxWidth: split - geometry.x - mm(8),
    font: context.fonts.bold,
    size: hookPt,
    lineHeight: hookPt,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 3,
  })
  drawWrappedText(context.page, `${copy.support} ${copy.frictionLine}`, {
    x: geometry.x + mm(4),
    y: geometry.mainY + mm(24),
    maxWidth: split - geometry.x - mm(8),
    font: context.fonts.regular,
    size: substantivePt,
    lineHeight: substantivePt + 2,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 4,
  })
  drawOfferedStampRow(context.page, context.stampsRequired, {
    x: geometry.x + mm(4),
    y: geometry.mainY + mm(8),
    width: split - geometry.x - mm(8),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: context.fonts.mono,
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

export function drawBoldB5Face(
  context: PosterPdfBaseContext,
  content: StudioTentContent,
  geometry: B5FaceGeometry
): void {
  const copy = content.faces.top
  const { hookPt, substantivePt, factsPt } = content.typeTiers
  drawB5FaceFrame(context, geometry, {
    reassurance: copy.reassurance,
    background: POSTER_PDF_COLOR.ink,
    foreground: POSTER_PDF_COLOR.paper,
    accent: POSTER_PDF_COLOR.sun,
    identityBackground: POSTER_PDF_COLOR.ink,
    factsBackground: POSTER_PDF_COLOR.ink,
    factsSize: factsPt,
  })
  const split = geometry.x + geometry.width * 0.62
  drawWrappedText(context.page, copy.headline.toUpperCase(), {
    x: geometry.x + mm(4),
    y: geometry.mainY + geometry.mainHeight - mm(13),
    maxWidth: split - geometry.x - mm(8),
    font: context.fonts.bold,
    size: hookPt,
    lineHeight: hookPt,
    color: POSTER_PDF_COLOR.paper,
    maxLines: 3,
  })
  drawWrappedText(context.page, `${copy.support} ${copy.frictionLine}`, {
    x: geometry.x + mm(4),
    y: geometry.mainY + mm(24),
    maxWidth: split - geometry.x - mm(8),
    font: context.fonts.regular,
    size: substantivePt,
    lineHeight: substantivePt + 2,
    color: POSTER_PDF_COLOR.paper,
    maxLines: 4,
  })
  drawOfferedStampRow(context.page, context.stampsRequired, {
    x: geometry.x + mm(4),
    y: geometry.mainY + mm(9),
    width: split - geometry.x - mm(8),
    foreground: POSTER_PDF_COLOR.paper,
    accent: POSTER_PDF_COLOR.sun,
    font: context.fonts.mono,
  })
  const qrSize = mm(copy.qr.outerMm)
  drawQrAction(context.page, context.qrModules, copy.qrCaption, {
    x: split + (geometry.x + geometry.width - split - qrSize) / 2,
    y: geometry.mainY + (geometry.mainHeight - qrSize) / 2,
    size: qrSize,
    font: context.fonts.bold,
    color: POSTER_PDF_COLOR.paper,
    border: POSTER_PDF_COLOR.paper,
    captionSize: substantivePt,
  })
}
