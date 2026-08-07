import { GiftIcon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import {
  QuietReward,
  QuietRewardRow,
  RedeemableReward,
} from "@/components/customer/reward-list-cards"
import { formatDate } from "@/lib/customer/format"
import {
  getCustomerRewards,
  type CustomerRewardItem,
} from "@/lib/customer/rewards"

export const metadata = {
  title: "Your rewards · Nabaperks",
}

function redeemedNote(reward: CustomerRewardItem): string {
  return reward.redeemedAt
    ? `Redeemed ${formatDate(reward.redeemedAt)}.`
    : "Redeemed."
}

function expiredNote(reward: CustomerRewardItem): string {
  if (reward.expiredAt) return `Expired ${formatDate(reward.expiredAt)}.`
  if (reward.expiresAt) return `Expired ${formatDate(reward.expiresAt)}.`
  return "Expired."
}

export default async function HomeRewardsPage() {
  const { redeemable, upcoming, redeemed, expired } = await getCustomerRewards()
  const hasAny =
    redeemable.length + upcoming.length + redeemed.length + expired.length > 0
  const pastCount = redeemed.length + expired.length

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

          {/*
            Two zones, not four sections. The page used to open four
            permanently-expanded <section>s, two of them titled "History", each
            with a full SectionHeader (~50-70px) and one full ReceiptCard per
            reward (~120px, hard offset shadow). A realistic member — 2 ready, 1
            upcoming, 5 redeemed, 1 expired — scrolled ~1,850px, of which ~720px
            was archive nobody reads (CUS 02#36).

            Live rewards keep their cards. Everything finished collapses into
            one closed <details> of single-line rows, counted in the summary so
            the member knows what is in there without opening it. Nothing is
            deleted: redeemed and expired stay distinguishable by their own
            sub-heading inside.
          */}
          {pastCount > 0 ? (
            <details className="group surface-card p-4">
              <summary className="focus-ring -m-1 flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-1 text-base font-extrabold">
                Past rewards ({pastCount})
                <span
                  aria-hidden="true"
                  className="mono-meta text-muted-foreground group-open:hidden"
                >
                  Show
                </span>
                <span
                  aria-hidden="true"
                  className="mono-meta hidden text-muted-foreground group-open:inline"
                >
                  Hide
                </span>
              </summary>

              <div className="mt-4 grid gap-4">
                {redeemed.length > 0 ? (
                  <section className="grid gap-2">
                    <SectionHeader eyebrow="History" title="Redeemed" />
                    <ol className="grid">
                      {redeemed.map((reward) => (
                        <QuietRewardRow
                          key={reward.rewardId}
                          reward={reward}
                          note={redeemedNote(reward)}
                        />
                      ))}
                    </ol>
                  </section>
                ) : null}

                {expired.length > 0 ? (
                  <section className="grid gap-2">
                    <SectionHeader
                      eyebrow="History"
                      title="Expired"
                      description="Rewards that are no longer available to scan."
                    />
                    <ol className="grid">
                      {expired.map((reward) => (
                        <QuietRewardRow
                          key={reward.rewardId}
                          reward={reward}
                          note={expiredNote(reward)}
                        />
                      ))}
                    </ol>
                  </section>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </div>
  )
}
