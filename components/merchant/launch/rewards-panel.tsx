import Link from "next/link"
import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import {
  RewardPoolForm,
  type RewardPoolItemValues,
} from "@/components/merchant/loyalty-card-form"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { getLoyaltyCardSetup } from "@/lib/merchant/loyalty-card"

export type RewardsPanelParams = {
  saved?: string
  error?: string
}

export async function RewardsPanel({ params }: { params: RewardsPanelParams }) {
  const { merchant, location, card, rewardPoolItems } =
    await getLoyaltyCardSetup()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!location) {
    return (
      <ReceiptCard>
        <PageTitle
          title="Finish onboarding first"
          description="Add your venue before you build your reward pool."
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
    )
  }

  if (!card) {
    return (
      <ReceiptCard className="grid gap-4">
        <PageTitle
          eyebrow="Step 2 · Reward"
          title="Build your card first"
          description="The reward pool is tied to a saved visit card. Create the card, then come back here to load at least 3 active mystery rewards."
          titleClassName="sm:text-3xl"
        />
        <Button asChild className="w-fit">
          <Link href="/app/launch?tab=card">Go to card builder</Link>
        </Button>
      </ReceiptCard>
    )
  }

  const poolItems: RewardPoolItemValues[] = rewardPoolItems.map((item) => ({
    id: item.id,
    rewardName: item.reward_name,
    rewardTerms: item.reward_terms,
    weight: String(item.weight),
    displayOrder: String(item.display_order),
    isActive: item.is_active,
  }))

  return (
    <div className="grid gap-5">
      <RewardsStatus params={params} />
      <RewardPoolForm
        loyaltyCardId={card.id}
        cardName={card.card_name}
        rewardPoolItems={poolItems}
      />
    </div>
  )
}

function RewardsStatus({ params }: { params: RewardsPanelParams }) {
  if (params.saved === "pool") {
    return (
      <StatusBanner tone="success" title="Reward pool saved.">
        Launch eligibility has been refreshed with your latest reward changes.
      </StatusBanner>
    )
  }

  if (params.error) {
    return (
      <StatusBanner tone="error" title="Reward update failed.">
        Unable to update reward. Check the reward and try again.
      </StatusBanner>
    )
  }

  return null
}
