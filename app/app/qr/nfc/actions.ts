"use server"

import { recordProductEvent } from "@/lib/analytics/events"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { getNfcCardDesign } from "@/lib/qr/nfc-card-templates"

import { buildQrNfcCardDownloadEvent } from "./tracking"

/**
 * Fire-and-forget qr_downloaded for the NFC card print button. Mirrors the
 * poster print wire: never awaited by the client, every failure swallowed.
 */
export async function recordNfcCardPrintAction(designId: string) {
  try {
    const design = getNfcCardDesign(designId)
    if (!design) return

    const { merchant, qrCode } = await getQrSetup()
    if (!merchant) return

    await recordProductEvent(
      buildQrNfcCardDownloadEvent({
        merchantId: merchant.id,
        qrCodeId: qrCode?.id ?? null,
        designId: design.id,
      })
    )
  } catch {
    // Analytics are mirrors; the print affordance is the product.
  }
}
