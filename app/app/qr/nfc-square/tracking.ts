import type { ProductEventInput } from "@/lib/analytics/events"
import type { NfcSquareDesignId } from "@/lib/qr/nfc-square-templates"

export const NFC_SQUARE_DOWNLOAD_ASSET_TYPE = "nfc_square_pdf"

type NfcSquareDownloadContext = {
  merchantId: string
  qrCodeId: string | null
  designId: NfcSquareDesignId
}

export function buildQrNfcSquareDownloadEvent({
  merchantId,
  qrCodeId,
  designId,
}: NfcSquareDownloadContext): ProductEventInput {
  return {
    eventName: "qr_downloaded",
    merchantId,
    qrCodeId,
    actorType: "merchant",
    actorId: merchantId,
    metadata: {
      asset_type: NFC_SQUARE_DOWNLOAD_ASSET_TYPE,
      template: designId,
      source: "nfc_square_print_button",
    },
  }
}
