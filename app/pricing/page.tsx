import type { Metadata } from "next"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { GrowthPlanPricing, TakeoverAnchor } from "@/components/marketing"
import {
  FaqList,
  GuaranteeStack,
  ScarcityBand,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import {
  PRICING_FAQ_ITEMS,
  PRODUCT,
  ROUTES,
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
      <Section>
        <PageTitle
          eyebrow="Pricing"
          title="One core plan. Two clear ways to pay."
          description="Pay for the physical launch today. Prove the platform during the free pilot before recurring billing starts."
        />
        <GrowthPlanPricing className="mt-6" />
        <TakeoverAnchor className="mt-5" />
      </Section>
      <Section size="compact">
        <ReceiptCard edge padding="md" className="gap-2">
          <p className="mono-meta text-muted-foreground">
            Does the maths work?
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {VALUE_MATH.assumptionLine}
          </p>
          <p className="text-xl leading-snug font-extrabold text-foreground">
            {VALUE_MATH.coverLine}
          </p>
          <p className="mono-id text-muted-foreground uppercase">
            {VALUE_MATH.illustrativeNote}
          </p>
        </ReceiptCard>
      </Section>
      <GuaranteeStack />
      <ScarcityBand />
      <Section id="pricing-faq">
        <div className="grid gap-6">
          <PageTitle
            headingLevel={2}
            eyebrow="Pricing questions"
            title="Before you sign up"
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
