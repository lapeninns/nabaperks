import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"

import { HeroSampleCard } from "./hero-sample-card"
import { NABAPERKS_AUTHORITY_LINE } from "./nabaperks-proof-data"
import { ReassuranceBar } from "./reassurance-bar"
import { type QrMatrix } from "./venue-qr"

const merchantLinkClass =
  "rounded-sm underline underline-offset-4 transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"

/**
 * Hero — the value before the friction. On narrow screens the hook and CTAs stay
 * tight so the sample card lands in the first viewport; from `lg` the full copy
 * and card sit side by side.
 */
export function LandingHero({ qrMatrix }: { qrMatrix: QrMatrix }) {
  return (
    <Section
      id="top"
      className="grid grid-cols-1 gap-5 max-sm:gap-4 sm:gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-16"
    >
      <div className="contents lg:col-start-1 lg:flex lg:max-w-xl lg:flex-col lg:gap-7">
        <MonoTag tone="accent" className="max-sm:order-1">
          No-app QR loyalty · UK food &amp; drink
        </MonoTag>
        <h1 className="mt-3 max-w-[18ch] text-[clamp(1.85rem,6.4vw,4.25rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance max-sm:order-2 sm:mt-5">
          The loyalty card that just opens.
        </h1>
        <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-pretty text-muted-foreground max-sm:order-3 sm:hidden">
          Scan your till QR — the card opens in their browser. No app, no Apple
          or Google Wallet pass. Every stamp verified at your counter.
        </p>
        <div className="mt-4 flex max-w-xl flex-wrap items-center gap-2.5 max-sm:order-4 sm:mt-7 sm:gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Start free pilot</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
        <div className="hidden max-w-xl flex-col sm:order-6 sm:flex lg:order-none">
          <p className="mt-5 max-w-[44ch] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            No-app QR loyalty for UK cafes, takeaways and pubs. Your customer scans
            the till QR and the card opens in their browser — saved in one tap,
            with <strong className="font-semibold text-foreground">no app and no
            Apple or Google Wallet pass to install</strong>. Every stamp is
            verified at your counter.
          </p>
          <p className="mono-meta mt-4 max-w-[46ch] font-normal leading-relaxed text-muted-foreground">
            {NABAPERKS_AUTHORITY_LINE}
          </p>
          <ReassuranceBar className="mt-6 max-w-[44ch]" />
          <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
            At <strong className="font-semibold text-foreground">£29/mo</strong>, one
            or two extra regulars a week can cover it.
          </p>
          <div className="mono-meta mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-normal">
            <span className="text-muted-foreground">Already piloting?</span>
            <Link href="/login" className={merchantLinkClass}>
              Log in
            </Link>
            <Link href="/pricing" className={merchantLinkClass}>
              View pricing
            </Link>
          </div>
        </div>
        <div className="max-w-xl max-sm:order-6 sm:hidden">
          <ReassuranceBar
            points={[
              "Build free — no payment to start",
              "30-day pilot, then £29/mo",
            ]}
            className="mt-1"
          />
          <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
            At <strong className="font-semibold text-foreground">£29/mo</strong>, one
            or two extra regulars a week can cover it.
          </p>
          <p className="mono-meta mt-3 max-w-[46ch] font-normal leading-relaxed text-muted-foreground">
            {NABAPERKS_AUTHORITY_LINE}
          </p>
        </div>
      </div>

      <div className="max-sm:order-5 lg:col-start-2 lg:row-start-1 lg:self-center">
        <HeroSampleCard qrMatrix={qrMatrix} />
        <p className="mt-3 text-center">
          <Link
            href="/demo"
            className={`${merchantLinkClass} mono-meta font-normal text-muted-foreground`}
          >
            Try this card yourself &rarr;
          </Link>
        </p>
      </div>
    </Section>
  )
}
