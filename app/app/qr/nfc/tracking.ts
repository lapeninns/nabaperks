import type { ProductEventInput } from "@/lib/analytics/events"
import type { NfcCardDesignId } from "@/lib/qr/nfc-card-templates"

export const NFC_CARD_DOWNLOAD_ASSET_TYPE = "nfc_card_pdf"

type NfcCardDownloadContext = {
  merchantId: string
  qrCodeId: string | null
  designId: NfcCardDesignId
}

export function buildQrNfcCardDownloadEvent({
  merchantId,
  qrCodeId,
  designId,
}: NfcCardDownloadContext): ProductEventInput {
  return {
    eventName: "qr_downloaded",
    merchantId,
    qrCodeId,
    actorType: "merchant",
    actorId: merchantId,
    metadata: {
      asset_type: NFC_CARD_DOWNLOAD_ASSET_TYPE,
      template: designId,
      source: "nfc_card_print_button",
    },
  }
}
