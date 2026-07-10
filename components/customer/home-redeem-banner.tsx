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
      className="focus-ring block rounded-[var(--radius)]"
      aria-label={`Open reward QR for ${topRedeemable.rewardName} at ${topRedeemable.businessName}`}
    >
      {/* No hover shadow utilities here: the unlayered card layer pins the
          slotted shadow, so hover:shadow-* is silently defeated (DESIGN.md). */}
      <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground">
        <div className="flex items-center justify-between gap-3">
          <MonoTag tone="leaf">Ready for scan</MonoTag>
          <MonoTag tone="leaf">{topRedeemable.businessName}</MonoTag>
        </div>
        <div className="grid gap-1">
          <h2 className="text-lg leading-tight font-extrabold">
            {topRedeemable.rewardName}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Show this QR at the counter when you are ready.
          </p>
        </div>
        <span className="mono-id tracking-[0.08em]">
          Open reward QR
        </span>
      </ReceiptCard>
    </Link>
  )
}
