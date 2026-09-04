import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import {
  CadenceOption,
  PlanIncludesList,
  PricingSheet,
  PricingSheetBody,
  TakeoverAnchor,
} from "@/components/marketing/pricing"
import { SeasonalOfferBanner } from "@/components/marketing/seasonal-offer-banner"
import { OFFER, PLAN_INCLUDES, PRODUCT, ROUTES } from "@/lib/marketing/facts"

/**
 * On-page pricing — a compact preview of the two payment rhythms, then the
 * genuine enquiry-only bespoke alternative. All figures read from the shared
 * facts. Cadence is not chosen here.
 */
export function LandingPricing() {
  return (
    <Section id="pricing" size="dense">
      <SectionHeader
        eyebrow="Pricing"
        title="Launch first. Prove the platform. Then continue."
        description="The physical launch is paid today. Allow up to 14 days for poster delivery; the 28-day platform pilot starts on confirmed delivery, then recurring billing begins."
      />
      <div className="mx-auto mt-8 grid w-full max-w-5xl gap-6 sm:mt-10">
        <div className="grid min-w-0 items-stretch gap-4 md:grid-cols-2">
          <CadenceOption
            option="28-day"
            size="hero"
            tag={PRODUCT.planName}
            subtitle={PRODUCT.pilot}
            title={OFFER.name}
            amount={PRODUCT.priceAmount}
            cadence={PRODUCT.priceCadence}
            cadenceNote={PRODUCT.priceCadenceNote}
            description={
              <>
                {PRODUCT.launchFee} launch fee today, then the{" "}
                {PRODUCT.pilotCardNote} before recurring billing starts.
              </>
            }
          />
          <CadenceOption
            option="annual"
            size="hero"
            tone="ink"
            tag={PRODUCT.planName}
            subtitle={PRODUCT.annualRhythm}
            title={OFFER.name}
            amount={PRODUCT.annualPriceAmount}
            cadence={PRODUCT.annualPriceCadence}
            cadenceNote={PRODUCT.annualPriceCadenceNote}
            description={
              <>
                {PRODUCT.annualBillingDisclosure} {PRODUCT.annualSaving}
              </>
            }
          />
        </div>
        <PricingSheet>
          <PricingSheetBody className="gap-5">
            <SeasonalOfferBanner />
            <PlanIncludesList items={PLAN_INCLUDES.slice(0, 4)} columns={2} />
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <MarketingSignupLink>Start your launch</MarketingSignupLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={ROUTES.pricing}>See full pricing</Link>
              </Button>
            </div>
            <p className="mono-id text-muted-foreground uppercase">
              {PRODUCT.billingDisclosure} {PRODUCT.processingFeeLine}{" "}
              {PRODUCT.cancelLine}
            </p>
          </PricingSheetBody>
        </PricingSheet>
        <TakeoverAnchor />
      </div>
    </Section>
  )
}
