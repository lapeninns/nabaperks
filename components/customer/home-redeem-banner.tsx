import Link from "next/link"

import { MonoTag, ReceiptCard } from "@/components/brand"
import type { HomeDashboard } from "@/lib/customer/home"

type HomeRedeemBannerProps = {
  topRedeemable: HomeDashboard["topRedeemable"]
}

export function HomeRedeemBanner({ topRedeemable }: HomeRedeemBannerProps) {
  if (!topRedeemable) return null

  return (
    <Link
      href={`/reward/${topRedeemable.rewardId}`}
      className="block rounded-[var(--radius)] transition outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
      aria-label={`Redeem ${topRedeemable.rewardName} at ${topRedeemable.businessName}`}
    >
      <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <MonoTag tone="leaf">Ready to redeem</MonoTag>
          <MonoTag tone="leaf">{topRedeemable.businessName}</MonoTag>
        </div>
        <div className="grid gap-1">
          <h2 className="text-lg leading-tight font-extrabold">
            {topRedeemable.rewardName}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Show this reward at the counter when you are ready.
          </p>
        </div>
        <span className="font-mono text-[0.65rem] font-bold tracking-[0.08em] uppercase">
          Redeem reward
        </span>
      </ReceiptCard>
    </Link>
  )
}
