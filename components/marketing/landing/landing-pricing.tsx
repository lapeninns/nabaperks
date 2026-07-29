import Link from "next/link"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Icon, MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { OFFER, PLAN_INCLUDES, PRODUCT, ROUTES } from "@/lib/marketing/facts"

/**
 * On-page pricing — the SaaS-blueprint pricing block, sitting after the proof
 * and features. One subscription, no setup fee (the done-for-you launch is
 * included), what's included, and a link to the full pricing page. All figures
 * read from the shared facts.
 */
export function LandingPricing() {
  return (
    <Section id="pricing" size="dense">
      <SectionHeader
        eyebrow="Pricing"
        title="One plan, launch included"
        description="No setup fee — we do the whole launch for you. Then a flat monthly price you can cancel anytime."
      />
      <div className="mx-auto mt-5 grid w-full max-w-xl gap-4 sm:mt-6">
        <Card className="border-primary">
          <CardContent className="grid content-start gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <MonoTag tone="accent">{PRODUCT.planName}</MonoTag>
              <MonoTag tone="sun">No setup fee</MonoTag>
            </div>
            <p className="text-sm leading-6 font-bold text-muted-foreground">
              {OFFER.name}
            </p>
            <div className="grid gap-1">
              <p className="flex items-baseline gap-2">
                <span className="text-4xl leading-none font-extrabold text-foreground">
                  {PRODUCT.price}
                </span>
                <span className="text-sm font-bold text-muted-foreground">
                  or {PRODUCT.priceAnnual} · {PRODUCT.annualSaving}
                </span>
              </p>
              <p className="text-sm leading-6 font-bold text-foreground">
                The done-for-you launch is included · after a{" "}
                {PRODUCT.pilotCardNote}.
              </p>
            </div>
            <ul className="grid gap-2.5">
              {PLAN_INCLUDES.slice(0, 4).map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Icon
                    icon={CheckmarkCircle02Icon}
                    size={18}
                    className="mt-0.5 shrink-0 text-reward"
                  />
                  <span className="text-sm leading-6 text-foreground">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <MarketingSignupLink>Start your free pilot</MarketingSignupLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={ROUTES.pricing}>See full pricing</Link>
              </Button>
            </div>
            <p className="mono-id text-muted-foreground uppercase">
              {PRODUCT.cancelLine}
            </p>
          </CardContent>
        </Card>
      </div>
    </Section>
  )
}
