"use server"

import { recordProductEvent } from "@/lib/analytics/events"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { getQrPosterTemplate } from "@/lib/qr/poster-templates"

import { buildQrPosterDownloadEvent } from "./tracking"

/**
 * MS-analytics-qr-downloaded-wire: record one qr_downloaded product event per
 * explicit poster print/save action. Fire-and-forget by contract — the client
 * never awaits this, and every failure is swallowed so printing can never be
 * delayed or broken by analytics. Merchant and QR attribution are resolved
 * server-side; the client supplies only the template id, validated against
 * the registry.
 */
export async function recordPosterPrintAction(templateId: string) {
  try {
    const template = getQrPosterTemplate(templateId)
    if (!template) return

    const { merchant, qrCode } = await getQrSetup()
    if (!merchant) return

    await recordProductEvent(
      buildQrPosterDownloadEvent({
        merchantId: merchant.id,
        qrCodeId: qrCode?.id ?? null,
        templateId: template.id,
      })
    )
  } catch {
    // Analytics are mirrors; the print affordance is the product.
  }
}
