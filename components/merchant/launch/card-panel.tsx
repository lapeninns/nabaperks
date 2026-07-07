import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { LaunchSaveNextAction } from "@/components/merchant/launch/launch-tab-auto-advance"
import { LoyaltyCardForm } from "@/components/merchant/loyalty-card-form"
import { StatusBanner } from "@/components/loyalty/status-banner"
import {
  clampStampsRequired,
  defaultLoyaltyCardName,
  resolveLoyaltyCardRewardTerms,
} from "@/lib/merchant/loyalty-card-copy"
import { DEFAULT_STAMPS_REQUIRED } from "@/lib/merchant/customer-readback"
import { getLoyaltyCardSetup } from "@/lib/merchant/loyalty-card"
import { CARD_CADENCE_PRESETS } from "@/lib/merchant/reward-presets"

export type CardPanelParams = {
  saved?: string
  error?: string
}

export async function CardPanel({
  params,
  advanceHref,
}: {
  params: CardPanelParams
  advanceHref?: string | null
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
          description="Add your venue before you build your loyalty card."
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
    )
  }

  return (
    <div className="grid min-w-0 gap-3 sm:gap-4">
      <CardStatus params={params} advanceHref={advanceHref} />
      <LoyaltyCardForm
        merchantName={merchant.business_name}
        locationName={location.name}
        activeRewardCount={
          rewardPoolItems.filter((item) => item.is_active).length
        }
        initialValues={{
          cardId: card?.id,
          cardName: card?.card_name ?? defaultLoyaltyCardName(merchant.business_name),
          stampsRequired: String(
            clampStampsRequired(
              card?.stamps_required ?? DEFAULT_STAMPS_REQUIRED
            )
          ),
          rewardTerms: resolveLoyaltyCardRewardTerms(
            clampStampsRequired(card?.stamps_required ?? DEFAULT_STAMPS_REQUIRED),
            card?.reward_terms
          ),
          isActive: card?.is_active ?? true,
        }}
        cadencePresets={CARD_CADENCE_PRESETS}
      />
    </div>
  )
}

function CardStatus({
  params,
  advanceHref,
}: {
  params: CardPanelParams
  advanceHref?: string | null
}) {
  if (params.saved === "1") {
    return (
      <StatusBanner tone="success" title="Mystery card saved.">
        Your visit-card settings are ready for member previews.
        {advanceHref ? (
          <LaunchSaveNextAction
            nextHref={advanceHref}
            nextLabel="your rewards"
            stayHref="/app/launch?tab=card"
          />
        ) : null}
      </StatusBanner>
    )
  }

  return null
}
