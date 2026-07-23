import "server-only"

import QRCode from "qrcode"

import {
  NFC_CARD_DESIGNS,
  NFC_CARD_PRODUCTION_DESIGNS,
  type NfcCardDesignId,
} from "@/lib/qr/nfc-card-templates"

import { renderNfcCardPdf } from "./nfc-card-pdf-render"

export type NfcCardPdfInput = {
  readonly merchantName: string
  readonly shareUrl: string
  readonly stampsRequired: number
}

export type NfcCardPdfAttachment = {
  readonly filename: string
  readonly content: string
}

async function renderAttachments(
  designs: readonly { readonly id: NfcCardDesignId }[],
  { merchantName, shareUrl, stampsRequired }: NfcCardPdfInput
): Promise<readonly NfcCardPdfAttachment[]> {
  const boundedMerchantName = merchantName.trim().slice(0, 120)
  const qrModules = QRCode.create(shareUrl, {
    errorCorrectionLevel: "H",
  }).modules
  return Promise.all(
    designs.map(async ({ id }) => ({
      filename: `nabaperks-nfc-${id}.pdf`,
      content: await renderNfcCardPdf(
        id,
        boundedMerchantName,
        stampsRequired,
        qrModules
      ),
    }))
  )
}

/** The merchant NFC card bundle — production-rollout designs only. */
export async function buildNfcCardPdfAttachments(
  input: NfcCardPdfInput
): Promise<readonly NfcCardPdfAttachment[]> {
  return renderAttachments(NFC_CARD_PRODUCTION_DESIGNS, input)
}

/** Every registered NFC card, for print verification and proofing. */
export async function buildAllNfcCardPdfAttachments(
  input: NfcCardPdfInput
): Promise<readonly NfcCardPdfAttachment[]> {
  return renderAttachments(NFC_CARD_DESIGNS, input)
}
