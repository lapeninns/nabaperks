import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { LoyaltyCardForm } from "@/components/merchant/loyalty-card-form"
import { StatusBanner } from "@/components/loyalty/status-banner"
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
        initialValues={{
          cardId: card?.id,
          cardName: card?.card_name ?? "Mystery Visit Card",
          stampsRequired: String(card?.stamps_required ?? 3),
          rewardTerms:
            card?.reward_terms ??
            "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
          minSpendPence: "",
          isActive: card?.is_active ?? true,
        }}
        rewardPoolItems={rewardPoolItems.map((item) => ({
          id: item.id,
          rewardName: item.reward_name,
          rewardTerms: item.reward_terms,
          minSpendPence:
            item.min_spend_pence === null ? "" : String(item.min_spend_pence),
          weight: String(item.weight),
          displayOrder: String(item.display_order),
          isActive: item.is_active,
        }))}
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
