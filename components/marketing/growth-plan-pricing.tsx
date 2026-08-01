import Link from "next/link"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Icon, MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  OFFER,
  PLAN_INCLUDES,
  PRODUCT,
  ROUTES,
  TAKEOVER,
} from "@/lib/marketing/facts"

/**
 * The pricing sheet — one Growth Plan presented as a printed offer, not a
 * set of SaaS plan cards. A single ink-boundary sheet carries the shared
 * purchase sequence (launch fee today, free platform pilot, then a payment
 * schedule) and splits the two schedules inside ONE payment-selector band
 * divided by a ticket perforation, so the relationship reads inside five
 * seconds: same plan, two ways to pay, one shared feature list, one CTA.
 *
 * The bespoke takeover is deliberately OUTSIDE the sheet — a subordinate,
 * enquiry-only footnote, never a third tier. Every figure renders from
 * `lib/marketing/facts.ts`; the sheet stays server-rendered because the
 * schedule choice is information, not a checkout control (billing cadence
 * is chosen later, at billing activation).
 */
export function GrowthPlanPricing({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div data-growth-plan-pricing className="surface-card">
        <div className="grid gap-6 p-5 sm:p-7">
          <div className="grid gap-2">
            <p className="mono-meta text-muted-foreground">{OFFER.name}</p>
            <h2 className="text-2xl leading-tight font-extrabold text-foreground sm:text-3xl">
              {PRODUCT.planName}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {OFFER.riskFraming}
            </p>
          </div>

          <ol
            aria-label="How buying the Growth Plan works"
            className="grid border-t-2 border-dashed border-line-strong"
          >
            <li className="grid content-start gap-1 border-b-2 border-dashed border-border py-4 md:border-b-0 md:py-0 md:pr-5">
              <p className="mono-meta text-muted-foreground">Step 1 · Today</p>
              <p className="numeric-tabular text-2xl leading-none font-extrabold text-foreground sm:text-3xl">
                £{PRODUCT.launchFeeAmount}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Launch fee for the done-for-you launch, due at checkout.
              </p>
            </li>
            <li className="grid content-start gap-1 border-b-2 border-dashed border-border py-4 md:border-b-0 md:border-l-2 md:px-5 md:py-0">
              <p className="mono-meta text-muted-foreground">
                Step 2 · Days 1–28
              </p>
              <p className="text-2xl leading-none font-extrabold text-foreground sm:text-3xl">
                28 days
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Free platform pilot. Card required — recurring billing starts
                only after the pilot.
              </p>
            </li>
            <li className="grid content-start gap-1 py-4 md:border-l-2 md:border-dashed md:px-5 md:py-0 md:pr-0">
              <p className="mono-meta text-muted-foreground">
                Step 3 · After the pilot
              </p>
              <p className="text-2xl leading-none font-extrabold text-foreground sm:text-3xl">
                2 ways
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                The pilot ends, then one of two payment schedules begins.
              </p>
            </li>
          </ol>

          <div className="grid gap-3">
            <h3
              id="growth-plan-schedule-heading"
              className="text-lg leading-snug font-extrabold text-foreground"
            >
              Choose your payment schedule
            </h3>
            <ul
              aria-labelledby="growth-plan-schedule-heading"
              className="grid overflow-hidden rounded-lg border-2 border-ink md:grid-cols-2"
            >
              <li
                data-payment-option="28-day"
                className="grid content-start gap-2 p-4 sm:p-5"
              >
                <MonoTag className="justify-self-start">Pay as you go</MonoTag>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="numeric-tabular text-3xl leading-none font-extrabold text-foreground sm:text-4xl">
                    £{PRODUCT.priceAmount}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">
                    {PRODUCT.priceCadence}
                  </span>
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {PRODUCT.billingDisclosure}
                </p>
              </li>
              <li
                data-payment-option="annual"
                className="grid content-start gap-2 border-t-2 border-dashed border-line-strong p-4 sm:p-5 md:border-t-0 md:border-l-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <MonoTag tone="leaf" className="justify-self-start">
                    Prepay a year
                  </MonoTag>
                  <MonoTag tone="sun" className="justify-self-start">
                    {PRODUCT.annualSavingShort}
                  </MonoTag>
                </div>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="numeric-tabular text-3xl leading-none font-extrabold text-foreground sm:text-4xl">
                    £{PRODUCT.annualPriceAmount}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">
                    {PRODUCT.annualPriceCadence}
                  </span>
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {PRODUCT.annualBillingDisclosure} {PRODUCT.annualSaving}
                </p>
              </li>
            </ul>
          </div>

          <div className="grid gap-3 border-t-2 border-dashed border-border pt-5">
            <p className="text-sm leading-6 font-bold text-foreground">
              Both choices include the same Growth Plan:
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {PLAN_INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Icon
                    icon={CheckmarkCircle02Icon}
                    size={18}
                    className="mt-0.5 shrink-0 text-reward"
                  />
                  <span className="text-sm leading-6 text-foreground">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button asChild size="lg">
                <MarketingSignupLink>Start your launch</MarketingSignupLink>
              </Button>
            </div>
            <p className="mono-id text-muted-foreground uppercase">
              {PRODUCT.processingFeeLine} {PRODUCT.cancelLine}
            </p>
          </div>
        </div>
      </div>

      <div
        data-takeover-enquiry
        className="mt-5 grid gap-3 border-t-2 border-dashed border-border pt-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="grid gap-1">
          <p className="mono-meta text-muted-foreground">
            Bespoke engagement · enquiry only
          </p>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="numeric-tabular text-xl leading-tight font-extrabold text-foreground">
              {TAKEOVER.price}
            </span>
            <span className="text-sm font-bold text-foreground">
              {TAKEOVER.name}
            </span>
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {TAKEOVER.qualifier} Not a Growth Plan tier — no self-serve
            checkout.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-fit shrink-0">
          <Link href={ROUTES.demo}>{TAKEOVER.action}</Link>
        </Button>
      </div>
    </div>
  )
}
