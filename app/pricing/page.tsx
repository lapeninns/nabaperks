import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"

import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { FaqDetailsList } from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  CTA,
  GUARANTEE,
  OFFER,
  OFFER_STACK,
  PLAN_INCLUDES,
  PRODUCT,
  PROMO,
  ROUTES,
  SETUP,
} from "@/lib/marketing/facts"
import {
  ORG_ID,
  SITE_URL,
  absoluteUrl,
  marketingPageGraph,
  OG_IMAGE,
} from "@/lib/seo/structured-data"

import { PricingCheckoutAlert } from "./checkout-alert"

const title = "Pricing — £29/month per venue"
const description = `Start with a ${PRODUCT.pilot}, then ${PRODUCT.price} per venue — unlimited stamps and members included. ${PRODUCT.cancelLine}`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.pricing },
  keywords: [
    "Nabaperks pricing",
    "loyalty card pricing UK",
    "pub loyalty scheme pricing",
    "QR loyalty card monthly price",
    "digital stamp card pricing",
  ],
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

// Single-source superset — TrustPricing teases the first four of the same
// list (MS-marketing-audit-v2-fixes AV-4).
const planIncludes = PLAN_INCLUDES

const faqs = [
  {
    q: "Is there a contract?",
    a: `No. It is month to month after the pilot — £29, one venue. ${PRODUCT.cancelLine} 30 days free before billing starts.`,
  },
  {
    q: "Do I need any hardware?",
    a: "No. Customers use their own phones and your permanent venue QR. Optional location checks can flag out-of-range visits without blocking legitimate customers.",
  },
  {
    q: "Who owns the customer data?",
    a: "Customer records stay with your venue. You see masked phone and email in your dashboard; marketing is a separate opt-in.",
  },
  {
    q: "What counts as a visit?",
    a: "A visit counts when a customer stamps from your venue QR — one earned stamp per customer per UK date. The stamp is confirmed at the counter before it lands in your weekly digest.",
  },
  {
    q: "What if I want to cancel?",
    a: "Cancel from your billing page any time — it takes effect at the end of your current billing month and you will not be charged again. Earned rewards stay redeemable while things wind down, so no regular is left holding a broken seal.",
  },
  {
    q: "What if it doesn't bring back a regular?",
    a: `${GUARANTEE.line} ${GUARANTEE.applies} ${GUARANTEE.claim}`,
  },
]

const pricingOffer = {
  "@type": "Offer",
  "@id": `${SITE_URL}${ROUTES.pricing}#monthly-offer`,
  name: "Nabaperks Growth Plan",
  price: "29.00",
  priceCurrency: "GBP",
  description: `${PRODUCT.price} per venue after a ${PRODUCT.pilot}, month to month with no contract.`,
  availability: "https://schema.org/InStock",
  url: absoluteUrl(ROUTES.pricing),
  eligibleRegion: { "@type": "Country", name: "United Kingdom" },
  itemOffered: {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: "Nabaperks",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web browser",
    publisher: { "@id": ORG_ID },
  },
} satisfies Record<string, unknown>

const pricingFaqSchema = {
  "@type": "FAQPage",
  "@id": `${SITE_URL}${ROUTES.pricing}#faq`,
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
} satisfies Record<string, unknown>

const pricingGraph = marketingPageGraph({
  page: {
    path: ROUTES.pricing,
    name: `${title} | Nabaperks`,
    description,
    reviewedByOperator: true,
  },
  breadcrumbs: [
    { name: "Home", path: ROUTES.home },
    { name: "Pricing", path: ROUTES.pricing },
  ],
  extraNodes: [pricingOffer, pricingFaqSchema],
})

export default function PricingPage() {
  return (
    <MarketingLayout>
      <Section>
        <PageTitle
          eyebrow="Pricing"
          title="One price. Everything included."
          description={`30 days free to pilot, then £29/month per venue. ${PRODUCT.cancelLine}`}
          titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
          descriptionClassName="text-base leading-7 text-pretty"
          className="md:grid-cols-1"
        />

        <Suspense fallback={null}>
          <PricingCheckoutAlert />
        </Suspense>

        {PROMO.enabled && (
          <div className="mt-6 rounded-lg border-2 border-dashed border-border p-5">
            <Eyebrow className="mb-2 text-reward">{PROMO.name}</Eyebrow>
            <p className="text-[0.95rem] leading-snug font-extrabold text-balance">
              {PROMO.perk}
            </p>
            <p className="mono-meta mt-2 text-muted-foreground">
              {PROMO.claim}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] lg:items-start">
          <ReceiptCard
            edge
            className="order-1 w-full"
            wrapperClassName="order-1 lg:-rotate-1"
          >
            <div className="grid gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Eyebrow>Growth plan</Eyebrow>
                <span className="mono-id tracking-[0.08em] text-muted-foreground">
                  30 days free
                </span>
              </div>
              <div>
                <p className="text-[clamp(2.75rem,8vw,3.25rem)] leading-none font-extrabold tabular-nums">
                  £29
                  <span className="text-lg font-bold text-muted-foreground">
                    /month
                  </span>
                </p>
                <p className="mono-meta mt-2 text-muted-foreground">
                  One venue · month to month · no contracts
                </p>
              </div>
              <hr className="w-rule" />
              <div>
                <Eyebrow className="mb-3">Everything included</Eyebrow>
                <ul className="grid gap-2.5">
                  {planIncludes.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Icon
                        icon={Tick02Icon}
                        size={18}
                        strokeWidth={2.5}
                        className="mt-0.5 shrink-0 text-reward"
                      />
                      <span className="text-[0.95rem] leading-snug font-bold text-pretty">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3 border-t-2 border-dashed border-border pt-5">
                <Button asChild size="lg" className="w-full">
                  <Link href={ROUTES.signup}>{CTA.startPilot}</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/login">Log in</Link>
                </Button>
                <p className="text-center text-xs leading-5 text-pretty text-muted-foreground">
                  {PRODUCT.cancelLine}
                </p>
              </div>
            </div>
          </ReceiptCard>

          <div className="order-2 grid gap-6 pt-1">
            <div className="grid gap-2">
              <Eyebrow>The maths</Eyebrow>
              <p className="text-[clamp(1.25rem,2.5vw,1.5rem)] leading-snug font-extrabold text-balance">
                One or two extra regulars a week can cover the cost for many
                venues.
              </p>
              <p className="text-sm leading-6 text-pretty text-muted-foreground">
                Most venues see their first repeat visit inside the first week.
                Your dashboard counts the regulars; you do the maths — or try
                the{" "}
                <Link
                  href={`${ROUTES.pubHub}#regulars-calculator`}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  regulars calculator
                </Link>
                .
              </p>
            </div>
            <div className="grid gap-2">
              <Eyebrow>{GUARANTEE.name}</Eyebrow>
              <p className="text-[clamp(1.25rem,2.5vw,1.5rem)] leading-snug font-extrabold text-balance">
                {GUARANTEE.line}
              </p>
              <p className="text-sm leading-6 text-pretty font-semibold">
                {OFFER.riskFraming}
              </p>
              <p className="text-sm leading-6 text-pretty text-muted-foreground">
                {GUARANTEE.applies} {GUARANTEE.claim}
              </p>
            </div>
            <div className="rounded-lg border-2 border-dashed border-border p-5">
              <Eyebrow className="mb-2">After day 30</Eyebrow>
              <p className="text-sm leading-6 text-pretty text-muted-foreground">
                Billing starts after your free pilot. Cancel any time from your
                billing page — no further charges after your current month.
                Earned rewards stay good for your regulars.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-2">
          <Eyebrow>How fast you&apos;re live</Eyebrow>
          <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-balance">
            {SETUP.line}
          </h2>
          <p className="text-base leading-7 text-pretty text-muted-foreground">
            {SETUP.steps} {SETUP.noFriction}
          </p>
          <p className="text-sm leading-6 text-pretty font-semibold">
            {SETUP.earlyWin}
          </p>
        </div>

        <div className="mt-10">
          <div className="mb-5 grid gap-2">
            <Eyebrow>Included with every venue</Eyebrow>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-balance">
              {OFFER.name}
            </h2>
            <p className="text-base leading-7 text-pretty text-muted-foreground">
              Everything below is in the £29 — the launch kit, thrown in.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {OFFER_STACK.map((bonus) => (
              <li
                key={bonus.name}
                className="rounded-lg border-2 border-dashed border-border p-5"
              >
                <p className="mono-meta text-muted-foreground">
                  {bonus.obstacle}
                </p>
                <p className="mt-1 text-[0.95rem] leading-snug font-extrabold">
                  {bonus.name}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-pretty text-muted-foreground">
                  {bonus.detail}
                </p>
                {bonus.anchor && (
                  <p className="mt-2 text-sm leading-6 text-pretty font-semibold">
                    {bonus.anchor}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <h2 className="mb-2 text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-balance">
            Asked at the counter
          </h2>
          <FaqDetailsList items={faqs} className="mt-4" />
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg">
              <Link href={ROUTES.signup}>{CTA.startPilot}</Link>
            </Button>
          </div>
        </div>
      </Section>
      <JsonLd id="ld-pricing" data={pricingGraph} />
    </MarketingLayout>
  )
}
