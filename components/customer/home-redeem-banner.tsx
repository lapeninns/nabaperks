import Link from "next/link"

import { MonoTag, ReceiptCard } from "@/components/brand"
import {
  REWARD_NEEDS_SETUP_ACTION,
  REWARD_NEEDS_SETUP_LINE,
} from "@/lib/customer/home-dashboard"
import type { HomeDashboard } from "@/lib/customer/home"

type HomeRedeemBannerProps = {
  topRedeemable: HomeDashboard["topRedeemable"]
}

/**
 * The one reward home leads with. A reward held only by setup is never called
 * ready and never promises a code: it says what is left and links to the
 * reward page, which asks for the next missing detail.
 */
export function HomeRedeemBanner({ topRedeemable }: HomeRedeemBannerProps) {
  if (!topRedeemable) return null

  const needsSetup = topRedeemable.needsSetup === true

  return (
    <Link
      href={`/reward/${topRedeemable.rewardId}`}
      className="focus-ring block min-w-0 rounded-[var(--radius)]"
      aria-label={
        needsSetup
          ? `Get ${topRedeemable.rewardName} at ${topRedeemable.businessName} ready to collect`
          : `Open ${topRedeemable.rewardName} at ${topRedeemable.businessName}`
      }
      data-reward-banner={needsSetup ? "needs-setup" : "ready"}
    >
      {/* No hover shadow utilities here: the unlayered card layer pins the
          slotted shadow, so hover:shadow-* is silently defeated (DESIGN.md). */}
      <ReceiptCard
        className={
          needsSetup
            ? "grid gap-3"
            : "grid gap-3 bg-accent text-accent-foreground"
        }
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <MonoTag tone={needsSetup ? "sun" : "leaf"}>
            {needsSetup ? "Reward unlocked" : "Ready to collect"}
          </MonoTag>
          <MonoTag tone={needsSetup ? "sun" : "leaf"}>
            {topRedeemable.businessName}
          </MonoTag>
        </div>
        <div className="grid min-w-0 gap-1">
          <h2 className="text-lg leading-tight font-extrabold [overflow-wrap:anywhere]">
            {topRedeemable.rewardName}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {needsSetup ? REWARD_NEEDS_SETUP_LINE : "Show this at the counter."}
          </p>
        </div>
        <span className="mono-id tracking-[0.08em]">
          {needsSetup ? REWARD_NEEDS_SETUP_ACTION : "Open reward"}
        </span>
      </ReceiptCard>
    </Link>
  )
}
