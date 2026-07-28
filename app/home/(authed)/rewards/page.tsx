import Link from "next/link"
import { redirect } from "next/navigation"
import { GiftIcon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import {
  QuietReward,
  RedeemableReward,
} from "@/components/customer/reward-list-cards"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/customer/format"
import { normalizeRewardHistoryPage } from "@/lib/customer/reward-history-pagination"
import { getCustomerRewards } from "@/lib/customer/rewards"

export const metadata = {
  title: "Your rewards · Nabaperks",
}

type HomeRewardsPageProps = {
  searchParams: Promise<{ page?: string | string[] }>
}

export default async function HomeRewardsPage({
  searchParams,
}: HomeRewardsPageProps) {
  const query = await searchParams
  const requestedPage = normalizeRewardHistoryPage(firstParam(query.page))
  const {
    redeemable,
    upcoming,
    redeemed,
    expired,
    historyPage,
    historyPageCount,
  } = await getCustomerRewards(requestedPage)

  if (historyPageCount > 0 && historyPage > historyPageCount) {
    redirect(`/home/rewards?page=${historyPageCount}`)
  }

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

          {historyPageCount > 1 ? (
            <nav
              aria-label="Reward history pages"
              className="flex items-center justify-between gap-3"
            >
              {historyPage > 1 ? (
                <Button asChild variant="secondary">
                  <Link href={`/home/rewards?page=${historyPage - 1}`}>
                    Newer history
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="mono-id text-muted-foreground">
                Page {historyPage} of {historyPageCount}
              </span>
              {historyPage < historyPageCount ? (
                <Button asChild variant="secondary">
                  <Link href={`/home/rewards?page=${historyPage + 1}`}>
                    Older history
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      )}
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
