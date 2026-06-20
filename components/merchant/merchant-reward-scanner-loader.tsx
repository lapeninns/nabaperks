"use client"

import dynamic from "next/dynamic"
import Link from "next/link"

import { Eyebrow, ReceiptCard } from "@/components/brand"
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

function MerchantRewardScannerLoading() {
  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      <div className="grid gap-1.5">
        <Eyebrow>Reward collection</Eyebrow>
        <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">
          Scan reward QR
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Point your camera at the QR on the customer&apos;s phone. We will open
          the collection screen when it is ready to mark collected.
        </p>
      </div>

      <div
        aria-live="polite"
        className="grid min-h-64 place-items-center rounded-[var(--radius-lg)] border-2 border-dashed border-ink/35 bg-card"
      >
        <span className="font-mono text-[0.65rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Starting camera
        </span>
      </div>

      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/app">Back to home</Link>
      </Button>
    </ReceiptCard>
  )
}

export function MerchantRewardScannerLoader() {
  return <MerchantRewardScanner />
}
