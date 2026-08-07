import Link from "next/link"

import { MonoTag, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  rewardExpiryNote,
  rewardSourceBadge,
} from "@/lib/customer/issued-reward-display"
import type { CustomerRewardItem } from "@/lib/customer/rewards"
import { NO_ADDITIONAL_EXCLUSIONS } from "@/lib/legal/content"

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
  if (!terms || terms === NO_ADDITIONAL_EXCLUSIONS) return null
  return terms
}

export function RedeemableReward({ reward }: { reward: CustomerRewardItem }) {
  const description = rewardDescription(reward)
  const badge = rewardSourceBadge(reward.source, reward.businessName)
  const expiryNote = rewardExpiryNote(reward.expiresAt)

  return (
    <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground">
      {/* One venue tag left, one state tag right. The header used to print the
          venue name, then `rewardSourceBadge(source, businessName)` — which
          EMBEDS the venue name for a merchant-sent reward — then "Ready": three
          pills wrapping to two rows for any venue name over ~14 characters, and
          MonoTag truncates, so a long name became "THE OLD CROWN GI…" twice on
          the member's most valuable object (CUS 02#37). `flex-nowrap` with a
          truncating venue tag degrades predictably instead. */}
      <div className="flex flex-nowrap items-center justify-between gap-2">
        <MonoTag tone="leaf" className="min-w-0 flex-1">
          {reward.businessName}
        </MonoTag>
        <MonoTag tone="leaf" className="shrink-0">
          Ready
        </MonoTag>
      </div>
      <h2 className="text-lg leading-tight font-extrabold">
        {reward.rewardName}
      </h2>
      {/* The source is a sentence now, not a third pill — it reads as what it
          is ("Birthday treat from The Old Crown") instead of competing with the
          venue tag it repeats. */}
      {badge ? <p className="text-sm leading-6 font-bold">{badge}</p> : null}
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

/**
 * A past reward as a single line — the History disclosure's row.
 *
 * Archive was charged at full ReceiptCard weight with a hard offset shadow,
 * ~120px each, so a realistic member's six historic rewards outweighed their
 * two live ones 3:1 (CUS 02#36). Same three facts, ~44px.
 */
export function QuietRewardRow({
  reward,
  note,
}: {
  reward: CustomerRewardItem
  note: string
}) {
  return (
    <li className="flex flex-nowrap items-center gap-2 border-b border-dashed border-line py-2 last:border-b-0">
      <MonoTag tone="plain" className="max-w-[7rem] min-w-0 shrink-0">
        {reward.businessName}
      </MonoTag>
      <span className="min-w-0 flex-1 truncate text-sm leading-snug font-bold">
        {reward.rewardName}
      </span>
      <span className="mono-meta shrink-0 text-muted-foreground">{note}</span>
    </li>
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
