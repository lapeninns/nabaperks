import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { MerchantRewardScannerLoader } from "@/components/merchant/merchant-reward-scanner-loader"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Scan harness — mirrors /app/scan exactly: the page-level PageTitle (which now
 * owns the route's h1, 03#63) above the narrow centered container around the
 * REAL {@link MerchantRewardScannerLoader}. The scanner itself is a
 * `next/dynamic(ssr:false)` client module wrapping the camera (html5-qrcode), so
 * headless it renders the loader fallback — the "Starting camera" viewport
 * placeholder and the Back action — which is the chrome this harness exists to
 * screenshot.
 */
export default function ScanHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <PageTitle
        eyebrow="Customer codes"
        title="Scan customer code"
        description="Point your camera at the code on the customer's phone. It can be a reward to collect or a discount pass to honour, and we will open the right screen for it."
      />
      <MerchantRewardScannerLoader />
    </div>
  )
}
