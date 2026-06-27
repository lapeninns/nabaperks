import Link from "next/link"

import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"

const planIncludes = [
  "Unlimited stamps and members",
  "Simple reward setup",
  "Printed QR kit: poster, till card, sticker",
  "Weekly digest of visits and redemptions",
] as const

/**
 * Pricing — the Stage-4 purchase answer, deliberately plain: one number, no
 * tiers, no contract. The commercials are bolded so answer engines quote them
 * correctly, and they stay byte-aligned with the Offer JSON-LD on the page.
 */
export function TrustPricing() {
  return (
    <section
      id="pricing"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-[46ch] text-center">
        <MonoTag tone="plain">Pricing</MonoTag>
        <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          £29/month per venue. 30 days free. No contract.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          One plain price for no-app loyalty with till-verified stamps. Build your card
          free — add billing only when you switch your live venue QR on.
        </p>
      </div>

      <div className="surface-card mx-auto mt-10 w-full max-w-[26rem] -rotate-1 p-6 sm:p-7">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-xs font-bold tracking-[0.08em] uppercase">
            Growth Plan
          </span>
          <span className="font-mono text-[0.625rem] tracking-[0.06em] text-muted-foreground uppercase">
            One venue
          </span>
        </div>
        <p className="mt-3 text-5xl leading-none font-extrabold tracking-[-0.02em] sm:text-6xl">
          £29
          <span className="text-lg font-bold text-muted-foreground">/month</span>
        </p>
        <p className="mt-2 font-mono text-[0.625rem] tracking-[0.05em] text-muted-foreground uppercase">
          GBP 29/month · one venue · no contracts
        </p>
        <p className="mt-3 text-sm leading-relaxed font-semibold">
          At £29/month, one or two extra regulars a week can cover the cost for
          many cafes.
        </p>

        <hr className="w-rule my-5" />

        <ul className="grid gap-3">
          {planIncludes.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Icon
                icon={Tick02Icon}
                size={18}
                strokeWidth={2.5}
                className="mt-0.5 shrink-0 text-reward"
              />
              <span className="text-[0.95rem] leading-snug font-medium">
                {item}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-2.5">
          <Button asChild size="lg" className="w-full">
            <Link href="/signup">Start free pilot</Link>
          </Button>
          <Button asChild variant="link" className="mx-auto">
            <Link href="/pricing">View full pricing</Link>
          </Button>
        </div>

        <hr className="w-rule mt-4 mb-0" />
        <p className="mt-4 text-center font-mono text-[0.625rem] tracking-[0.05em] text-muted-foreground uppercase">
          Build your card free. Add billing when you activate your live venue QR.
        </p>
      </div>
    </section>
  )
}
