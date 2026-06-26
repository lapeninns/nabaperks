import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { RewardSeal } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

import { SampleLoyaltyCard } from "./sample-loyalty-card"
import { VenueQr, type QrMatrix } from "./venue-qr"

const customerLinkClass =
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
        <MonoTag tone="accent">No-app loyalty · food &amp; drink</MonoTag>
        <h1 className="mt-5 max-w-[16ch] text-[clamp(2rem,6.4vw,4.25rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
          Replace paper loyalty cards with one venue QR.
        </h1>
        <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
          Customers scan, save a browser card, and collect one honest stamp per
          day. No app, no plastic, no password.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Start a merchant trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.7rem] tracking-[0.04em] uppercase">
          <span className="text-muted-foreground">Already a customer?</span>
          <Link href="/home" className={customerLinkClass}>
            Open my cards
          </Link>
          <Link href="/scan" className={customerLinkClass}>
            Scan a venue QR
          </Link>
        </div>
      </div>

      <SampleLoyaltyCard
        className="rotate-[1.5deg]"
        venue="The Old Crown · Bristol"
        title="Free hot drink after 3 visits"
        venueInitials="OC"
        stamps={{ current: 2, total: 3, dates: ["3 JUN", "9 JUN"] }}
        footerLeft="Card Nº OC-0248"
        footerRight={
          <span className="text-muted-foreground">
            One stamp per business day
          </span>
        }
      >
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-md border-2 border-ink bg-white p-1">
              <VenueQr matrix={qrMatrix} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.85rem] leading-tight font-extrabold">
                Scan at the till
              </p>
              <p className="mt-0.5 font-mono text-[0.55rem] tracking-[0.05em] text-muted-foreground uppercase">
                Opens in the browser
              </p>
            </div>
          </div>
          <div className="shrink-0 border-l-2 border-dashed border-border pl-3 text-center">
            <RewardSeal state="sealed" size="md" wiggle className="mx-auto" />
            <p className="mx-auto mt-1.5 max-w-[4.5rem] font-mono text-[0.5rem] leading-tight tracking-[0.05em] text-muted-foreground uppercase">
              1 visit to the seal
            </p>
          </div>
        </div>
      </SampleLoyaltyCard>
    </section>
  )
}
