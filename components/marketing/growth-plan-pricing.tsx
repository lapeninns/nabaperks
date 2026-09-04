import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Eyebrow } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  DFY_LAUNCH,
  OFFER,
  PLAN_INCLUDES,
  PRICING,
  PRODUCT,
} from "@/lib/marketing/facts"
import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"
import {
  CadenceOption,
  PlanIncludesList,
  PricingSheet,
  PricingSheetBody,
} from "./pricing"

/**
 * The pricing composition — one Growth Plan, two payment rhythms as peer
 * cards, then a shared includes sheet.
 *
 * The 28-day and annual schedules are not plan tiers. Cadence is chosen
 * later, at billing activation; both schedules stay rendered, always, with
 * no toggle and no client component. Both card CTAs lead to the same
 * signup route.
 *
 * The bespoke takeover is NOT rendered here; the page stacks TakeoverAnchor
 * below so it can never read as a third tier.
 */
export function GrowthPlanPricing({ className }: { className?: string }) {
  const offer = getActiveSeasonalOffer()

  return (
    <div data-growth-plan-pricing className={className}>
      <div className="max-w-2xl">
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="mt-3 text-4xl leading-[0.95] font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-7xl">
          {PRICING.rhythmTitle}
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
          {PRICING.rhythmLead}
        </p>
      </div>

      <div className="mt-12 grid min-w-0 items-stretch gap-6 lg:mt-16 lg:grid-cols-2 lg:gap-8">
        <CadenceOption
          option="28-day"
          tag={PRODUCT.planName}
          subtitle={PRODUCT.pilot}
          title={OFFER.name}
          amount={PRODUCT.priceAmount}
          cadence={PRODUCT.priceCadence}
          cadenceNote={PRODUCT.priceCadenceNote}
          description={
            <>
              £{PRODUCT.launchFeeAmount} launch fee today, then the{" "}
              {PRODUCT.pilotCardNote} before recurring billing starts.
            </>
          }
          cta={PRICING.paygCta}
          secondary={
            <a
              href="#pricing-annual"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {PRICING.paygSecondary}
            </a>
          }
          steps={[
            {
              label: "Today",
              body: (
                <>
                  {/* The amount is its own node so it can carry emphasis and
                      tabular figures — and tests/e2e/growth-plan-pricing.spec.ts
                      asserts an exact-text match on PRODUCT.launchFeeAmount
                      alone. */}
                  <span className="numeric-tabular text-foreground">
                    £{PRODUCT.launchFeeAmount}
                  </span>{" "}
                  launch fee at checkout. {DFY_LAUNCH.covers}
                </>
              ),
            },
            {
              label: "Print and delivery",
              body: (
                <>
                  <span className="font-extrabold text-foreground">
                    Up to 14 days
                  </span>{" "}
                  to configure your launch, print your first poster run and
                  deliver it to your venue.
                </>
              ),
            },
            {
              label: "From poster delivery",
              body: (
                <>
                  <span className="font-extrabold text-foreground">
                    28 days free
                  </span>
                  {". "}
                  {PRODUCT.pilotAnchorLine} Recurring billing starts after that
                  pilot.
                </>
              ),
            },
          ]}
        />

        <CadenceOption
          option="annual"
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
          cta={PRICING.annualCta}
          secondary={PRODUCT.annualSavingShort}
          steps={[
            {
              label: "Today",
              body: (
                <>
                  £{PRODUCT.launchFeeAmount} launch fee at checkout.{" "}
                  {DFY_LAUNCH.covers}
                </>
              ),
            },
            {
              label: "From poster delivery",
              body: (
                <>
                  <span className="font-extrabold text-paper">
                    28 days free
                  </span>
                  {". "}
                  {PRODUCT.pilotAnchorLine}
                </>
              ),
            },
            {
              label: "Prepay a year",
              body: (
                <>
                  {PRODUCT.annualBillingDisclosure} {PRODUCT.annualSavingShort}.
                </>
              ),
            },
          ]}
        />
      </div>

      <PricingSheet className="mt-12 lg:mt-16">
        <PricingSheetBody className="gap-8">
          <p className="text-2xl leading-snug font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Both choices include the same Growth Plan:
          </p>
          <PlanIncludesList items={PLAN_INCLUDES} columns={2} size="lg" />
          <div className="flex flex-col gap-6 border-t-2 border-dashed border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid max-w-xl gap-1">
              <p className="mono-meta text-muted-foreground">Fine print</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {PRODUCT.billingDisclosure} {PRODUCT.processingFeeLine}{" "}
                {PRODUCT.cancelLine}
                {offer ? ` ${offer.termsLine}` : ""}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="shrink-0 bg-ink text-paper hover:bg-ink/90"
            >
              <MarketingSignupLink>Start your launch</MarketingSignupLink>
            </Button>
          </div>
        </PricingSheetBody>
      </PricingSheet>
    </div>
  )
}
