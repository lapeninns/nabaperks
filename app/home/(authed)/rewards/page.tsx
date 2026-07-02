import Link from "next/link"
import { GiftIcon } from "@hugeicons/core-free-icons"

import {
  EmptyState,
  MonoTag,
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  getCustomerRewards,
  type CustomerRewardItem,
} from "@/lib/customer/rewards"
import { formatDate } from "@/lib/customer/format"

export const metadata = {
  title: "Your rewards · Nabaperks",
}

export default async function HomeRewardsPage() {
  const { redeemable, upcoming, redeemed, expired } = await getCustomerRewards()
  const hasAny =
    redeemable.length + upcoming.length + redeemed.length + expired.length > 0

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Rewards"
        description="Rewards you've earned across every venue, ready for merchant scan, on the way, and ones you've enjoyed."
      />

      {!hasAny ? (
        <EmptyState
          title="No rewards yet"
          description="Keep collecting stamps. When you complete a card, the reward lands here."
          icon={GiftIcon}
        />
      ) : (
        <div className="grid gap-8">
          {redeemable.length > 0 ? (
            <section className="grid gap-4">
              <SectionHeader eyebrow="Ready for scan" title="Show these now" />
              {redeemable.map((reward) => (
                <RedeemableReward key={reward.rewardId} reward={reward} />
              ))}
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section className="grid gap-4">
              <SectionHeader
                eyebrow="Coming soon"
                title="Almost there"
                description="Unlocked, but not redeemable just yet."
              />
              {upcoming.map((reward) => (
                <QuietReward
                  key={reward.rewardId}
                  reward={reward}
                  tone="sun"
                  note={
                    reward.redeemableFrom
                      ? `Ready from ${formatDate(reward.redeemableFrom)}.`
                      : "Available from the next UK business day."
                  }
                />
              ))}
            </section>
          ) : null}

          {redeemed.length > 0 ? (
            <section className="grid gap-4">
              <SectionHeader eyebrow="History" title="Redeemed" />
              {redeemed.map((reward) => (
                <QuietReward
                  key={reward.rewardId}
                  reward={reward}
                  tone="plain"
                  note={
                    reward.redeemedAt
                      ? `Redeemed ${formatDate(reward.redeemedAt)}.`
                      : "Redeemed."
                  }
                />
              ))}
            </section>
          ) : null}

          {expired.length > 0 ? (
            <section className="grid gap-4">
              <SectionHeader
                eyebrow="History"
                title="Expired"
                description="Rewards that are no longer available to scan."
              />
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
      )}
    </div>
  )
}

/**
 * Reward terms double as the hero-tile description, but empty or boilerplate
 * exclusion text (the lib/legal/content.ts fallback) reads as a broken
 * description under the reward name — hide it there (CUS-P3-17).
 */
function rewardDescription(reward: CustomerRewardItem): string | null {
  const terms = reward.rewardTerms?.trim()
  if (!terms || terms === "No additional exclusions configured.") return null
  return terms
}

function RedeemableReward({ reward }: { reward: CustomerRewardItem }) {
  const description = rewardDescription(reward)

  return (
    <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground">
      <div className="flex items-center justify-between gap-3">
        <MonoTag tone="leaf">{reward.businessName}</MonoTag>
        <MonoTag tone="leaf">Ready</MonoTag>
      </div>
      <h2 className="text-lg leading-tight font-extrabold">
        {reward.rewardName}
      </h2>
      {description ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <Button asChild size="lg" variant="reward" className="w-full">
        <Link href={`/reward/${reward.rewardId}`}>Open reward QR</Link>
      </Button>
    </ReceiptCard>
  )
}

function QuietReward({
  reward,
  tone,
  note,
}: {
  reward: CustomerRewardItem
  tone: "sun" | "plain"
  note: string
}) {
  return (
    <ReceiptCard className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <MonoTag tone={tone}>{reward.businessName}</MonoTag>
      </div>
      <h2 className="text-base leading-tight font-extrabold">
        {reward.rewardName}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">{note}</p>
    </ReceiptCard>
  )
}
