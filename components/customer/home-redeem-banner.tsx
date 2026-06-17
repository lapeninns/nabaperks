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
      className="block rounded-[var(--radius)] transition-[box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/35"
      aria-label={`Open reward QR for ${topRedeemable.rewardName} at ${topRedeemable.businessName}`}
    >
      <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground transition-shadow duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none hover:shadow-md">
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
        <span className="font-mono text-[0.65rem] font-bold tracking-[0.08em] uppercase">
          Open reward QR
        </span>
      </ReceiptCard>
    </Link>
  )
}
