import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { QrPanelLive } from "@/components/merchant/launch/qr-panel-live"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Poster (QR) harness — mounts the REAL {@link QrPanelLive} (the presentational
 * body the /app/qr stream renders via QrPanel) with DB-free props, inside the
 * same "Venue QR" PageTitle the real route uses. The poster-template tiles link
 * out to the existing /app/qr/poster/[template] print route (and /dev has its
 * own poster-preview for those sheets). The QR <img> uses the exact `qr_harness`
 * id, which /app/qr/image serves as deterministic fixture bytes outside
 * production so the frame and image are both browser-provable without auth.
 */
export default function QrHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid min-w-0 gap-2 overflow-x-clip sm:gap-6">
      <PageTitle
        eyebrow="Counter poster"
        title="Venue QR"
        description="Your permanent scan code and printable A4 posters. Share the link anywhere or print a layout for the till."
      />
      <QrPanelLive
        activeCardName="Mystery Visit Card"
        stampsRequired={3}
        venueName="Old Crown Girton"
        qrCodeId="qr_harness"
        isActive
        billingReady
        scansAvailable
        shareUrl="https://nabaperks.com/q/old-crown-girton"
        hasVenueAddress
        returnHref="/app/qr"
      />
    </div>
  )
}
