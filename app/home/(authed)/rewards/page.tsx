import { GiftIcon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import {
  QuietReward,
  RedeemableReward,
} from "@/components/customer/reward-list-cards"
import { formatDate } from "@/lib/customer/format"
import { getCustomerRewards } from "@/lib/customer/rewards"

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
