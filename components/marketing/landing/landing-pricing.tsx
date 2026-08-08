import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  FinePrint,
  PlanIncludesList,
  PriceLockup,
  SeasonalOfferBanner,
  TakeoverAnchor,
} from "@/components/marketing"
import { OFFER, PLAN_INCLUDES, PRODUCT, ROUTES } from "@/lib/marketing/facts"

/**
 * On-page pricing — the standard self-serve plan and the genuine enquiry-only
 * bespoke alternative. All figures read from the shared facts.
 */
export function LandingPricing() {
  return (
    <Section id="pricing" size="dense">
      <SectionHeader
        size="band"
        eyebrow="Pricing"
        title="Launch first. Prove the platform. Then continue."
        description="The physical launch is paid today. Allow up to 14 days for poster delivery; the 28-day platform pilot starts on confirmed delivery, then recurring billing begins."
      />
      {/* The bespoke offer is `TakeoverAnchor`, the same component /pricing
          renders, stacked BELOW the plan — not a second column beside it. Its
          own docblock forbids the side-by-side arrangement ("a side-by-side
          column would read as a third tier, which the offer explicitly is
          not"), and the landing's hand-rolled copy had drifted to a different
          ground, a different tag tone, a different button width and a
          differently-worded enquiry-only disclaimer. */}
      <div className="mx-auto mt-5 grid w-full max-w-4xl gap-4 sm:mt-6">
        <Card className="border-primary">
          <CardContent className="grid content-start gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <MonoTag tone="accent">{PRODUCT.planName}</MonoTag>
              <MonoTag tone="sun">28-day platform pilot</MonoTag>
            </div>
            <p className="text-sm leading-6 font-bold text-muted-foreground">
              {OFFER.name}
            </p>
            <div className="grid gap-1">
              <PriceLockup
                size="hero"
                amount={PRODUCT.priceAmount}
                cadence={PRODUCT.priceCadence}
              />
              <p className="text-sm leading-6 font-bold text-foreground">
                {PRODUCT.launchFee} launch fee today, then the{" "}
                {PRODUCT.pilotCardNote} before recurring billing starts.
              </p>
              <div className="mt-2 grid gap-1 border-t-2 border-dashed border-border pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg leading-6 font-extrabold text-foreground">
                    Or {PRODUCT.annualPrice}
                  </p>
                  <MonoTag tone="sun">Best value</MonoTag>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {PRODUCT.annualBillingDisclosure} {PRODUCT.annualSaving}
                </p>
              </div>
            </div>
            <SeasonalOfferBanner />
            {/* The full list, not `slice(0, 4)`: dropping the fifth include
                meant `/` and `/pricing` published different contents for the
                same plan. */}
            <PlanIncludesList items={PLAN_INCLUDES} columns={2} />
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <MarketingSignupLink>Start your launch</MarketingSignupLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={ROUTES.pricing}>See full pricing</Link>
              </Button>
            </div>
            <FinePrint>
              {PRODUCT.billingDisclosure} {PRODUCT.processingFeeLine}{" "}
              {PRODUCT.cancelLine}
            </FinePrint>
          </CardContent>
        </Card>
        <TakeoverAnchor />
      </div>
    </Section>
  )
}
