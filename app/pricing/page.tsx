import type { Metadata } from "next"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { PageTitle } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { GrowthPlanPricing, TakeoverAnchor } from "@/components/marketing"
import {
  FaqList,
  GuaranteeStack,
  ScarcityBand,
} from "@/components/marketing/landing"
import { CampaignStrip } from "@/components/marketing/pricing"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  PRICING,
  PRICING_FAQ_ITEMS,
  PRODUCT,
  ROUTES,
  URGENCY,
  VALUE_MATH,
} from "@/lib/marketing/facts"
import {
  breadcrumbSchema,
  faqPageSchema,
  growthPlanSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = `Pricing — ${PRODUCT.launchFee} launch, then ${PRODUCT.price}`
const description = `${PRODUCT.launchFee} covers your done-for-you pub loyalty launch today. Test the platform free for 28 days, then pay ${PRODUCT.price}. No app for customers.`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.pricing },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.pricing,
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Nabaperks`,
    description,
    images: [OG_IMAGE],
  },
}

// Refresh the date-bound campaign wrapper without freezing it at build time.
export const revalidate = 300

export default function PricingPage() {
  const pricingFaq = PRICING_FAQ_ITEMS

  return (
    <MarketingLayout>
      <Section className="pt-12 sm:pt-16 lg:pt-24">
        <div className="max-w-3xl">
          <CampaignStrip variant="chip" className="mb-8" />
          <PageTitle
            title={
              <>
                {PRICING.heroLead}
                <br />
                <span className="italic">{PRICING.heroEm}</span>
                {PRICING.heroEnd}
              </>
            }
            titleClassName="text-5xl leading-[0.92] tracking-tight sm:text-6xl lg:text-7xl"
            description="Pay for the physical launch today. Allow up to 14 days for poster delivery; the 28-day platform pilot begins on confirmed delivery before recurring billing."
            descriptionClassName="text-lg leading-relaxed sm:text-xl lg:text-2xl"
          />
        </div>
        <GrowthPlanPricing className="mt-16 lg:mt-24" />
      </Section>
      <Section>
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="rounded-(--radius-sheet) border-2 border-ink bg-card p-8 shadow-md sm:p-10 lg:col-span-7 lg:p-14">
            <p className="mono-meta text-muted-foreground">
              Does the maths work?
            </p>
            <p className="mt-4 text-2xl leading-[0.95] font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-5xl">
              {VALUE_MATH.coverLine}
            </p>
            <p className="mt-6 text-base leading-7 text-muted-foreground lg:text-lg">
              {VALUE_MATH.assumptionLine} {VALUE_MATH.illustrativeNote}
            </p>
            <p className="mt-8 flex flex-wrap items-end gap-3 lg:gap-6">
              <span className="numeric-tabular text-5xl leading-none font-extrabold tracking-tighter text-primary lg:text-7xl">
                {VALUE_MATH.coverCount}
              </span>
              <span className="max-w-sm text-sm leading-snug font-medium text-muted-foreground lg:text-base">
                {VALUE_MATH.coverCountNote}
              </span>
            </p>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              {VALUE_MATH.firstYearLine}
            </p>
          </div>
          <aside className="flex flex-col justify-between rounded-(--radius-sheet) border-2 border-ink bg-card p-8 shadow-md sm:p-10 lg:col-span-5">
            <div>
              <p className="mono-meta text-muted-foreground">
                Why this week matters
              </p>
              <p className="mt-4 text-base leading-7 text-muted-foreground lg:text-lg">
                {URGENCY.printBatch}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="mt-8 w-fit bg-ink text-paper hover:bg-ink/90"
            >
              <MarketingSignupLink>Start your launch</MarketingSignupLink>
            </Button>
          </aside>
        </div>
      </Section>
      <Section>
        <TakeoverAnchor />
      </Section>
      <GuaranteeStack />
      <ScarcityBand />
      <Section id="pricing-faq" width="narrow">
        <div className="grid gap-8">
          <PageTitle
            headingLevel={2}
            eyebrow="Pricing questions"
            title="Before you sign up"
            titleClassName="text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-7xl"
          />
          <FaqList items={pricingFaq} />
        </div>
      </Section>
      <JsonLd
        id="ld-pricing"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.pricing, title, description }),
            growthPlanSchema(),
            faqPageSchema(ROUTES.pricing, pricingFaq),
            breadcrumbSchema([
              { name: "Home", path: ROUTES.home },
              { name: "Pricing", path: ROUTES.pricing },
            ]),
          ],
        }}
      />
    </MarketingLayout>
  )
}
