import { notFound } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { OnboardingForm } from "@/components/merchant/onboarding-form"
import { MERCHANT_SETUP_STEPS } from "@/lib/merchant/launch-readiness-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Onboarding harness — runs under the "setup" shell variant (the layout maps the
 * `onboarding` lane to variant="setup", matching the real /app/onboarding which
 * has no sidebar). Reproduces the REAL page's own two-column layout
 * (app/app/onboarding/page.tsx) by importing the same real children it composes:
 * the PageTitle-in-ReceiptCard intro, the REAL {@link OnboardingForm} fed a
 * DB-free draft, and the "What happens next" aside built inline from the REAL
 * {@link MERCHANT_SETUP_STEPS} (the aside markup lives in the page, not a child,
 * so it is reproduced here verbatim per the real layout — no re-created copy).
 *
 * `draftUserId` scopes the form's browser draft storage; a fixed harness id keeps
 * captures deterministic. `googleMapsApiKey` is omitted so the place-autocomplete
 * degrades to its no-key state (no external Maps call from the harness).
 */
export default function OnboardingHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ReceiptCard className="grid gap-3">
        <PageTitle
          eyebrow="Merchant setup"
          title="Set up your business and first venue"
          description="Two parts here: your business profile, then your first venue — its name and the customer-facing address where scans happen."
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
      <OnboardingForm
        initialFields={{
          businessName: "Old Crown Girton",
          businessType: "pub",
          locationName: "Old Crown Girton",
          phone: "07700900421",
        }}
        draftUserId="usr_harness_onboarding"
        googleMapsApiKey=""
      />

      <aside className="grid h-fit lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <ReceiptCard padding="sm" className="grid gap-4">
          <div>
            <p className="eyebrow">What happens next</p>
            <h2 className="mt-2 text-xl leading-tight font-extrabold">
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
