import Link from "next/link"

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
import { formatDate, formatPence } from "@/lib/customer/format"

export const metadata = {
  title: "Your rewards — Nabaperks",
}

export default async function HomeRewardsPage() {
  const { redeemable, upcoming, redeemed } = await getCustomerRewards()
  const hasAny = redeemable.length + upcoming.length + redeemed.length > 0

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Rewards"
        description="Rewards you've earned across every venue — ready to redeem, on the way, and ones you've enjoyed."
      />

      {!hasAny ? (
        <EmptyState
          title="No rewards yet"
          description="Keep collecting stamps — when you complete a card, the reward lands here."
        />
      ) : (
        <div className="grid gap-8">
          {redeemable.length > 0 ? (
            <section className="grid gap-4">
              <SectionHeader eyebrow="Ready to redeem" title="Use these now" />
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
                      ? `Redeemable from ${formatDate(reward.redeemableFrom)}.`
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
        </div>
      )}
    </div>
  )
}

function rewardDescription(reward: CustomerRewardItem) {
  const parts = [reward.rewardTerms]
  if (reward.minSpendPence !== null) {
    parts.push(`Minimum spend ${formatPence(reward.minSpendPence)}.`)
  }
  return parts.filter(Boolean).join(" ")
}

function RedeemableReward({ reward }: { reward: CustomerRewardItem }) {
  return (
    <ReceiptCard className="grid gap-3 bg-accent text-accent-foreground">
      <div className="flex items-center justify-between gap-3">
        <MonoTag tone="leaf">{reward.businessName}</MonoTag>
        <MonoTag tone="leaf">Ready</MonoTag>
      </div>
      <h2 className="text-lg leading-tight font-extrabold">
        {reward.rewardName}
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        {rewardDescription(reward)}
      </p>
      <Button asChild size="lg" variant="reward" className="w-full">
        <Link href={`/reward/${reward.rewardId}`}>Show reward QR</Link>
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
