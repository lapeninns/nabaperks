import Link from "next/link"
import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { LaunchSaveNextAction } from "@/components/merchant/launch/launch-tab-auto-advance"
import {
  RewardPoolForm,
  type RewardPoolItemValues,
} from "@/components/merchant/loyalty-card-form"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { getLoyaltyCardSetup } from "@/lib/merchant/loyalty-card"
import { seedDefaultRewardPoolIfEmpty } from "@/lib/merchant/seed-default-reward-pool"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type RewardsPanelParams = {
  saved?: string
  seeded?: string
  error?: string
}

export async function RewardsPanel({
  params,
  advanceHref,
  continueHref,
  continueLabel,
}: {
  params: RewardsPanelParams
  advanceHref?: string | null
  continueHref?: string | null
  continueLabel?: string
}) {
  let { merchant, location, card, rewardPoolItems } =
    await getLoyaltyCardSetup()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (card && rewardPoolItems.length === 0) {
    const supabase = await createSupabaseServerClient()
    const seeded = await seedDefaultRewardPoolIfEmpty(
      supabase,
      merchant.id,
      card.id
    )

    if (seeded) {
      redirect("/app/launch?tab=rewards&saved=pool&seeded=1")
    }
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
  const activeRewardCount = poolItems.filter((item) => item.isActive).length
  const rewardsReady = activeRewardCount >= 3

  return (
    <div className="grid gap-5">
      <RewardsStatus
        params={params}
        advanceHref={advanceHref}
        continueHref={continueHref}
        continueLabel={continueLabel}
        rewardsReady={rewardsReady}
        activeRewardPoolItemCount={activeRewardCount}
      />
      <RewardPoolForm
        loyaltyCardId={card.id}
        cardName={card.card_name}
        rewardPoolItems={poolItems}
        continueHref={continueHref}
        continueLabel={continueLabel}
      />
    </div>
  )
}

function RewardsStatus({
  params,
  advanceHref,
  continueHref,
  continueLabel,
  rewardsReady,
  activeRewardPoolItemCount,
}: {
  params: RewardsPanelParams
  advanceHref?: string | null
  continueHref?: string | null
  continueLabel?: string
  rewardsReady: boolean
  activeRewardPoolItemCount: number
}) {
  if (params.saved === "pool") {
    const title =
      params.seeded === "1" ? "Starter rewards loaded." : "Reward saved."
    const activeRewardCopy = `${activeRewardPoolItemCount} of 3 active rewards`

    return (
      <StatusBanner tone="success" title={title}>
        {rewardsReady
          ? params.seeded === "1"
            ? "Three default rewards are active and saved. Your QR step goes live automatically once the earlier checks are complete."
            : "Launch eligibility has been refreshed with your latest reward changes."
          : `${activeRewardCopy} are ready. Finish the reward pool before setup can complete.`}
        <LaunchSaveNextAction
          nextHref={advanceHref ?? continueHref ?? null}
          nextLabel={continueLabel ?? "the next step"}
          stayHref="/app/launch?tab=rewards"
          blockedReason={
            rewardsReady
              ? undefined
              : `${activeRewardCopy}. Add or activate one more reward before continuing.`
          }
        />
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

  if (rewardsReady) {
    return (
      <StatusBanner tone="success" title="Your reward pool is ready.">
        Each reward is already saved. Your QR step goes live automatically once
        venue, card, rewards, and billing are complete.
      </StatusBanner>
    )
  }

  return null
}
