import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"

import { Tick02Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import { CTA, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import {
  ORG_ID,
  SITE_URL,
  absoluteUrl,
  marketingPageGraph,
  OG_IMAGE,
} from "@/lib/seo/structured-data"

import { PricingCheckoutAlert } from "./checkout-alert"

const title = "Pricing — £29/month per venue"
const description = `Start with a ${PRODUCT.pilot}, then ${PRODUCT.price} per venue. Build your card first; add billing when you activate your live venue QR.`

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

const planIncludes = [
  "Unlimited stamps and members",
  "Simple reward setup",
  "Permanent venue QR",
  "Optional location checks at your venue",
  "Weekly digest of visits, regulars, and redemptions",
]

const faqs = [
  {
    q: "Is there a contract?",
    a: "No. It is month to month after the pilot. £29, one venue, one month's notice to leave. Add billing when you activate your live venue QR, with 30 days free before billing starts.",
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
    a: "A visit counts when a customer stamps from your venue QR — one earned stamp per customer per UK date. Optional location checks can flag odd visits without blocking legitimate customers.",
  },
  {
    q: "What if I want to cancel?",
    a: "One month's notice from your billing page, any time. Earned rewards stay redeemable while things wind down, so no regular is left holding a broken seal.",
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
          description="30 days free to pilot, then £29/month per venue. Build your card first; add billing when you activate your live venue QR."
          titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
          descriptionClassName="text-base leading-7 text-pretty"
          className="md:grid-cols-1"
        />

        <Suspense fallback={null}>
          <PricingCheckoutAlert />
        </Suspense>

        <div className="mt-6 grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] lg:items-start">
          <ReceiptCard
            edge
            className="order-1 w-full"
            wrapperClassName="order-1 lg:-rotate-1"
          >
            <div className="grid gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Eyebrow>Growth plan</Eyebrow>
                <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
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
                <p className="mt-2 font-mono text-[0.7rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
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
                        className="mt-0.5 shrink-0 text-primary"
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
                  Billing when you activate your live venue QR. One month&apos;s
                  notice to leave.
                </p>
              </div>
            </div>
          </ReceiptCard>

          <div className="order-2 grid gap-6 pt-1">
            <div className="grid gap-2">
              <Eyebrow>The maths</Eyebrow>
              <p className="text-[clamp(1.25rem,2.5vw,1.5rem)] leading-snug font-extrabold text-balance">
                One or two extra regulars a week can cover the cost for many
                cafes.
              </p>
              <p className="text-sm leading-6 text-pretty text-muted-foreground">
                Most venues see their first repeat visit inside the first week.
                Your dashboard counts the regulars; you do the maths.
              </p>
            </div>
            <div className="rounded-[10px] border-2 border-dashed border-border p-5">
              <Eyebrow className="mb-2">After day 30</Eyebrow>
              <p className="text-sm leading-6 text-pretty text-muted-foreground">
                Billing starts after your free pilot. Leave any time with one
                month&apos;s notice from your billing page. Earned rewards stay
                good for your regulars.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <h2 className="mb-2 text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-balance">
            Asked at the counter
          </h2>
          <div className="border-b-2 border-dashed border-border">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group border-t-2 border-dashed border-border [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="pressable flex cursor-pointer items-center justify-between gap-4 py-4 outline-none">
                  <span className="text-[1.05rem] font-extrabold">{faq.q}</span>
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-card font-mono text-base font-bold group-open:bg-primary group-open:text-primary-foreground"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">–</span>
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-4 text-sm leading-6 text-pretty text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
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
