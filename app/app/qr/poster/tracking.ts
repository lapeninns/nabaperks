import type { ProductEventInput } from "@/lib/analytics/events"
import type { QrPosterTemplateId } from "@/lib/qr/poster-templates"

// analytics qr downloaded wire: the pure event builder behind the poster
// "Print or save PDF" affordance. Kept side-effect free so the unit tier can
// pin the event contract without a Supabase client.

export const POSTER_DOWNLOAD_ASSET_TYPE = "poster_pdf"

type PosterDownloadContext = {
  merchantId: string
  qrCodeId: string | null
  templateId: QrPosterTemplateId
}

export function buildQrPosterDownloadEvent({
  merchantId,
  qrCodeId,
  templateId,
}: PosterDownloadContext): ProductEventInput {
  return {
    eventName: "qr_downloaded",
    merchantId,
    qrCodeId,
    actorType: "merchant",
    actorId: merchantId,
    metadata: {
      asset_type: POSTER_DOWNLOAD_ASSET_TYPE,
      template: templateId,
      source: "poster_print_button",
    },
  }
}
