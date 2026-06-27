import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"

import { HeroSampleCard } from "./hero-sample-card"
import { type QrMatrix } from "./venue-qr"

const merchantLinkClass =
  "rounded-sm underline underline-offset-4 transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"

/**
 * Hero — the value before the friction. Mobile-first: the headline and CTAs lead
 * in a single column and the sample card follows beneath; from `lg` they sit
 * side by side. The card is the real product object (see SampleLoyaltyCard).
 */
export function LandingHero({ qrMatrix }: { qrMatrix: QrMatrix }) {
  return (
    <section
      id="top"
      className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14"
    >
      <div className="max-w-xl">
        <MonoTag tone="accent">No-app QR loyalty · UK food &amp; drink</MonoTag>
        <h1 className="mt-5 max-w-[18ch] text-[clamp(2rem,6.4vw,4.25rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
          The loyalty card that just opens.
        </h1>
        <p className="mt-5 max-w-[44ch] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          No-app QR loyalty for UK cafes, takeaways and pubs. Your customer scans
          the till QR and the card opens in their browser — saved in one tap,
          with <strong className="font-semibold text-foreground">no app and no
          Apple or Google Wallet pass to install</strong>. Every stamp is
          server-checked at your counter.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Start a merchant trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
        <p className="mt-4 max-w-[44ch] font-mono text-[0.7rem] leading-relaxed tracking-[0.03em] text-muted-foreground uppercase">
          Build the card free · 30-day pilot · then £29/mo · no contract
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.7rem] tracking-[0.04em] uppercase">
          <span className="text-muted-foreground">Already piloting?</span>
          <Link href="/login" className={merchantLinkClass}>
            Log in
          </Link>
          <Link href="/pricing" className={merchantLinkClass}>
            View pricing
          </Link>
        </div>
      </div>

      <HeroSampleCard qrMatrix={qrMatrix} />
    </section>
  )
}
