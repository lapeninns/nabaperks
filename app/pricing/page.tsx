import type { Metadata } from "next"
import Link from "next/link"

import { MonoTag, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import {
  FaqList,
  GuaranteeStack,
  ScarcityBand,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DFY_LAUNCH,
  PLAN_INCLUDES,
  PRICING_FAQ_ITEMS,
  PRODUCT,
  ROUTES,
  TAKEOVER,
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

export default function PricingPage() {
  const pricingFaq = PRICING_FAQ_ITEMS

  return (
    <MarketingLayout>
      <Section>
        <PageTitle
          eyebrow="Pricing"
          title="One core plan. One clear billing cycle."
          description="Pay for the physical launch today. Prove the platform during the free pilot before recurring billing starts."
        />
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed border-line-strong bg-card p-5">
          <MonoTag tone="sun">Done-for-you launch</MonoTag>
          <p className="text-sm leading-6 font-bold text-foreground">
            {DFY_LAUNCH.covers} The one-time launch fee is {PRODUCT.launchFee}.
          </p>
        </div>
        <div className="grid gap-3.5 pt-6 sm:grid-cols-2">
          <Card size="sm" className="border-primary">
            <CardContent className="grid h-full content-start gap-3">
              <MonoTag tone="accent" className="justify-self-start">
                {PRODUCT.planName} · standard
              </MonoTag>
              <p className="text-3xl leading-none font-extrabold text-foreground">
                {PRODUCT.price}
              </p>
              <p className="text-sm leading-6 font-bold text-foreground">
                {PRODUCT.launchFee} launch fee due at checkout. Then a{" "}
                {PRODUCT.pilotCardNote} before the first recurring payment.
              </p>
              <ul className="grid gap-1.5">
                {PLAN_INCLUDES.map((item) => (
                  <li
                    key={item}
                    className="border-b-2 border-dashed border-border pb-1.5 text-sm leading-6 text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mono-id mt-auto text-muted-foreground uppercase">
                {PRODUCT.billingDisclosure} {PRODUCT.processingFeeLine}{" "}
                {PRODUCT.cancelLine}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="grid h-full content-start gap-3">
              <MonoTag tone="sun" className="justify-self-start">
                Bespoke engagement
              </MonoTag>
              <p className="text-3xl leading-none font-extrabold text-foreground">
                {TAKEOVER.price}
              </p>
              <p className="text-sm leading-6 font-bold text-foreground">
                {TAKEOVER.name}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {TAKEOVER.qualifier} This is an enquiry-only alternative and is
                not available through self-serve checkout.
              </p>
              <Button asChild variant="secondary" className="mt-auto w-fit">
                <Link href={ROUTES.demo}>{TAKEOVER.action}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-6">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your launch</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.howItWorks}>See how the launch works</Link>
          </Button>
        </div>
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
