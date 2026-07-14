import type { Metadata } from "next"
import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import {
  ComparisonTable,
  CounterFlow,
  CounterVerifiedStamp,
  FinalCta,
  LandingFaq,
  LandingProof,
  SeparateMarketing,
  VenueBenefits,
  counterFlowSteps,
  faqs,
} from "@/components/marketing/landing"
import { buildQrMatrix } from "@/components/marketing/landing/qr-matrix"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import { ROUTES, SETUP } from "@/lib/marketing/facts"
import {
  OG_IMAGE,
  SITE_URL,
  absoluteUrl,
  glossarySchema,
  howToSchema,
  marketingPageGraph,
} from "@/lib/seo/structured-data"

const title = "How It Works — No-App QR Loyalty, Step by Step"
const description =
  "How Nabaperks works: scan the till QR, save a browser-based card — no app, no wallet pass — and collect venue-linked stamps with clear claim controls."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.howItWorks },
  keywords: [
    "how QR loyalty cards work",
    "digital stamp card how it works",
    "can digital loyalty stamps be faked",
    "loyalty card without an app",
    "venue-linked loyalty stamps",
    "QR loyalty for pubs and cafes",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.howItWorks,
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

// The venue-benefits card previews the merchant's own venue QR (a setup
// preview), so it stays pointed at the site root — as it did on the homepage.
const venueQrMatrix = buildQrMatrix(SITE_URL)

/** Page graph: the WebPage, the Scan/Save/Stamp/Reward HowTo (byte-synced to
 * the visible steps below), the objection set (byte-synced to the visible
 * FAQ) and the term glossary (the page that defines the terms carries the
 * DefinedTermSet), each with route-distinct @ids. */
function buildPageGraph() {
  return marketingPageGraph({
    page: {
      path: ROUTES.howItWorks,
      name: `${title} | Nabaperks`,
      description,
      reviewedByOperator: true,
    },
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "How it works", path: ROUTES.howItWorks },
    ],
    extraNodes: [
      howToSchema(counterFlowSteps, {
        id: `${absoluteUrl(ROUTES.howItWorks)}#howto`,
      }),
      {
        "@type": "FAQPage",
        "@id": `${absoluteUrl(ROUTES.howItWorks)}#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
      glossarySchema(),
    ],
  })
}

export default function HowItWorksPage() {
  return (
    <MarketingLayout>
      {/* Chapter head: what this page answers, with both asks up front. */}
      <Section width="narrow" className="text-center">
        <MonoTag tone="accent">How it works · No app, no POS</MonoTag>
        <h1 className="mx-auto mt-4 max-w-[16ch] text-[clamp(2rem,5.4vw,3.5rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
          From till QR to redeemed reward.
        </h1>
        <p className="mx-auto mt-4 max-w-[52ch] text-base leading-relaxed text-pretty text-muted-foreground">
          The whole mechanism on one page: how customers scan, save and stamp,
          the five controls behind every venue-linked stamp, and how it
          compares to paper cards, loyalty apps and wallet passes.
        </p>
        <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-6 text-pretty font-semibold">
          {SETUP.steps} {SETUP.line}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Start free pilot</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/demo">Try the demo card</Link>
          </Button>
        </div>
      </Section>

      {/* The four beats, then the trust chapters in objection order:
          how it runs → how it compares → claim controls → proof →
          what you configure → the consent posture → every question → the ask.
          The full proof tabs moved here from the homepage spine
          (landing conversion spine): sitewide copy preservation. */}
      <CounterFlow />
      <ComparisonTable />
      <CounterVerifiedStamp />
      <LandingProof />
      <VenueBenefits qrMatrix={venueQrMatrix} />
      <SeparateMarketing />
      <LandingFaq />
      <FinalCta />

      {/* SEO/structured data */}
      <JsonLd id="ld-how-it-works" data={buildPageGraph()} />
    </MarketingLayout>
  )
}
