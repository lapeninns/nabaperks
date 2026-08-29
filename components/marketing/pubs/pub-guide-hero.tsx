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
      className="grid items-center gap-8 pt-7 sm:pt-12 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-8 lg:gap-14"
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
            className={cn(
              MARKETING_TEXT_LINK,
              "whitespace-nowrap text-foreground"
            )}
          >
            Or start your launch
          </MarketingSignupLink>
        </div>
        <p className="mono-id text-muted-foreground uppercase">
          Written by the {BRAND.name} team · reviewed {updatedOn} ·{" "}
          {PRODUCT.cancelChip}
        </p>
      </div>

      {/* Two surfaces, not four grounds. This was a sun sheet behind a cobalt
          panel behind the warm-paper card — the only place in the product
          where the card sits on saturated cobalt, adding a fourth colour to a
          hero that already carries a cobalt and a sun MonoTag, and ~80px of
          nested padding for decoration. The sun sheet now sits directly behind
          the card, and the tag + demo link move to a dashed caption bar under
          it, where they read as a caption rather than competing chrome. */}
      <div className="relative mx-auto w-full max-w-[26rem] lg:mx-0 lg:justify-self-end">
        <div
          aria-hidden="true"
          className="absolute -top-3 -right-3 bottom-6 left-3 rotate-2 rounded-sheet border-2 border-ink bg-seal"
        />
        <div className="relative grid gap-3">
          <HeroSampleCard qrMatrix={demoQr} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-dashed border-line-strong bg-card px-3 py-2">
            <MonoTag tone="sun">The QR option</MonoTag>
            <Link
              href={ROUTES.demo}
              className="focus-ring mono-id tap-floor inline-flex min-h-11 items-center rounded-(--radius-md) px-2 text-foreground uppercase underline underline-offset-4"
            >
              Try it live
            </Link>
          </div>
        </div>
      </div>
    </Section>
  )
}
