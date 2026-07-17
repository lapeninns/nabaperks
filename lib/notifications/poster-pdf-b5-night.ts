import type { NightTentContent } from "@/lib/qr/poster-content"

import {
  drawHardBox,
  drawOfferedStampRow,
  drawWrappedText,
  mm,
  POSTER_PDF_COLOR,
} from "./poster-pdf-style"
import { drawQrAction } from "./poster-pdf-layout"
import { drawAccentHeadline } from "./poster-pdf-layout"
import { drawB5FaceFrame, type B5FaceGeometry } from "./poster-pdf-b5-layout"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawNightB5Face(
  context: PosterPdfBaseContext,
  content: NightTentContent,
  geometry: B5FaceGeometry
): void {
  const copy = content.faces.bottom
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
  const cardX = geometry.x + mm(2)
  const cardY = geometry.mainY + mm(2)
  const cardW = geometry.width - mm(4)
  const cardH = geometry.mainHeight - mm(4)
  drawHardBox(context.page, {
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    fill: POSTER_PDF_COLOR.card,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.qr,
    shadowOffset: 3,
  })
  const split = cardX + cardW * 0.62
  drawHardBox(context.page, {
    x: cardX + mm(3),
    y: cardY + cardH - mm(10),
    width: mm(45),
    height: mm(7),
    fill: POSTER_PDF_COLOR.sun,
    border: POSTER_PDF_COLOR.ink,
    shadow: POSTER_PDF_COLOR.ink,
    shadowOffset: 2,
  })
  context.page.drawText(copy.chip.toUpperCase(), {
    x: cardX + mm(5),
    y: cardY + cardH - mm(7.5),
    size: 6.5,
    font: context.fonts.mono,
    color: POSTER_PDF_COLOR.ink,
  })
  const accentIndex = copy.headline.indexOf(copy.headlineAccent)
  drawAccentHeadline(
    context.page,
    {
      beforeAccent: copy.headline.slice(0, accentIndex),
      accent: copy.headlineAccent,
      afterAccent: copy.headline.slice(
        accentIndex + copy.headlineAccent.length
      ),
    },
    {
      x: cardX + mm(3),
      y: cardY + cardH - mm(18),
      maxWidth: split - cardX - mm(6),
      font: context.fonts.bold,
      size: hookPt,
      lineHeight: hookPt,
      foreground: POSTER_PDF_COLOR.ink,
      accent: POSTER_PDF_COLOR.accent,
      maxLines: 3,
      uppercase: true,
    }
  )
  drawOfferedStampRow(context.page, context.stampsRequired, {
    x: cardX + mm(3),
    y: cardY + mm(23),
    width: split - cardX - mm(6),
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    font: context.fonts.mono,
  })
  drawWrappedText(context.page, copy.promise, {
    x: cardX + mm(3),
    y: cardY + mm(15),
    maxWidth: split - cardX - mm(6),
    font: context.fonts.regular,
    size: substantivePt,
    lineHeight: substantivePt + 2,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 2,
  })
  drawWrappedText(context.page, copy.ease, {
    x: cardX + mm(3),
    y: cardY + mm(4),
    maxWidth: split - cardX - mm(6),
    font: context.fonts.mono,
    size: factsPt,
    lineHeight: factsPt + 2,
    color: POSTER_PDF_COLOR.inkSoft,
    maxLines: 1,
  })
  const qrSize = mm(copy.qr.outerMm)
  drawQrAction(context.page, context.qrModules, copy.qrCaption, {
    x: split + (cardX + cardW - split - qrSize) / 2,
    y: cardY + (cardH - qrSize) / 2,
    size: qrSize,
    font: context.fonts.bold,
    color: POSTER_PDF_COLOR.ink,
    border: POSTER_PDF_COLOR.ink,
    captionSize: substantivePt,
  })
}

export function drawReceiptB5Face(
  context: PosterPdfBaseContext,
  content: NightTentContent,
  geometry: B5FaceGeometry
): void {
  const copy = content.faces.top
  const { hookPt, substantivePt, factsPt } = content.typeTiers
  drawB5FaceFrame(context, geometry, {
    reassurance: copy.reassurance,
    background: POSTER_PDF_COLOR.paperDeep,
    foreground: POSTER_PDF_COLOR.ink,
    accent: POSTER_PDF_COLOR.accent,
    identityBackground: POSTER_PDF_COLOR.paperDeep,
    factsBackground: POSTER_PDF_COLOR.paperDeep,
    factsSize: factsPt,
  })
  const split = geometry.x + geometry.width * 0.62
  context.page.drawRectangle({
    x: geometry.x,
    y: geometry.mainY,
    width: geometry.width,
    height: geometry.mainHeight,
    color: POSTER_PDF_COLOR.card,
  })
  context.page.drawText(copy.meta.toUpperCase(), {
    x: geometry.x + mm(4),
    y: geometry.mainY + geometry.mainHeight - mm(4),
    size: factsPt,
    font: context.fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
  })
  drawWrappedText(context.page, copy.headline.toUpperCase(), {
    x: geometry.x + mm(4),
    y: geometry.mainY + geometry.mainHeight - mm(13),
    maxWidth: split - geometry.x - mm(8),
    font: context.fonts.bold,
    size: hookPt,
    lineHeight: hookPt,
    color: POSTER_PDF_COLOR.ink,
    maxLines: 2,
  })
  let rowY = geometry.mainY + mm(34)
  for (const item of copy.items) {
    const line = `${item.label.toUpperCase()} / ${item.value.toUpperCase()}`
    context.page.drawText(line, {
      x: geometry.x + mm(4),
      y: rowY,
      size: factsPt,
      font: context.fonts.mono,
      color: POSTER_PDF_COLOR.ink,
    })
    rowY -= mm(7)
  }
  context.page.drawText(
    `${copy.totalLabel.toUpperCase()} / ${copy.totalValue.toUpperCase()}`,
    {
      x: geometry.x + mm(4),
      y: geometry.mainY + mm(12),
      size: factsPt,
      font: context.fonts.bold,
      color: POSTER_PDF_COLOR.ink,
    }
  )
  context.page.drawText(copy.friction.toUpperCase(), {
    x: geometry.x + mm(4),
    y: geometry.mainY + mm(5),
    size: factsPt,
    font: context.fonts.mono,
    color: POSTER_PDF_COLOR.inkSoft,
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
