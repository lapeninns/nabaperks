import Link from "next/link"

import { Eyebrow, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import {
  DFY_LAUNCH,
  GUARANTEE,
  OFFER,
  OPERATOR,
  PLAN_LINE,
  PRODUCT,
  ROUTES,
} from "@/lib/marketing/facts"
import { HeroSampleCard } from "./hero-sample-card"
import type { QrMatrix } from "./qr-matrix"

/**
 * The assembled hero pitch from the offer master doc: offer name, audience,
 * done-for-you framing, the investment line and the risk reversal — every line
 * read from the shared marketing facts.
 */
export function LandingHero({ demoQr }: { demoQr: QrMatrix }) {
  return (
    <Section
      size="default"
      className="grid items-start gap-6 pt-6 sm:gap-8 sm:pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12"
    >
      <div className="grid gap-4 sm:gap-5">
        <Eyebrow>Done-for-you loyalty for food-led pubs</Eyebrow>
        <h1 className="max-w-2xl text-3xl leading-[1.05] font-extrabold tracking-tight text-balance text-foreground sm:text-5xl">
          {OFFER.name}
        </h1>
        <p className="max-w-xl text-base leading-7 font-medium text-foreground">
          {OFFER.audience} {DFY_LAUNCH.intro}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="#fit">Check your pub&apos;s fit</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.howItWorks}>See how the launch works</Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm leading-6 font-bold text-foreground">
            Built and run by {OPERATOR.name}
          </span>
          <span className="flex flex-wrap gap-1.5">
            <MonoTag>No app</MonoTag>
            <MonoTag>No POS</MonoTag>
            <MonoTag>{PRODUCT.pilot}</MonoTag>
          </span>
        </div>
        <div className="grid max-w-xl gap-2 border-l-2 border-ink pl-4">
          <p className="text-sm leading-6 font-bold text-foreground">
            {PLAN_LINE}
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
      </div>
      <div className="mx-auto grid w-full max-w-[min(100%,21rem)] gap-2.5 sm:gap-3 lg:mx-0 lg:justify-self-end">
        <HeroSampleCard qrMatrix={demoQr} />
        <p className="px-1 text-center text-sm leading-6 text-muted-foreground">
          <Link
            className="focus-ring rounded-sm font-bold text-foreground underline underline-offset-4"
            href={ROUTES.demo}
          >
            Try this card yourself
          </Link>{" "}
          — no app, opens in the browser.
        </p>
      </div>
    </Section>
  )
}
