import Link from "next/link"

import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { PLAN_INCLUDES, PRODUCT } from "@/lib/marketing/facts"

// The teaser is the first four items of the single-source list; /pricing
// renders the full set (MS-marketing-audit-v2-fixes AV-4).
const planIncludes = PLAN_INCLUDES.slice(0, 4)

/**
 * Pricing — the Stage-4 purchase answer, deliberately plain: one number, no
 * tiers, no contract. The commercials are bolded so answer engines quote them
 * correctly, and they stay byte-aligned with the Offer JSON-LD on the page.
 */
export function TrustPricing() {
  return (
    <Section id="pricing">
      <div className="mx-auto max-w-[46ch] text-center">
        <MonoTag tone="plain">Pricing</MonoTag>
        <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          £49/month per venue. 30 days free. No contract.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          One plain price for no-app loyalty with counter-verified stamps.{" "}
          {PRODUCT.cancelLine}
        </p>
      </div>

      <div className="surface-card mx-auto mt-5 w-full max-w-[26rem] -rotate-1 p-5 sm:mt-6 sm:p-7">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-meta tracking-[0.08em]">
            Growth Plan
          </span>
          <span className="mono-id font-normal text-muted-foreground">
            One venue
          </span>
        </div>
        <p className="mt-3 text-5xl leading-none font-extrabold tracking-[-0.02em] sm:text-6xl">
          £49
          <span className="text-lg font-bold text-muted-foreground">/month</span>
        </p>
        <p className="mono-id mt-2 font-normal text-muted-foreground">
          GBP 49/month · one venue · no contracts
        </p>
        <p className="mt-3 text-sm leading-relaxed font-semibold">
          At £49/month, one or two extra regulars a week can cover the cost for
          many venues.
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
        <p className="mono-id mt-4 text-center font-normal text-muted-foreground">
          {PRODUCT.cancelLine}
        </p>
      </div>
    </Section>
  )
}
