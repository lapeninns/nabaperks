"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

import { ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

import { ScanCardHeader } from "./merchant-reward-scanner"

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

function MerchantRewardScannerLoading() {
  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      <ScanCardHeader />

      <div
        role="status"
        aria-label="Starting camera"
        className="grid min-h-64 place-items-center rounded-[var(--radius-lg)] border-2 border-dashed border-ink/35 bg-card"
      >
        <span className="mono-id tracking-[0.08em] text-muted-foreground">
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
