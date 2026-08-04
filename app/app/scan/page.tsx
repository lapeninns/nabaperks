import type { Metadata } from "next"

import { MerchantRewardScannerLoader } from "@/components/merchant/merchant-reward-scanner-loader"

export const metadata: Metadata = {
  title: "Scan customer code",
}

export const dynamic = "force-dynamic"

export default function MerchantRewardScanPage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <MerchantRewardScannerLoader />
    </div>
  )
}
