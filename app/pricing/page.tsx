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
  PLAN_INCLUDES,
  PRICING_FAQ_ITEMS,
  PRODUCT,
  ROUTES,
  SETUP_FEE,
  VALUE_MATH,
} from "@/lib/marketing/facts"
import { getActivePromo } from "@/lib/marketing/promo"
import {
  breadcrumbSchema,
  faqPageSchema,
  growthPlanSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = `Pricing — ${SETUP_FEE.amount} Setup for a Limited Time, ${PRODUCT.price}`
// 159 code points (budget 145–159); every price renders via the single-source
// facts, and the waiver is stated with its window condition so the description
// stays honest whichever way the promo toggle sits.
const description = `${SETUP_FEE.amount} setup while the monthly launch window is open (standard ${SETUP_FEE.standard}), then ${PRODUCT.price} or ${PRODUCT.priceAnnual} (${PRODUCT.annualSaving}) after a ${PRODUCT.pilot}. Honest weekly capacity.`

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
  const promo = getActivePromo()
  const pricingFaq = PRICING_FAQ_ITEMS

  return (
    <MarketingLayout>
      <Section>
        <PageTitle
          eyebrow="Pricing"
          title="One setup fee. One subscription. No surprises."
          description="Every number is below — the same numbers we'd give you on the phone."
        />
        <div className="grid gap-3.5 pt-6 lg:grid-cols-3">
          <Card size="sm">
            <CardContent className="grid h-full content-start gap-3">
              <MonoTag
                tone={promo ? "sun" : "plain"}
                className="justify-self-start"
              >
                {promo ? "Limited time" : "One-off"}
              </MonoTag>
              <p className="text-3xl leading-none font-extrabold text-foreground">
                {promo ? SETUP_FEE.amount : SETUP_FEE.standard}
                <span className="pl-2 text-base font-bold text-muted-foreground">
                  setup
                </span>
              </p>
              {promo ? (
                <p className="text-sm leading-6 font-bold text-foreground">
                  Standard price{" "}
                  <span className="text-muted-foreground line-through">
                    {SETUP_FEE.standard}
                  </span>{" "}
                  — waived for launches booked by {promo.deadlineLabel}.
                </p>
              ) : (
                <p className="text-sm leading-6 font-bold text-foreground">
                  {SETUP_FEE.standardLabel}.
                </p>
              )}
              <p className="text-sm leading-6 text-muted-foreground">
                {SETUP_FEE.covers}
              </p>
              <p className="border-t-2 border-dashed border-border pt-2 text-sm leading-6 text-muted-foreground">
                {SETUP_FEE.afterWaiver}
              </p>
              <p className="mt-auto text-xs leading-5 text-muted-foreground">
                {SETUP_FEE.exposure}
              </p>
            </CardContent>
          </Card>
          <Card size="sm" className="border-primary">
            <CardContent className="grid h-full content-start gap-3">
              <MonoTag tone="accent" className="justify-self-start">
                {PRODUCT.planName} · monthly
              </MonoTag>
              <p className="text-3xl leading-none font-extrabold text-foreground">
                {PRODUCT.price}
              </p>
              <p className="text-sm leading-6 font-bold text-foreground">
                After a {PRODUCT.pilotCardNote}.
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
                {PRODUCT.cancelLine}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="grid h-full content-start gap-3">
              <MonoTag className="justify-self-start">
                {PRODUCT.planName} · yearly
              </MonoTag>
              <p className="text-3xl leading-none font-extrabold text-foreground">
                {PRODUCT.priceAnnual}
              </p>
              <p className="text-sm leading-6 font-bold text-foreground">
                {PRODUCT.annualSaving} against paying monthly.
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Same plan, same pilot, same guarantees — billed once a year
                instead of every month.
              </p>
              <p className="mono-id mt-auto text-muted-foreground uppercase">
                {PRODUCT.cancelChip} · switch plans from billing
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-6">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your free pilot</Link>
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
      <ScarcityBand promo={promo} />
      <Section id="pricing-faq">
        <div className="grid gap-6">
          <PageTitle
            headingLevel={2}
            eyebrow="Pricing questions"
            title="Asked before buying, answered straight"
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
