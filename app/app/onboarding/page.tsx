import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { OnboardingForm } from "@/components/merchant/onboarding-form"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"

const setupSteps = [
  {
    title: "Business profile",
    description: "Name, type, and the first public-facing venue details.",
  },
  {
    title: "Mystery card",
    description: "Set the visit target and reward pool after onboarding.",
  },
  {
    title: "Launch QR",
    description: "Download the poster, till card, and sticker from the QR page.",
  },
]

export default async function OnboardingPage() {
  const setup = await getMerchantOnboardingStatus()

  if (setup.status === "complete") {
    redirect("/app")
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ReceiptCard className="grid gap-3">
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
      </ReceiptCard>
      <OnboardingForm initialFields={setup.initialFields} />

      <aside className="grid h-fit gap-4 rounded-lg border bg-secondary/60 p-5 shadow-xs lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div>
          <p className="eyebrow">Setup path</p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight">
            From profile to counter QR
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Finish this form, then Nabaperks keeps the next merchant steps in the
            app shell.
          </p>
        </div>
        <ol className="grid gap-3">
          {setupSteps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-card font-mono text-sm font-bold shadow-xs">
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
      </aside>
    </div>
  )
}
