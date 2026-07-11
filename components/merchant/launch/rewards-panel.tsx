import Link from "next/link"
import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { BirthdayRewardPanel } from "@/components/merchant/launch/birthday-panel"
import { birthdayRewardTemplateForBusinessType } from "@/lib/merchant/birthday-reward-template"
import {
  RewardPoolForm,
  type RewardPoolItemValues,
} from "@/components/merchant/loyalty-card-form"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"
import { getLoyaltyCardSetup } from "@/lib/merchant/loyalty-card"
import { rewardPresetsForBusinessType } from "@/lib/merchant/reward-presets"

export type RewardsPanelParams = {
  saved?: string
  error?: string
  qr?: string
}

export async function RewardsPanel({
  params,
  needsBillingActivation = false,
}: {
  params: RewardsPanelParams
  needsBillingActivation?: boolean
}) {
  const { merchant, location, card, rewardPoolItems } =
    await getLoyaltyCardSetup()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!location) {
    return (
      <ReceiptCard>
        <PageTitle
          headingLevel={2}
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
          headingLevel={2}
          eyebrow="Rewards"
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
  const rewardsReady = activeRewardCount >= LAUNCH_MIN_ACTIVE_REWARDS

  return (
    <div className="grid min-w-0 gap-3 sm:gap-5">
      <RewardsStatus
        params={params}
        rewardsReady={rewardsReady}
        activeRewardPoolItemCount={activeRewardCount}
        needsBillingActivation={needsBillingActivation}
      />
      <RewardPoolForm
        loyaltyCardId={card.id}
        cardName={card.card_name}
        rewardPoolItems={poolItems}
        presets={rewardPresetsForBusinessType(merchant.business_type)}
      />
      <BirthdayRewardPanel
        loyaltyCardId={card.id}
        enabled={card.birthday_reward_enabled}
        rewardName={card.birthday_reward_name}
        rewardTerms={card.birthday_reward_terms}
        template={birthdayRewardTemplateForBusinessType(merchant.business_type)}
      />
    </div>
  )
}

function RewardsStatus({
  params,
  rewardsReady,
  activeRewardPoolItemCount,
  needsBillingActivation,
}: {
  params: RewardsPanelParams
  rewardsReady: boolean
  activeRewardPoolItemCount: number
  needsBillingActivation: boolean
}) {
  if (params.saved === "birthday") {
    return (
      <StatusBanner tone="success" title="Birthday reward saved.">
        Members with a saved birthday get it automatically during their birthday
        month.
      </StatusBanner>
    )
  }

  if (params.saved === "pool") {
    const title = needsBillingActivation
      ? "One step from live."
      : "Reward saved."
    const activeRewardCopy = `${activeRewardPoolItemCount} of 3 active rewards`

    return (
      <StatusBanner tone="success" title={title}>
        {needsBillingActivation
          ? "Proceed to billing to activate your venue and start accepting stamps."
          : params.qr === "created"
            ? "Your venue QR is live. Open it to copy or test the share link."
            : params.qr === "enabled"
              ? "Your venue QR is active again."
              : rewardsReady
                ? "Launch eligibility has been refreshed with your latest reward changes."
                : `${activeRewardCopy} are ready. Finish the reward pool before setup can complete.`}
        {!rewardsReady
          ? ` ${activeRewardCopy}. Add or activate one more reward before continuing.`
          : null}
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

  if (rewardsReady && !needsBillingActivation) {
    return (
      <StatusBanner tone="success" title="Your reward pool is ready.">
        Each reward is already saved. Create your QR once venue, card, and
        rewards are complete — billing is the final activation step.
      </StatusBanner>
    )
  }

  return null
}
