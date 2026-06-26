import Link from "next/link"

import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"

import { BenefitPoint } from "./benefit-point"

const planIncludes = [
  "Unlimited stamps and members",
  "Simple reward setup",
  "Printed QR kit: poster, till card, sticker",
  "Weekly digest of visits and redemptions",
] as const

/**
 * Trust + pricing. Mobile-first: the centred promise leads, then the four trust
 * points, then the plan receipt; from `lg` the points and the receipt share a
 * row. Pricing detail stays deliberately plain — one number, no tiers.
 */
export function TrustPricing() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <div className="mx-auto max-w-[46ch] text-center">
        <MonoTag tone="plain">Marketing by choice</MonoTag>
        <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          Stamps on record. Marketing by choice.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Customers can collect stamps without joining a marketing list. Every
          stamp stays scoped to your venue.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
        <ul className="grid gap-5">
          <BenefitPoint title="Server-checked stamps">
            Customers claim from the venue QR; the server records the stamp and
            blocks duplicate UK-date claims.
          </BenefitPoint>
          <BenefitPoint title="Scoped to your venue">
            A card collects only at your counter, nowhere else.
          </BenefitPoint>
          <BenefitPoint title="Marketing opt-in is separate">
            Customers can earn rewards without agreeing to promotional messages.
          </BenefitPoint>
          <BenefitPoint title="Clear reward records">
            Stamps and redemptions stay server-side for later review.
          </BenefitPoint>
        </ul>

        <div className="surface-card mx-auto w-full max-w-[26rem] -rotate-1 p-6 sm:p-7">
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
            <span className="text-lg font-bold text-muted-foreground">
              /month
            </span>
          </p>
          <p className="mt-2 font-mono text-[0.625rem] tracking-[0.05em] text-muted-foreground uppercase">
            GBP 29/month · one venue · no contracts
          </p>
          <p className="mt-3 text-sm leading-relaxed font-semibold">
            At £29/month, one or two extra regulars a week can cover the cost
            for many cafes.
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
              <Link href="/signup">Start a merchant trial</Link>
            </Button>
            <Button asChild variant="link" className="mx-auto">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>

          <hr className="w-rule mt-4 mb-0" />
          <p className="mt-4 text-center font-mono text-[0.625rem] tracking-[0.05em] text-muted-foreground uppercase">
            Build your card free. Add billing when you activate your live venue
            QR.
          </p>
        </div>
      </div>
    </section>
  )
}
