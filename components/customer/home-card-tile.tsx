import Link from "next/link"

import { Eyebrow, MonoTag, ReceiptCard, VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty"
import { homeCardStatusCopy } from "@/lib/customer/home-dashboard"
import type { HomeCard } from "@/lib/customer/home"

export function HomeCardTile({ card }: { card: HomeCard }) {
  const href = card.primaryRewardId
    ? `/reward/${card.primaryRewardId}`
    : `/card/${card.membershipId}`
  const rewardTag =
    card.primaryRewardId !== undefined
      ? { tone: "leaf" as const, label: "Reward ready" }
      : card.unlockedRewards > 0
        ? { tone: "sun" as const, label: "Reward soon" }
        : null

  return (
    <Link
      href={href}
      className="block rounded-[var(--radius)] transition outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
      aria-label={`Open your ${card.businessName} card`}
    >
      <ReceiptCard className="grid gap-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1">
            <Eyebrow>{card.cardName ?? "Loyalty card"}</Eyebrow>
            <h2 className="text-lg leading-tight font-extrabold text-balance">
              {card.businessName}
            </h2>
          </div>
          <VenueMark size={48} name={card.businessName} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonoTag tone={card.primaryRewardId ? "leaf" : "plain"}>
            {card.primaryRewardId ? "Show reward QR" : "Open card"}
          </MonoTag>
          {rewardTag ? (
            <MonoTag tone={rewardTag.tone}>{rewardTag.label}</MonoTag>
          ) : null}
        </div>

        {card.stampsRequired !== null && card.available ? (
          <StampGrid
            current={card.currentStamps}
            total={card.stampsRequired}
            dates={card.stampDates}
            showEmptySlotNumbers
            rewardSlot={card.primaryRewardId ? "ready" : "locked"}
            venueName={card.businessName}
            compact
            className="rounded-lg bg-accent p-3"
          />
        ) : (
          <div className="rounded-lg border-2 border-dashed border-ink/20 bg-card p-3" />
        )}

        <p className="text-sm leading-6 text-muted-foreground">
          {homeCardStatusCopy(card)}
        </p>
      </ReceiptCard>
    </Link>
  )
}
