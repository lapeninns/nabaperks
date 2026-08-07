import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
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
    // Two children, two columns: the title + form share one left lane and the
    // roadmap is the second child. The old three-child grid only held together
    // because the aside pinned itself with explicit row/column placement.
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="grid min-w-0 gap-4">
        {/* No ReceiptCard around the heading: on lg its only other payload
            (the summary line) is hidden, so it framed a heading and nothing. */}
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
        <OnboardingForm
          initialFields={setup.initialFields}
          draftUserId={user!.id}
          googleMapsApiKey={getGoogleMapsPublicKey()}
        />
      </div>

      <OnboardingJourneyOrientation variant="roadmap" />
    </div>
  )
}
