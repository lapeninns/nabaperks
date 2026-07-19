import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { OnboardingJourneyOrientation } from "@/components/merchant/onboarding-journey-orientation"
import { OnboardingForm } from "@/components/merchant/onboarding-form"
import { getGoogleMapsPublicKey } from "@/lib/env/google-maps-public-key"
import { getCurrentUser } from "@/lib/auth/session"
import { merchantLoginHref } from "@/lib/navigation/safe-next-path"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"

export default async function OnboardingPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect(merchantLoginHref("/app/onboarding"))
  }

  const setup = await getMerchantOnboardingStatus()

  if (setup.status === "complete") {
    redirect("/app/launch")
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ReceiptCard className="grid gap-3">
        <PageTitle
          eyebrow="Merchant setup"
          title="Share your venue details"
          description={
            setup.status === "missing_location"
              ? "Your venue name is saved. Now share the address where customers visit."
              : "Share the name customers see and the address where scans happen."
          }
          titleClassName="sm:text-3xl"
        />
        <OnboardingJourneyOrientation variant="summary" />
      </ReceiptCard>
      <OnboardingForm
        initialFields={setup.initialFields}
        draftUserId={user!.id}
        googleMapsApiKey={getGoogleMapsPublicKey()}
      />

      <OnboardingJourneyOrientation variant="roadmap" />
    </div>
  )
}
