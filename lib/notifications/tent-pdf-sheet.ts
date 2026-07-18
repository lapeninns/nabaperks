import type { BitMatrix } from "qrcode"

import { resolveTentContent } from "@/lib/qr/tent-content"
import type { TableTentDesignId } from "@/lib/qr/tent-templates"

import { drawTentFace } from "./tent-pdf-face"
import { mm, POSTER_PDF_COLOR } from "./poster-pdf-style"
import { popKitRotation, pushKitRotation } from "./poster-pdf-kit-venue"
import type { PdfFonts } from "./poster-pdf-types"
import type { PDFPage } from "pdf-lib"

/**
 * Draw a whole fold-to-peak tent on one A4 page: Face A upright in the bottom
 * half, Face B rotated 180 degrees in the top half. Both faces share the one
 * venue QR. The fold is a physical crease, so no fold line is printed.
 */
export function drawTentA4(
  page: PDFPage,
  design: TableTentDesignId,
  merchantName: string,
  stampsRequired: number,
  qrModules: BitMatrix,
  fonts: PdfFonts
): void {
  const content = resolveTentContent(design, stampsRequired)
  const venue = merchantName.trim()
  const inset = mm(content.geometry.faceInsetMm)
  const faceWidth = mm(content.geometry.sheetWidthMm) - inset * 2
  const faceHeight = mm(content.geometry.faceHeightMm) - inset * 2

  page.drawRectangle({
    x: 0,
    y: 0,
    width: mm(content.geometry.sheetWidthMm),
    height: mm(content.geometry.sheetHeightMm),
    color: POSTER_PDF_COLOR.white,
  })

  drawTentFace(page, content, content.faceA, {
    originX: inset,
    originY: inset,
    width: faceWidth,
    height: faceHeight,
    venue,
    fonts,
    qrModules,
  })

  const topOriginY = mm(content.geometry.foldAtMm) + inset
  const centerX = mm(content.geometry.sheetWidthMm) / 2
  const centerY = topOriginY + faceHeight / 2
  pushKitRotation(page, 180, centerX, centerY)
  drawTentFace(page, content, content.faceB, {
    originX: inset,
    originY: topOriginY,
    width: faceWidth,
    height: faceHeight,
    venue,
    fonts,
    qrModules,
  })
  popKitRotation(page)
}
