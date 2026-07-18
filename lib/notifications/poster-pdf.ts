import "server-only"

import QRCode from "qrcode"

import { QR_POSTER_TEMPLATES } from "@/lib/qr/poster-templates"

import { renderPosterPdf } from "./poster-pdf-render"
import type { PosterPdfInput } from "./poster-pdf-types"

export type PosterPdfAttachment = {
  readonly filename: string
  readonly content: string
}

export async function buildPosterPdfAttachments({
  merchantName,
  shareUrl,
  stampsRequired,
}: PosterPdfInput): Promise<readonly PosterPdfAttachment[]> {
  const boundedMerchantName = merchantName.trim().slice(0, 120)
  const qrModules = QRCode.create(shareUrl, {
    errorCorrectionLevel: "H",
  }).modules
  return Promise.all(
    QR_POSTER_TEMPLATES.map(async ({ id }) => ({
      filename: `nabaperks-poster-${id}.pdf`,
      content: await renderPosterPdf(
        id,
        boundedMerchantName,
        stampsRequired,
        qrModules
      ),
    }))
  )
}
