import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { LoyaltyCardForm } from "@/components/merchant/loyalty-card-form"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { DEFAULT_STAMPS_REQUIRED } from "@/lib/merchant/customer-readback"
import { getLoyaltyCardSetup } from "@/lib/merchant/loyalty-card"

export type CardPanelParams = {
  saved?: string
  error?: string
}

export async function CardPanel({ params }: { params: CardPanelParams }) {
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
          description="Add your venue before you build your loyalty card."
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
    )
  }

  return (
    <div className="grid gap-5">
      <CardStatus params={params} />
      <LoyaltyCardForm
        merchantName={merchant.business_name}
        locationName={location.name}
        activeRewardCount={
          rewardPoolItems.filter((item) => item.is_active).length
        }
        initialValues={{
          cardId: card?.id,
          cardName: card?.card_name ?? "Mystery Visit Card",
          stampsRequired: String(
            Math.max(
              DEFAULT_STAMPS_REQUIRED,
              card?.stamps_required ?? DEFAULT_STAMPS_REQUIRED
            )
          ),
          rewardTerms:
            card?.reward_terms ??
            "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
          isActive: card?.is_active ?? true,
        }}
      />
    </div>
  )
}

function CardStatus({ params }: { params: CardPanelParams }) {
  if (params.saved === "1") {
    return (
      <StatusBanner tone="success" title="Mystery card saved.">
        Your visit-card settings are ready for customer previews.
      </StatusBanner>
    )
  }

  return null
}
