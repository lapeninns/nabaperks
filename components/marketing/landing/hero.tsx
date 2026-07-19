import Link from "next/link"

import { Eyebrow, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { SetupPriceLine } from "@/components/marketing/setup-price-line"
import { Button } from "@/components/ui/button"
import {
  DFY_LAUNCH,
  GUARANTEE,
  OFFER,
  OPERATOR,
  PRODUCT,
  ROUTES,
  SETUP_FEE,
} from "@/lib/marketing/facts"
import type { ActivePromo } from "@/lib/marketing/promo"

import type { QrMatrix } from "./qr-matrix"
import { SampleLoyaltyCard } from "./sample-loyalty-card"
import { VenueQr } from "./venue-qr"

/**
 * The assembled hero pitch from the offer master doc: offer name, audience,
 * done-for-you framing, the investment line and the risk reversal — every line
 * read from the shared marketing facts.
 */
export function LandingHero({
  promo,
  demoQr,
}: {
  promo: ActivePromo | null
  demoQr: QrMatrix
}) {
  return (
    <Section
      size="default"
      className="grid items-start gap-8 pt-8 sm:pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12"
    >
      <div className="grid gap-5">
        <Eyebrow>Nabaperks · done-for-you pub loyalty</Eyebrow>
        <h1 className="max-w-2xl text-4xl leading-[1.05] font-extrabold tracking-tight text-balance text-foreground sm:text-5xl">
          {OFFER.name}
        </h1>
        <p className="max-w-xl text-base leading-7 font-medium text-foreground">
          {OFFER.audience} {DFY_LAUNCH.intro}
        </p>
        {promo ? (
          <MonoTag tone="sun" className="justify-self-start">
            {SETUP_FEE.label} until {promo.deadlineLabel}
          </MonoTag>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your free pilot</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.howItWorks}>See how the launch works</Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm leading-6 font-bold text-foreground">
            Built by {OPERATOR.name} · {OPERATOR.estateShort}
          </span>
          <span className="flex flex-wrap gap-1.5">
            <MonoTag>No app</MonoTag>
            <MonoTag>No POS</MonoTag>
            <MonoTag>{PRODUCT.pilot}</MonoTag>
          </span>
        </div>
        <div className="grid max-w-xl gap-2 border-l-2 border-ink pl-4">
          <p className="text-sm leading-6 font-bold text-foreground">
            <SetupPriceLine promo={promo} />
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-bold text-foreground">{GUARANTEE.name}:</span>{" "}
            {GUARANTEE.line}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {OFFER.nameNote}
          </p>
          <p className="mono-id text-muted-foreground uppercase">
            {PRODUCT.cancelLine}
          </p>
        </div>
        {promo ? (
          <p className="max-w-xl border-2 border-dashed border-border bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
            <span className="mono-meta block pb-1 text-foreground">
              {promo.name}
            </span>
            {promo.perk}
          </p>
        ) : null}
      </div>
      <div className="mx-auto grid w-full max-w-sm gap-5 lg:mx-0 lg:justify-self-end">
        <SampleLoyaltyCard />
        <div className="flex items-center gap-4">
          <VenueQr
            matrix={demoQr}
            label="QR code that opens the live demo card"
            className="w-24 shrink-0 sm:w-28"
          />
          <p className="text-sm leading-6 text-muted-foreground">
            Scan with your phone to open the demo card in a browser — or{" "}
            <Link
              className="focus-ring rounded-sm font-bold text-foreground underline underline-offset-4"
              href={ROUTES.demo}
            >
              try the live demo
            </Link>
            . No app either way.
          </p>
        </div>
      </div>
    </Section>
  )
}
