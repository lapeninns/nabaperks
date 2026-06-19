import { PageTitle, ReceiptCard } from "@/components/brand"
import { OnboardingForm } from "@/components/merchant/onboarding-form"
import { MERCHANT_PREVIEW_MOCK } from "./mock-data"

const setupSteps = [
  {
    title: "Business profile",
    description: "Your name, your type of venue, and where customers find you.",
  },
  {
    title: "Mystery card",
    description:
      "Choose how many visits earn a reward, and what is in the pool.",
  },
  {
    title: "Launch QR",
    description: "Print the poster, till card, and sticker from the QR page.",
  },
]

/**
 * Mirror of `/app/onboarding`. Reuses the real `OnboardingForm` (client) with
 * mock `initialFields`, plus the surrounding `ReceiptCard` hero and "what
 * happens next" aside copied from the production page body.
 */
export function MerchantOnboardingScreen() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ReceiptCard className="grid gap-3">
        <PageTitle
          eyebrow="Merchant setup"
          title="Tell us about your business"
          description="Add your business and your first venue to get started."
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
      <OnboardingForm
        initialFields={{
          businessName: MERCHANT_PREVIEW_MOCK.businessName,
          businessType: MERCHANT_PREVIEW_MOCK.businessType,
          locationName: MERCHANT_PREVIEW_MOCK.locationName,
          phone: MERCHANT_PREVIEW_MOCK.phone,
        }}
      />

      <aside className="grid h-fit gap-4 rounded-lg border bg-secondary/60 p-5 shadow-xs lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div>
          <p className="eyebrow">What happens next</p>
          <h2 className="mt-2 text-xl leading-tight font-extrabold">
            From sign-up to your first stamp
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Save this form and we will walk you through the rest, one step at a
            time.
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
