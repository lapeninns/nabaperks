import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Eyebrow, ReceiptCard } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { CLAIMS_BOUNDARY, GUARANTEE, PRODUCT } from "@/lib/marketing/facts"

/** Closing pitch: the billing schedule as receipt lines, then the CTA. */
export function FinalCta() {
  return (
    <Section id="start" size="dense">
      <ReceiptCard
        edge
        padding="md"
        className="items-center gap-3 text-center sm:gap-4 sm:[--card-spacing:--spacing(8)]"
      >
        <Eyebrow className="justify-self-center">Ready when you are</Eyebrow>
        <h2 className="max-w-2xl justify-self-center text-2xl leading-tight font-extrabold text-balance text-foreground sm:text-3xl">
          Give your weekend customers a reason to come back midweek
        </h2>
        <dl className="grid w-full max-w-xl gap-2 justify-self-center text-left">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-dashed border-border pb-2">
            <dt className="mono-id text-muted-foreground uppercase">Today</dt>
            <dd className="text-sm leading-6 font-bold text-foreground">
              {PRODUCT.launchFee} done-for-you launch
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-dashed border-border pb-2">
            <dt className="mono-id text-muted-foreground uppercase">
              Up to 14 days
            </dt>
            <dd className="text-sm leading-6 font-bold text-foreground">
              Posters printed and delivered
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-dashed border-border pb-2">
            <dt className="mono-id text-muted-foreground uppercase">
              Delivery day
            </dt>
            <dd className="text-sm leading-6 font-bold text-foreground">
              Your 28-day platform pilot begins
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <dt className="mono-id text-muted-foreground uppercase">
              After the pilot
            </dt>
            <dd className="text-sm leading-6 font-bold text-foreground">
              {PRODUCT.price}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <MarketingSignupLink>Start your launch</MarketingSignupLink>
          </Button>
        </div>
        <p className="max-w-md justify-self-center text-sm leading-6 text-muted-foreground">
          <span className="font-bold text-foreground">{GUARANTEE.name}:</span>{" "}
          {GUARANTEE.line} {CLAIMS_BOUNDARY.never}
        </p>
        <p className="mono-id justify-self-center text-muted-foreground uppercase">
          {PRODUCT.billingDisclosure} {PRODUCT.cancelLine}
        </p>
      </ReceiptCard>
    </Section>
  )
}
