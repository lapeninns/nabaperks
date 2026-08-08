import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Eyebrow } from "@/components/brand"
import { Section } from "@/components/layout"
import { FinePrint } from "@/components/marketing/fine-print"
import { MARKETING_TEXT_LINK } from "@/components/marketing/text-link"
import { Button } from "@/components/ui/button"
import { LANDING, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

import { HeroSampleCard } from "./hero-sample-card"
import type { QrMatrix } from "./qr-matrix"

/**
 * The landing hero — one decision, one composition: brand signal, one
 * headline, one line, one CTA and one line of fine print, beside the card.
 *
 * The card is the dominant object (the column split is weighted toward it),
 * because the animated stamp journey IS the product. Everything the old
 * prospectus hero stacked here — plan line, guarantee, offer-name note,
 * operator tags, and the two research CTAs — now lives on the band or page
 * that owns it. The offer name itself moved to the pricing band's plan label.
 */
export function LandingHero({ demoQr }: { demoQr: QrMatrix }) {
  return (
    <Section
      size="default"
      className="grid items-center gap-8 pt-6 sm:pt-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8 lg:gap-14"
    >
      <div className="grid gap-5">
        <Eyebrow>{LANDING.hero.eyebrow}</Eyebrow>
        <h1 className="max-w-[18ch] text-4xl leading-[1.03] font-extrabold tracking-tight text-balance text-foreground sm:max-w-xl sm:text-5xl lg:text-6xl">
          {LANDING.hero.headline}
        </h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
          {LANDING.hero.support}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild size="lg">
            <MarketingSignupLink>Start your launch</MarketingSignupLink>
          </Button>
          <Link
            className={cn(
              MARKETING_TEXT_LINK,
              "whitespace-nowrap text-foreground"
            )}
            href={ROUTES.demo}
          >
            {LANDING.hero.demoLink}
          </Link>
        </div>
        <FinePrint>{PRODUCT.cancelLine}</FinePrint>
      </div>
      <div className="mx-auto w-full max-w-[26rem] lg:mx-0 lg:max-w-none lg:justify-self-end">
        <HeroSampleCard qrMatrix={demoQr} />
      </div>
    </Section>
  )
}
