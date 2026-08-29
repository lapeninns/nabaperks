import type { Metadata } from "next"
import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { PageTitle } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { LandingFaq } from "@/components/marketing/landing"
import { MARKETING_TEXT_LINK } from "@/components/marketing/text-link"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import { FAQ_ITEMS, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"
import {
  breadcrumbSchema,
  faqPageSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = "Frequently Asked Questions"
const description = `Straight answers about Nabaperks — the done-for-you launch, ${PRODUCT.price} pricing, what we set up for you, and what we never promise.`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.faq },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.faq,
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

export default function FaqPage() {
  return (
    <MarketingLayout>
      <Section id="faq" width="narrow">
        <PageTitle
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Straight answers about the launch, pricing and what Nabaperks does — and does not — promise."
        />
        <LandingFaq showHeader={false} />
        {/* One primary, then the two secondary destinations as text links:
            three 48px `size="lg"` buttons stacked into a 168px CTA tower on a
            phone and read as three peers on a desktop, which is no primary at
            all. */}
        <div className="mt-8 grid justify-items-start gap-3">
          <Button asChild size="lg">
            <MarketingSignupLink>Start your launch</MarketingSignupLink>
          </Button>
          <p className="flex flex-wrap items-center gap-x-5">
            <Link
              className={cn(MARKETING_TEXT_LINK, "text-foreground")}
              href={ROUTES.howItWorks}
            >
              See how it works
            </Link>
            <Link
              className={cn(MARKETING_TEXT_LINK, "text-foreground")}
              href={ROUTES.pricing}
            >
              See pricing
            </Link>
          </p>
        </div>
      </Section>
      <JsonLd
        id="ld-faq"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.faq, title, description }),
            faqPageSchema(ROUTES.faq, FAQ_ITEMS),
            breadcrumbSchema([
              { name: "Home", path: ROUTES.home },
              { name: "FAQ", path: ROUTES.faq },
            ]),
          ],
        }}
      />
    </MarketingLayout>
  )
}
