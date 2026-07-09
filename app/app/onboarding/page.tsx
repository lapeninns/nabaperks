import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { OnboardingForm } from "@/components/merchant/onboarding-form"
import { getGoogleMapsPublicKey } from "@/lib/env/google-maps-public-key"
import { MERCHANT_SETUP_STEPS } from "@/lib/merchant/launch-readiness-contract"
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
          title="Set up your business and first venue"
          description={
            setup.status === "missing_location"
              ? "Your business profile is saved. Now add your first venue — its name and customer-facing address."
              : "Two parts here: your business profile, then your first venue — its name and the customer-facing address where scans happen."
          }
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
      <OnboardingForm
        initialFields={setup.initialFields}
        draftUserId={user!.id}
        googleMapsApiKey={getGoogleMapsPublicKey()}
      />

      <aside className="grid h-fit lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <ReceiptCard padding="sm" className="grid gap-4">
          <div>
            <p className="eyebrow">What happens next</p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight">
              From sign-up to your first stamp
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Save this form and we will walk you through the rest, one step at
              a time.
            </p>
          </div>
          <ol className="grid gap-3">
            {MERCHANT_SETUP_STEPS.map((step, index) => (
              <li key={step.id} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="grid size-8 place-items-center rounded-full border-2 border-ink bg-card font-mono text-sm font-bold shadow-sm">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-extrabold">
                    {step.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </ReceiptCard>
      </aside>
    </div>
  )
}
