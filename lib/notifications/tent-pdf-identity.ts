import type { PDFPage } from "pdf-lib"

import type { TentContent } from "@/lib/qr/tent-content"

import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"
import type { TentFacePalette } from "./tent-pdf-pieces"
import { TENT_TYPE } from "./tent-pdf-typography"

/**
 * Per-design material identity for the tent faces — shapes only, drawn
 * behind the copy and QR content. regulars = ghosted beermat, welcome =
 * bunting over the QR corner, sealed = envelope flap and wax on the QR,
 * today = tear-off calendar pad, classic = the QR on a coaster.
 */

type TentIdentityFrame = {
  readonly originX: number
  readonly originY: number
  readonly width: number
  readonly height: number
  readonly palette: TentFacePalette
}

function qrCenter(frame: TentIdentityFrame, qrOuterMm: number) {
  const railH = mm(TENT_TYPE.railHeightMm)
  const footerH = mm(TENT_TYPE.footerPadMm * 2 + 3)
  const inset = mm(TENT_TYPE.railInsetMm)
  const actionWidth = frame.width * TENT_TYPE.actionColumnRatio
  const copyWidth =
    frame.width - inset * 2 - mm(TENT_TYPE.mainGapMm) - actionWidth
  const actionLeft = frame.originX + inset + copyWidth + mm(TENT_TYPE.mainGapMm)
  const mainTop = frame.originY + frame.height - railH
  const mainBottom = frame.originY + footerH
  const qrSize = mm(qrOuterMm)
  const stackH = qrSize + mm(TENT_TYPE.ctaGapMm) + mm(TENT_TYPE.ctaHeightMm)
  const stackTop = (mainTop + mainBottom) / 2 + stackH / 2
  return {
    centerX: actionLeft + actionWidth / 2,
    centerY: stackTop - qrSize / 2,
    qrTop: stackTop,
    qrSize,
  }
}

function drawBeermat(page: PDFPage, frame: TentIdentityFrame): void {
  const centerX = frame.originX + mm(62)
  const centerY = frame.originY + mm(70)
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: mm(38),
    borderColor: frame.palette.ink,
    borderWidth: mm(2.2),
    borderOpacity: 0.07,
  })
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: mm(31),
    borderColor: frame.palette.ink,
    borderWidth: 1.2,
    borderOpacity: 0.06,
    borderDashArray: [6, 5],
  })
}

function drawBunting(page: PDFPage, frame: TentIdentityFrame): void {
  const leftX = frame.originX + mm(134)
  const rightX = frame.originX + frame.width - mm(7)
  const endY = frame.originY + mm(128)
  const sagY = frame.originY + mm(124.5)
  const midX = (leftX + rightX) / 2
  for (const [x1, y1, x2, y2] of [
    [leftX, endY, midX, sagY],
    [midX, sagY, rightX, endY],
  ]) {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 1.1,
      color: frame.palette.soft,
      opacity: 0.55,
    })
  }
  const tones = [
    POSTER_PDF_COLOR.accent,
    POSTER_PDF_COLOR.sun,
    POSTER_PDF_COLOR.leaf,
  ]
  for (let flag = 0; flag < 5; flag += 1) {
    const t = (flag + 1) / 6
    const x = leftX + (rightX - leftX) * t
    const stringY =
      t < 0.5
        ? endY + (sagY - endY) * (t / 0.5)
        : sagY + (endY - sagY) * ((t - 0.5) / 0.5)
    const size = mm(4.6)
    pushKitRotation(page, 45, x, stringY - mm(3.2))
    page.drawRectangle({
      x: x - size / 2,
      y: stringY - mm(3.2) - size / 2,
      width: size,
      height: size,
      color: tones[flag % tones.length],
    })
    popKitRotation(page)
  }
}

function drawEnvelopeSeal(
  page: PDFPage,
  content: TentContent,
  frame: TentIdentityFrame
): void {
  const qr = qrCenter(frame, content.qr.outerMm)
  const apexY = qr.qrTop + mm(13.5)
  for (const side of [-1, 1]) {
    page.drawLine({
      start: { x: qr.centerX + (side * qr.qrSize) / 2, y: qr.qrTop },
      end: { x: qr.centerX, y: apexY },
      thickness: 1.4,
      color: frame.palette.ink,
      opacity: 0.55,
    })
  }
  page.drawCircle({
    x: qr.centerX,
    y: apexY,
    size: mm(3.4),
    color: POSTER_PDF_COLOR.accent,
    borderColor: frame.palette.ink,
    borderWidth: 1,
  })
  page.drawCircle({
    x: qr.centerX,
    y: apexY,
    size: mm(2.1),
    borderColor: frame.palette.ink,
    borderWidth: 0.8,
    borderOpacity: 0.35,
  })
  page.drawCircle({
    x: qr.centerX + mm(2.6),
    y: apexY - mm(4.6),
    size: mm(1),
    color: POSTER_PDF_COLOR.accent,
  })
}

function drawCalendarPad(page: PDFPage, frame: TentIdentityFrame): void {
  const railBottom = frame.originY + frame.height - mm(TENT_TYPE.railHeightMm)
  for (const holeX of [70, 140]) {
    page.drawCircle({
      x: frame.originX + mm(holeX),
      y: railBottom,
      size: mm(2),
      color: frame.palette.ground,
      borderColor: frame.palette.ink,
      borderWidth: 1.2,
    })
  }
  const cornerX = frame.originX + frame.width
  const cornerY = frame.originY
  const fold = mm(12)
  pushKitRotation(page, 45, cornerX, cornerY)
  page.drawRectangle({
    x: cornerX - fold / 2,
    y: cornerY - fold / 2,
    width: fold,
    height: fold,
    color: POSTER_PDF_COLOR.paperDeep,
    opacity: frame.palette.ground === POSTER_PDF_COLOR.ink ? 0.18 : 1,
  })
  popKitRotation(page)
  page.drawLine({
    start: { x: cornerX - mm(8.5), y: cornerY },
    end: { x: cornerX, y: cornerY + mm(8.5) },
    thickness: 1,
    color: frame.palette.soft,
    opacity: 0.5,
  })
}

function drawCoaster(
  page: PDFPage,
  content: TentContent,
  frame: TentIdentityFrame
): void {
  const qr = qrCenter(frame, content.qr.outerMm)
  page.drawCircle({
    x: qr.centerX,
    y: qr.centerY,
    size: mm(27),
    color: POSTER_PDF_COLOR.paperDeep,
    borderColor: frame.palette.soft,
    borderWidth: 1.6,
    borderOpacity: 0.5,
  })
  page.drawCircle({
    x: qr.centerX,
    y: qr.centerY,
    size: mm(23),
    borderColor: frame.palette.soft,
    borderWidth: 1,
    borderOpacity: 0.45,
    borderDashArray: [5, 4],
  })
}

export function drawTentIdentity(
  page: PDFPage,
  content: TentContent,
  frame: TentIdentityFrame
): void {
  switch (content.id) {
    case "regulars":
      return drawBeermat(page, frame)
    case "welcome":
      return drawBunting(page, frame)
    case "sealed":
      return drawEnvelopeSeal(page, content, frame)
    case "today":
      return drawCalendarPad(page, frame)
    case "classic":
      return drawCoaster(page, content, frame)
  }
}
