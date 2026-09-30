import Link from "next/link"
import { GiftIcon } from "@hugeicons/core-free-icons"

import {
  EmptyState,
  MonoTag,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/customer/format"
import {
  REWARD_NEEDS_SETUP_ACTION,
  REWARD_NEEDS_SETUP_LINE,
} from "@/lib/customer/home-dashboard"
import {
  rewardExpiryNote,
  rewardSourceBadge,
} from "@/lib/customer/issued-reward-display"
import type {
  CustomerRewards,
  CustomerRewardItem,
} from "@/lib/customer/rewards"
import {
  formatCollectionAvailability,
  formatCollectionDeadline,
  PHOTO_ID_REQUIRED_REASON,
  rewardCollectionBlockedCopy,
} from "@/lib/customer/reward-collection-state"
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
  const expiryNote =
    formatCollectionDeadline(reward.expiresAt) ??
    rewardExpiryNote(reward.expiresAt)

  return (
    <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MonoTag tone="leaf">{reward.businessName}</MonoTag>
          {badge ? <MonoTag tone="leaf">{badge}</MonoTag> : null}
        </div>
        <MonoTag tone="leaf">Ready</MonoTag>
      </div>
      <h3 className="text-lg leading-tight font-extrabold">
        {reward.rewardName}
      </h3>
      {description ? (
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {reward.collectionReason === PHOTO_ID_REQUIRED_REASON ? (
        <p className="text-sm leading-6 font-bold">
          Staff will check photo ID.
        </p>
      ) : null}
      {expiryNote ? (
        <p className="text-sm leading-6 text-muted-foreground">{expiryNote}</p>
      ) : null}
      <Button asChild size="lg" variant="reward" className="w-full">
        <Link href={`/reward/${reward.rewardId}`}>Open reward</Link>
      </Button>
    </ReceiptCard>
  )
}

/**
 * An unlocked reward held only by a missing detail. Never styled or worded as
 * ready and never linked to a code: it links to the reward page, which asks
 * for the next missing detail with the reward kept on screen.
 */
export function SetupReward({ reward }: { reward: CustomerRewardItem }) {
  const badge = rewardSourceBadge(reward.source, reward.businessName)

  return (
    <ReceiptCard className="grid gap-3" data-reward-list="needs-setup">
      <div className="flex flex-wrap items-center gap-2">
        <MonoTag tone="sun">{reward.businessName}</MonoTag>
        {badge ? <MonoTag tone="sun">{badge}</MonoTag> : null}
      </div>
      <h3 className="text-base leading-tight font-extrabold">
        {reward.rewardName}
      </h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {REWARD_NEEDS_SETUP_LINE}
      </p>
      <Button asChild size="lg" variant="secondary" className="w-full">
        <Link href={`/reward/${reward.rewardId}`}>
          {REWARD_NEEDS_SETUP_ACTION}
        </Link>
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
  const collectionNote =
    reward.collectionState === "blocked"
      ? rewardCollectionBlockedCopy(reward.collectionReason)
      : note

  return (
    <ReceiptCard className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <MonoTag tone={tone}>{reward.businessName}</MonoTag>
        {badge ? <MonoTag tone={tone}>{badge}</MonoTag> : null}
      </div>
      <h3 className="text-base leading-tight font-extrabold">
        {reward.rewardName}
      </h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {collectionNote}
      </p>
    </ReceiptCard>
  )
}

/**
 * The Rewards tab body, grouped by what the guest can do: ready to collect,
 * needs setting up, on the way, collected, and no longer available. Shared by
 * the real page and its DB-free harness so the two cannot drift.
 */
export function RewardListSections({ rewards }: { rewards: CustomerRewards }) {
  const { redeemable, needsSetup, upcoming, redeemed, expired } = rewards
  const hasAny =
    redeemable.length +
      needsSetup.length +
      upcoming.length +
      redeemed.length +
      expired.length >
    0

  if (!hasAny) {
    return (
      <EmptyState
        title="No rewards yet"
        description="Keep collecting stamps. When you complete a card, the reward shows here."
        icon={GiftIcon}
      />
    )
  }

  return (
    <div className="grid gap-8">
      {redeemable.length > 0 ? (
        <section className="grid gap-4">
          <SectionHeader eyebrow="Rewards" title="Ready to collect" />
          {redeemable.map((reward) => (
            <RedeemableReward key={reward.rewardId} reward={reward} />
          ))}
        </section>
      ) : null}

      {needsSetup.length > 0 ? (
        <section className="grid gap-4">
          <SectionHeader
            eyebrow="Rewards"
            title="Needs setting up"
            description="Add the details a venue needs, then show your reward code."
          />
          {needsSetup.map((reward) => (
            <SetupReward key={reward.rewardId} reward={reward} />
          ))}
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="grid gap-4">
          <SectionHeader eyebrow="Rewards" title="On the way" />
          {upcoming.map((reward) => (
            <QuietReward
              key={reward.rewardId}
              reward={reward}
              tone="sun"
              note={
                formatCollectionAvailability(reward.availableFrom) ??
                "Open the reward to see when it's ready."
              }
            />
          ))}
        </section>
      ) : null}

      {redeemed.length > 0 ? (
        <section className="grid gap-4">
          <SectionHeader eyebrow="History" title="Collected" />
          {redeemed.map((reward) => (
            <QuietReward
              key={reward.rewardId}
              reward={reward}
              tone="plain"
              note={
                reward.redeemedAt
                  ? `Collected ${formatDate(reward.redeemedAt)}.`
                  : "Collected."
              }
            />
          ))}
        </section>
      ) : null}

      {expired.length > 0 ? (
        <section className="grid gap-4">
          <SectionHeader eyebrow="History" title="No longer available" />
          {expired.map((reward) => (
            <QuietReward
              key={reward.rewardId}
              reward={reward}
              tone="plain"
              note={
                reward.expiredAt
                  ? `Expired ${formatDate(reward.expiredAt)}.`
                  : reward.expiresAt
                    ? `Expired ${formatDate(reward.expiresAt)}.`
                    : "Expired."
              }
            />
          ))}
        </section>
      ) : null}
    </div>
  )
}
