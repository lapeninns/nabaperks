"use server"

import { recordProductEvent } from "@/lib/analytics/events"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { getNfcSquareDesign } from "@/lib/qr/nfc-square-templates"

import { buildQrNfcSquareDownloadEvent } from "./tracking"

/**
 * Fire-and-forget qr_downloaded for the NFC square print button. Analytics
 * never block or replace the browser print affordance.
 */
export async function recordNfcSquarePrintAction(designId: string) {
  try {
    const design = getNfcSquareDesign(designId)
    if (!design) return

    const { merchant, qrCode } = await getQrSetup()
    if (!merchant) return

    await recordProductEvent(
      buildQrNfcSquareDownloadEvent({
        merchantId: merchant.id,
        qrCodeId: qrCode?.id ?? null,
        designId: design.id,
      })
    )
  } catch {
    // Analytics are mirrors; the print affordance is the product.
  }
}
