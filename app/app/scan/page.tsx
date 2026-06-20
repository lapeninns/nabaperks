import type { Metadata } from "next"

import { MerchantRewardScannerLoader } from "@/components/merchant/merchant-reward-scanner-loader"

export const metadata: Metadata = {
  title: "Scan reward QR",
}

export default function MerchantRewardScanPage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <MerchantRewardScannerLoader />
    </div>
  )
}
