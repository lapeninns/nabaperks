import "server-only"

import QRCode from "qrcode"

import {
  NFC_SQUARE_DESIGNS,
  NFC_SQUARE_PRODUCTION_DESIGNS,
  type NfcSquareDesignId,
} from "@/lib/qr/nfc-square-templates"

import { renderNfcSquarePdf } from "./nfc-square-pdf-render"

export type NfcSquarePdfInput = {
  readonly merchantName: string
  readonly shareUrl: string
  readonly stampsRequired: number
}

export type NfcSquarePdfAttachment = {
  readonly filename: string
  readonly content: string
}

async function renderAttachments(
  designs: readonly { readonly id: NfcSquareDesignId }[],
  { merchantName, shareUrl, stampsRequired }: NfcSquarePdfInput
): Promise<readonly NfcSquarePdfAttachment[]> {
  const boundedMerchantName = merchantName.trim().slice(0, 120)
  const qrModules = QRCode.create(shareUrl, {
    errorCorrectionLevel: "H",
  }).modules
  return Promise.all(
    designs.map(async ({ id }) => ({
      filename: `nabaperks-nfc-square-${id}.pdf`,
      content: await renderNfcSquarePdf(
        id,
        boundedMerchantName,
        stampsRequired,
        qrModules
      ),
    }))
  )
}

/** The merchant square NFC bundle — production-rollout designs only. */
export async function buildNfcSquarePdfAttachments(
  input: NfcSquarePdfInput
): Promise<readonly NfcSquarePdfAttachment[]> {
  return renderAttachments(NFC_SQUARE_PRODUCTION_DESIGNS, input)
}

/** Every registered square NFC card, for print verification and proofing. */
export async function buildAllNfcSquarePdfAttachments(
  input: NfcSquarePdfInput
): Promise<readonly NfcSquarePdfAttachment[]> {
  return renderAttachments(NFC_SQUARE_DESIGNS, input)
}
