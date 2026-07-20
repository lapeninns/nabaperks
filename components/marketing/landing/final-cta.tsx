import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Eyebrow, ReceiptCard } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { OFFER, PLAN_LINE, PRODUCT, ROUTES } from "@/lib/marketing/facts"

/** Closing pitch: the investment summary and the risk reversal, then the CTA. */
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
        <p className="max-w-xl justify-self-center text-sm leading-6 text-muted-foreground">
          {PLAN_LINE} {OFFER.riskFraming}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <MarketingSignupLink>Start your free pilot</MarketingSignupLink>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.pricing}>See full pricing</Link>
          </Button>
        </div>
        <p className="mono-id justify-self-center text-muted-foreground uppercase">
          {PRODUCT.cancelLine}
        </p>
      </ReceiptCard>
    </Section>
  )
}
