import { redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { OnboardingForm } from "@/components/merchant/onboarding-form"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"

export default async function OnboardingPage() {
  const setup = await getMerchantOnboardingStatus()

  if (setup.status === "complete") {
    redirect("/app")
  }

  return (
    <section className="mx-auto grid w-full max-w-xl gap-6 rounded-3xl border bg-card p-6 shadow-xs">
      <PageTitle
        eyebrow="Merchant setup"
        title="Tell us about your business"
        description={
          setup.status === "missing_location"
            ? "Your business profile is saved. Add the first location to finish setup."
            : "Create one merchant profile and one first location for the MVP."
        }
        titleClassName="sm:text-3xl"
      />
      <OnboardingForm initialFields={setup.initialFields} />
    </section>
  )
}
