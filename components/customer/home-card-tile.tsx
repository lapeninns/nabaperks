import Link from "next/link"

import { Eyebrow, MonoTag, ReceiptCard, VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty"
import { homeCardStatusCopy } from "@/lib/customer/home-dashboard"
import { formatRewardReadyDate } from "@/lib/customer/uk-calendar"
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
  const rewardSlot = card.primaryRewardId
    ? "ready"
    : card.unlockedRewards > 0
      ? "revealed"
      : "locked"
  const rewardReadyLabel = card.revealedRewardRedeemableFrom
    ? `Ready · ${formatRewardReadyDate(card.revealedRewardRedeemableFrom)}`
    : "Back next opening day"

  return (
    <Link
      href={href}
      className="block rounded-[var(--radius)] transition-[box-shadow] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/35"
      aria-label={`Open your ${card.businessName} card`}
    >
      <ReceiptCard className="grid gap-4 transition-shadow duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1">
            <Eyebrow>{card.cardName ?? "Loyalty card"}</Eyebrow>
            <h2 className="text-lg leading-tight font-extrabold text-balance break-words">
              {card.businessName}
            </h2>
          </div>
          <VenueMark size={48} name={card.businessName} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonoTag tone={card.primaryRewardId ? "leaf" : "plain"}>
            {card.primaryRewardId ? "Open reward QR" : "Open card"}
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
            rewardSlot={rewardSlot}
            venueName={card.businessName}
            compact
            className="rounded-lg bg-accent p-3"
          />
        ) : (
          <div className="rounded-lg border-2 border-dashed border-ink/20 bg-card p-3" />
        )}

        {rewardSlot === "revealed" ? (
          <div
            data-reward-ticket="revealed"
            className="grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3"
          >
            <Eyebrow>Your reward</Eyebrow>
            {/* Reward name wraps freely on its own row — never truncated or clipped. */}
            <p className="text-sm leading-tight font-extrabold break-words">
              {card.revealedRewardName ?? "Your reward"}
            </p>
            <span className="w-fit max-w-full rounded-md border-2 border-ink bg-seal/25 px-2 py-0.5 font-mono text-[0.625rem] font-bold tracking-[0.06em] uppercase">
              {rewardReadyLabel}
            </span>
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {homeCardStatusCopy(card)}
          </p>
        )}
      </ReceiptCard>
    </Link>
  )
}
