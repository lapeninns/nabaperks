import "server-only"

import QRCode from "qrcode"

import {
  TENT_DESIGNS,
  TENT_PRODUCTION_DESIGNS,
  type TableTentDesignId,
} from "@/lib/qr/tent-templates"

import { renderTentPdf } from "./tent-pdf-render"

export type TentPdfInput = {
  readonly merchantName: string
  readonly shareUrl: string
  readonly stampsRequired: number
}

export type TentPdfAttachment = {
  readonly filename: string
  readonly content: string
}

async function renderAttachments(
  designs: readonly { readonly id: TableTentDesignId }[],
  { merchantName, shareUrl, stampsRequired }: TentPdfInput
): Promise<readonly TentPdfAttachment[]> {
  const boundedMerchantName = merchantName.trim().slice(0, 120)
  const qrModules = QRCode.create(shareUrl, {
    errorCorrectionLevel: "H",
  }).modules
  return Promise.all(
    designs.map(async ({ id }) => ({
      filename: `nabaperks-tent-${id}.pdf`,
      content: await renderTentPdf(
        id,
        boundedMerchantName,
        stampsRequired,
        qrModules
      ),
    }))
  )
}

/** The merchant tent bundle — production-rollout designs only. */
export async function buildTentPdfAttachments(
  input: TentPdfInput
): Promise<readonly TentPdfAttachment[]> {
  return renderAttachments(TENT_PRODUCTION_DESIGNS, input)
}

/** Every registered tent, for print verification and proofing. */
export async function buildAllTentPdfAttachments(
  input: TentPdfInput
): Promise<readonly TentPdfAttachment[]> {
  return renderAttachments(TENT_DESIGNS, input)
}
