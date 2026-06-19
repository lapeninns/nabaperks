import { PageTitle } from "@/components/brand"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import { LoyaltyCardForm } from "@/components/merchant/loyalty-card-form"
import {
  mockLaunchReadiness,
  LAUNCH_PREVIEW_MOCK,
} from "@/lib/dev/launch-preview"
import { MERCHANT_PREVIEW_MOCK } from "./mock-data"

/**
 * Mirror of `/app/launch` on the card tab. Reuses the real `LaunchReadinessPanel`
 * (plain) and `LoyaltyCardForm` (client) with mock fixtures — the same real
 * components the existing `launch-preview` harness drives, now shown inside the
 * merchant shell so the full launch layout is captured.
 */
export function MerchantLaunchScreen() {
  const readiness = mockLaunchReadiness({
    card: true,
    reward: true,
    venue: false,
    qr: false,
  })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Merchant setup"
        title="Bring your venue to life"
        description="Four stamps and you're live. We always point you at the one thing left to do."
      />

      <LaunchReadinessPanel
        readiness={readiness}
        showHeader={false}
        activeTab="card"
      />

      <div className="grid gap-5">
        <LoyaltyCardForm
          merchantName={MERCHANT_PREVIEW_MOCK.businessName}
          locationName={MERCHANT_PREVIEW_MOCK.locationName}
          initialValues={{
            cardId: "card-mock-1",
            cardName: LAUNCH_PREVIEW_MOCK.cardName,
            stampsRequired: String(LAUNCH_PREVIEW_MOCK.stampsRequired),
            rewardTerms: LAUNCH_PREVIEW_MOCK.rewardTerms,
            minSpendPence: "",
            isActive: true,
          }}
          rewardPoolItems={[
            {
              id: "reward-mock-1",
              rewardName: "Free filter coffee",
              rewardTerms:
                "Any filter coffee on the house. Valid from the next UK business day.",
              minSpendPence: "",
              weight: "1",
              displayOrder: "1",
              isActive: false,
            },
          ]}
        />
      </div>
    </div>
  )
}
