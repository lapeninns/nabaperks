import type { Metadata } from "next"

import { PageTitle } from "@/components/brand"
import { MerchantRewardScannerLoader } from "@/components/merchant/merchant-reward-scanner-loader"

export const metadata: Metadata = {
  title: "Scan customer code",
}

export const dynamic = "force-dynamic"

/**
 * The scan route's page chrome. The h1 used to live INSIDE the scanner's
 * ReceiptCard, so arriving from /app (title above the cards, 1152px column)
 * landed on a 576px column with the title inside a card — no page chrome to
 * orient by, and a visible layout jump on desktop (03#63). `app/app/scan
 * /loading.tsx` mirrors this shape exactly.
 */
export default function MerchantRewardScanPage() {
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
