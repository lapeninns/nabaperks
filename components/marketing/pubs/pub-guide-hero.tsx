import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Eyebrow, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { HeroSampleCard, type QrMatrix } from "@/components/marketing/landing"
import { MARKETING_TEXT_LINK } from "@/components/marketing/text-link"
import { Button } from "@/components/ui/button"
import {
  BRAND,
  PRODUCT,
  PUB_GUIDE_HERO,
  ROUTES,
  type MarketingPersona,
} from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * The hub hero — a guide masthead, not a sales hero.
 *
 * The H1 comes from `PUB_GUIDE_HERO` and deliberately never from the landing's
 * own hero copy: two indexable routes sharing one H1 is what this rebuild
 * exists to fix, and the contract test asserts the separation. The
 * primary action is reading (jump to the comparison), with the launch CTA
 * secondary — a buyer's guide that opens by selling isn't one.
 * Server component.
 */
export function PubGuideHero({
  persona,
  demoQr,
  updatedOn,
}: {
  persona: MarketingPersona
  demoQr: QrMatrix
  /** Human-readable review date for the E-E-A-T byline. */
  updatedOn: string
}) {
  return (
    <Section
      size="default"
      className="grid items-center gap-8 pt-7 sm:pt-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14"
    >
      <div className="grid gap-5">
        <Eyebrow>{PUB_GUIDE_HERO.eyebrow}</Eyebrow>
        <h1 className="max-w-3xl text-3xl leading-[1.05] font-extrabold tracking-tight text-balance text-foreground sm:text-4xl lg:text-5xl">
          {PUB_GUIDE_HERO.headline}
        </h1>
        <p className="max-w-[62ch] text-base leading-7 text-muted-foreground sm:text-lg">
          {PUB_GUIDE_HERO.support}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <MonoTag tone="cobalt">{persona.quietQuestion}</MonoTag>
          <MonoTag tone="sun">No customer app</MonoTag>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild size="lg">
            <Link href="#options">Compare the four options</Link>
          </Button>
          <MarketingSignupLink
            className={cn(MARKETING_TEXT_LINK, "text-foreground")}
          >
            Or start your launch
          </MarketingSignupLink>
        </div>
        <p className="mono-id text-muted-foreground uppercase">
          Written by the {BRAND.name} team · reviewed {updatedOn} ·{" "}
          {PRODUCT.cancelChip}
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-[26rem] lg:mx-0 lg:justify-self-end">
        <div
          aria-hidden="true"
          className="absolute -top-3 -right-3 bottom-3 left-3 rotate-2 rounded-sheet border-2 border-ink bg-seal"
        />
        <div className="relative grid gap-5 rounded-sheet border-2 border-ink bg-cobalt p-5 shadow-md sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MonoTag tone="sun">The QR option</MonoTag>
            <Link
              href={ROUTES.demo}
              className="focus-ring mono-id rounded-sm text-paper/90 uppercase underline underline-offset-4"
            >
              Try it live
            </Link>
          </div>
          <HeroSampleCard qrMatrix={demoQr} />
        </div>
      </div>
    </Section>
  )
}
