import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  DFY_LAUNCH,
  OFFER,
  PLAN_INCLUDES,
  PRODUCT,
} from "@/lib/marketing/facts"
import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"
import {
  CampaignStrip,
  FinePrintStrip,
  PlanIncludesList,
  PriceLockup,
  PricingSheet,
  PricingSheetBody,
} from "./pricing"

/**
 * The pricing sheet — one Growth Plan presented as a printed offer, not a set
 * of SaaS plan cards.
 *
 * The recurring price is the sheet's dominant numeral; the annual schedule is
 * a secondary lockup beneath a perforation, not a co-equal column. That
 * asymmetry is the point: two equal columns read as a specification table and
 * leave the reader with nothing to anchor on.
 *
 * There is deliberately no billing toggle. The cadence is chosen later, at
 * billing activation — a control here would imply a decision that is not
 * actually being taken, and it would force the sheet to become a client
 * component. Both schedules stay rendered, always.
 *
 * The bespoke takeover is NOT rendered here; the page stacks TakeoverAnchor
 * below the sheet so it can never read as a third tier.
 */
export function GrowthPlanPricing({ className }: { className?: string }) {
  const offer = getActiveSeasonalOffer()

  return (
    <PricingSheet data-growth-plan-pricing className={className}>
      <CampaignStrip variant="strip" />
      <PricingSheetBody>
        <div className="grid min-w-0 gap-3 [&>*]:min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MonoTag tone="accent" className="-rotate-1">
              {PRODUCT.planName}
            </MonoTag>
            <MonoTag className="h-auto max-w-full basis-full whitespace-normal sm:basis-auto [&>span]:overflow-visible [&>span]:text-clip [&>span]:whitespace-normal">
              {PRODUCT.pilot}
            </MonoTag>
          </div>
          <h2 className="text-2xl leading-tight font-extrabold text-foreground sm:text-3xl">
            {OFFER.name}
          </h2>
        </div>

        <div className="grid gap-4">
          <div
            data-payment-option="28-day"
            role="group"
            aria-label="Pay as you go"
            className="grid gap-2"
          >
            <PriceLockup
              size="hero"
              amount={PRODUCT.priceAmount}
              cadence={PRODUCT.priceCadence}
            />
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              £{PRODUCT.launchFeeAmount} launch fee today, then the{" "}
              {PRODUCT.pilotCardNote} before recurring billing starts.
            </p>
          </div>

          <hr className="w-rule my-0 border-line-strong" />

          <div
            data-payment-option="annual"
            role="group"
            aria-label="Prepay a year"
            className="grid gap-2 sm:flex sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6"
          >
            <div className="grid gap-2">
              <PriceLockup
                size="lead"
                amount={PRODUCT.annualPriceAmount}
                cadence={PRODUCT.annualPriceCadence}
              />
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {PRODUCT.annualBillingDisclosure} {PRODUCT.annualSaving}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MonoTag className="w-fit shrink-0">Prepay a year</MonoTag>
              <MonoTag tone="sun" className="w-fit shrink-0 rotate-1">
                {PRODUCT.annualSavingShort}
              </MonoTag>
            </div>
          </div>
        </div>

        <ol
          aria-label="How buying the Growth Plan works"
          className="grid gap-0 border-y-2 border-dashed border-border text-muted-foreground"
        >
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dashed border-border py-2 last:border-b-0">
            <span className="mono-meta text-foreground">Today</span>
            {/* The amount is its own node so it can carry emphasis and
                tabular figures — and tests/e2e/growth-plan-pricing.spec.ts:42
                asserts an exact-text match on PRODUCT.launchFeeAmount alone,
                which requires exactly one element whose text is exactly the
                bare launch-fee figure, nothing folded into a sentence. */}
            <span className="text-sm leading-6">
              <span className="numeric-tabular text-foreground">
                £{PRODUCT.launchFeeAmount}
              </span>{" "}
              launch fee at checkout. {DFY_LAUNCH.covers}
            </span>
          </li>
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dashed border-border py-2 last:border-b-0">
            <span className="mono-meta text-foreground">
              Print and delivery
            </span>
            <span className="text-sm leading-6">
              <span className="font-extrabold text-foreground">
                Up to 14 days
              </span>{" "}
              to configure your launch, print your first poster run and deliver
              it to your venue.
            </span>
          </li>
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
            <span className="mono-meta text-foreground">
              From poster delivery
            </span>
            <span className="text-sm leading-6">
              <span className="font-extrabold text-foreground">
                28 days free
              </span>
              {". "}
              {PRODUCT.pilotAnchorLine} Recurring billing starts after that
              pilot.
            </span>
          </li>
        </ol>

        <div className="grid gap-3">
          <p className="text-sm leading-6 font-bold text-foreground">
            Both choices include the same Growth Plan:
          </p>
          <PlanIncludesList items={PLAN_INCLUDES} columns={2} />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild size="lg">
              <MarketingSignupLink>Start your launch</MarketingSignupLink>
            </Button>
          </div>
        </div>
      </PricingSheetBody>
      <FinePrintStrip>
        {PRODUCT.billingDisclosure} {PRODUCT.processingFeeLine}{" "}
        {PRODUCT.cancelLine}
        {offer ? ` ${offer.termsLine}` : ""}
      </FinePrintStrip>
    </PricingSheet>
  )
}
