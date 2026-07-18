import Link from "next/link"

import { Eyebrow, ReceiptCard } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { OFFER, PRODUCT, ROUTES, SETUP_FEE } from "@/lib/marketing/facts"

/** Closing pitch: the investment summary and the risk reversal, then the CTA. */
export function FinalCta() {
  return (
    <Section id="start">
      <ReceiptCard edge padding="lg" className="items-center gap-4 text-center">
        <Eyebrow className="justify-self-center">Ready when you are</Eyebrow>
        <h2 className="max-w-2xl justify-self-center text-2xl leading-tight font-extrabold text-balance text-foreground sm:text-3xl">
          Give your weekend customers a reason to come back midweek
        </h2>
        <p className="max-w-xl justify-self-center text-sm leading-6 text-muted-foreground">
          {SETUP_FEE.label}, then {PRODUCT.price} — or {PRODUCT.priceAnnual} for{" "}
          {PRODUCT.annualSaving} — after a {PRODUCT.pilot}. {OFFER.riskFraming}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your free pilot</Link>
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
