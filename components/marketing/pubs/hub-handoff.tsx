import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Icon, MonoTag } from "@/components/brand"
import { FinePrint } from "@/components/marketing/fine-print"
import { GUIDES } from "@/components/marketing/guides/guides-data"
import { Button } from "@/components/ui/button"
import { OFFER, PLAN_LINE, PRODUCT, ROUTES } from "@/lib/marketing/facts"

/**
 * The hub's outbound end: the three guides, then the offer in three lines.
 *
 * This band is what replaced eight duplicated sections. The hub's job is to
 * route — so the launch mechanics stay on `/how-it-works`, the commercials stay
 * on `/pricing`, and this states just enough to make either link worth taking.
 * The guide links are the cluster's only hub→spoke edges, so they are plain
 * crawlable anchors, never a script-driven carousel.
 * Server component.
 */
export function HubHandoff() {
  return (
    // `min-w-0` at each grid level, same reason as GuideSection.
    <div className="grid min-w-0 gap-5">
      <ul className="grid min-w-0 gap-0">
        {GUIDES.map((guide) => (
          <li key={guide.slug} className="min-w-0">
            <Link
              href={guide.path}
              className="focus-ring group grid min-w-0 gap-1 rounded-sm border-b-2 border-dashed border-border py-4 first:pt-0"
            >
              <span className="flex min-w-0 items-center gap-2 text-base leading-snug font-extrabold text-balance text-foreground">
                {guide.title}
                <Icon
                  icon={ArrowRight01Icon}
                  size={16}
                  className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span className="max-w-[68ch] min-w-0 text-sm leading-6 text-muted-foreground">
                {guide.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 rounded-lg border-2 border-ink bg-card p-5 shadow-sm sm:p-6">
        <MonoTag tone="accent" className="justify-self-start">
          If you&rsquo;d rather not run any of this yourself
        </MonoTag>
        <p className="text-xl leading-snug font-extrabold text-foreground">
          {OFFER.name}
        </p>
        <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
          {OFFER.nameNote} {PLAN_LINE}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <MarketingSignupLink>Start your launch</MarketingSignupLink>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.howItWorks}>See how the launch works</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.pricing}>See full pricing</Link>
          </Button>
        </div>
        <FinePrint>{PRODUCT.cancelLine}</FinePrint>
      </div>
    </div>
  )
}
