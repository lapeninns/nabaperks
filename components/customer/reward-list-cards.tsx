import Link from "next/link"

import { MonoTag, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  rewardExpiryNote,
  rewardSourceBadge,
} from "@/lib/customer/issued-reward-display"
import type { CustomerRewardItem } from "@/lib/customer/rewards"

/**
 * The wallet reward cards, shared by the rewards page and the /dev home-harness.
 * Earned and issued rewards render the same; an issued reward (birthday /
 * merchant-sent) additionally carries a source badge and, when it expires, an
 * expiry note.
 *
 * Reward terms double as the hero-tile description, but empty or boilerplate
 * exclusion text (the lib/legal/content.ts fallback) reads as a broken
 * description under the reward name — hide it there (CUS-P3-17).
 */
function rewardDescription(reward: CustomerRewardItem): string | null {
  const terms = reward.rewardTerms?.trim()
  if (!terms || terms === "No additional exclusions configured.") return null
  return terms
}

export function RedeemableReward({ reward }: { reward: CustomerRewardItem }) {
  const description = rewardDescription(reward)
  const badge = rewardSourceBadge(reward.source, reward.businessName)
  const expiryNote = rewardExpiryNote(reward.expiresAt)

  return (
    <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MonoTag tone="leaf">{reward.businessName}</MonoTag>
          {badge ? <MonoTag tone="leaf">{badge}</MonoTag> : null}
        </div>
        <MonoTag tone="leaf">Ready</MonoTag>
      </div>
      <h2 className="text-lg leading-tight font-extrabold">
        {reward.rewardName}
      </h2>
      {description ? (
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {expiryNote ? (
        <p className="text-sm leading-6 text-muted-foreground">{expiryNote}</p>
      ) : null}
      <Button asChild size="lg" variant="reward" className="w-full">
        <Link href={`/reward/${reward.rewardId}`}>Open reward QR</Link>
      </Button>
    </ReceiptCard>
  )
}

export function QuietReward({
  reward,
  tone,
  note,
}: {
  reward: CustomerRewardItem
  tone: "sun" | "plain"
  note: string
}) {
  const badge = rewardSourceBadge(reward.source, reward.businessName)

  return (
    <ReceiptCard className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <MonoTag tone={tone}>{reward.businessName}</MonoTag>
        {badge ? <MonoTag tone={tone}>{badge}</MonoTag> : null}
      </div>
      <h2 className="text-base leading-tight font-extrabold">
        {reward.rewardName}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">{note}</p>
    </ReceiptCard>
  )
}
