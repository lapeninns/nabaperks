import Link from "next/link"

import { MonoTag } from "@/components/brand"
import type { HomeDashboard } from "@/lib/customer/home"

type HomeRedeemBannerProps = {
  topRedeemable: HomeDashboard["topRedeemable"]
}

/**
 * The one reward that is ready right now, as a pinned summary row.
 *
 * It used to be a full `ReceiptCard` — 24px padding, a text-lg h2, a support
 * sentence and a mono affordance, ~190px — printed immediately above a tile
 * that already carries the same venue name, the same "Reward ready" leaf tag
 * and the same "Open reward QR" affordance, and links to the same place
 * (CUS 02#8). Two identical calls to action stacked adjacently halve the
 * credibility of both and cost a third of a screen.
 *
 * Every word survives; the surface weight does not. The row is flat (no hard
 * shadow, no receipt padding) so the card tiles below it stay the heaviest
 * objects on the page, which is the whole point of the screen.
 */
export function HomeRedeemBanner({ topRedeemable }: HomeRedeemBannerProps) {
  if (!topRedeemable) return null

  return (
    <Link
      href={`/reward/${topRedeemable.rewardId}`}
      className="focus-ring block rounded-lg"
      aria-label={`Open reward QR for ${topRedeemable.rewardName} at ${topRedeemable.businessName}`}
    >
      <div className="surface-card-flat grid gap-1.5 bg-accent p-3 text-accent-foreground">
        <div className="flex items-center justify-between gap-2">
          <MonoTag tone="leaf">Ready for scan</MonoTag>
          <MonoTag tone="leaf">{topRedeemable.businessName}</MonoTag>
        </div>
        <p className="text-sm leading-tight font-extrabold break-words">
          {topRedeemable.rewardName}
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-xs leading-5 text-muted-foreground">
            Show this QR at the counter when you are ready.
          </p>
          <span className="mono-id shrink-0">Open reward QR</span>
        </div>
      </div>
    </Link>
  )
}
