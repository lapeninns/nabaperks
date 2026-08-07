"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

import { ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

const MerchantRewardScanner = dynamic(
  () =>
    import("./merchant-reward-scanner").then(
      (module) => module.MerchantRewardScanner
    ),
  {
    ssr: false,
    loading: () => <MerchantRewardScannerLoading />,
  }
)

// No card header: the page-level PageTitle above this card owns the h1 and the
// lede, so it is already on screen while the scanner chunk loads (03#63).
function MerchantRewardScannerLoading() {
  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      <div
        role="status"
        aria-label="Starting camera"
        className="mx-auto grid aspect-square w-full max-w-sm place-items-center rounded-[var(--radius-lg)] border-2 border-dashed border-ink/35 bg-card"
      >
        <span className="mono-id tracking-tag text-muted-foreground">
          Starting camera
        </span>
      </div>

      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/app">Back to dashboard</Link>
      </Button>
    </ReceiptCard>
  )
}

export function MerchantRewardScannerLoader() {
  return <MerchantRewardScanner />
}
