import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { LoyaltyCardForm } from "@/components/merchant/loyalty-card-form"
import { getLoyaltyCardSetup } from "@/lib/merchant/loyalty-card"

type CardPageProps = {
  searchParams: Promise<{
    saved?: string
  }>
}

export default async function LoyaltyCardPage({ searchParams }: CardPageProps) {
  const { merchant, location, card, rewardPoolItems } =
    await getLoyaltyCardSetup()
  const params = await searchParams

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!location) {
    return (
      <section className="rounded-3xl border bg-card p-6 shadow-xs">
        <PageTitle
          title="Finish onboarding first"
          description="A primary location is required before creating an MVP loyalty card."
          titleClassName="sm:text-3xl"
        />
      </section>
    )
  }

  return (
    <div className="grid gap-5">
      {params.saved ? (
        <p className="rounded-2xl border border-reward/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Mystery card saved.
        </p>
      ) : null}
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
