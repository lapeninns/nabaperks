import "server-only"

import QRCode from "qrcode"

import {
  QR_POSTER_PRODUCTION_TEMPLATES,
  QR_POSTER_TEMPLATES,
  type QrPosterTemplateId,
} from "@/lib/qr/poster-templates"

import { renderPosterPdf } from "./poster-pdf-render"
import type { PosterPdfInput } from "./poster-pdf-types"

export type PosterPdfAttachment = {
  readonly filename: string
  readonly content: string
}

async function renderAttachments(
  templates: readonly { readonly id: QrPosterTemplateId }[],
  { merchantName, shareUrl, stampsRequired }: PosterPdfInput
): Promise<readonly PosterPdfAttachment[]> {
  const boundedMerchantName = merchantName.trim().slice(0, 120)
  const qrModules = QRCode.create(shareUrl, {
    errorCorrectionLevel: "H",
  }).modules
  return Promise.all(
    templates.map(async ({ id }) => ({
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

/** The merchant email bundle — production-rollout templates only. */
export async function buildPosterPdfAttachments(
  input: PosterPdfInput
): Promise<readonly PosterPdfAttachment[]> {
  return renderAttachments(QR_POSTER_PRODUCTION_TEMPLATES, input)
}

/** Every registered template, for print verification and proofing. */
export async function buildAllPosterPdfAttachments(
  input: PosterPdfInput
): Promise<readonly PosterPdfAttachment[]> {
  return renderAttachments(QR_POSTER_TEMPLATES, input)
}
