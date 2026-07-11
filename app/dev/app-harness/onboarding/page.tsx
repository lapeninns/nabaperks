import { notFound } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { OnboardingJourneyOrientation } from "@/components/merchant/onboarding-journey-orientation"
import { OnboardingForm } from "@/components/merchant/onboarding-form"

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
          title="Set up your venue"
          description="Add the name customers see and the address where scans happen."
          titleClassName="sm:text-3xl"
        />
        <OnboardingJourneyOrientation variant="summary" />
      </ReceiptCard>
      <OnboardingForm
        initialFields={{
          businessName: "Old Crown Girton",
          businessType: "pub",
          phone: "07700900421",
        }}
        draftUserId="usr_harness_onboarding"
        googleMapsApiKey=""
      />

      <OnboardingJourneyOrientation variant="roadmap" />
    </div>
  )
}
