import { notFound } from "next/navigation"

import { MerchantRewardScannerLoader } from "@/components/merchant/merchant-reward-scanner-loader"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Scan harness — mirrors /app/scan exactly: the narrow centered container around
 * the REAL {@link MerchantRewardScannerLoader}. The scanner itself is a
 * `next/dynamic(ssr:false)` client module wrapping the camera (html5-qrcode), so
 * headless it renders the loader fallback — the shared ScanCardHeader, the
 * "Starting camera" viewport placeholder, and the Back action — which is the
 * chrome this harness exists to screenshot.
 */
export default function ScanHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <MerchantRewardScannerLoader />
    </div>
  )
}
