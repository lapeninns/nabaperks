import type { Metadata } from "next"
import QRCode from "qrcode"

import { MonoTag } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import {
  CounterFlow,
  FinalCta,
  LandingFaq,
  LandingHero,
  NabaperksProofBody,
  ProofStrip,
  TrustPricing,
  VenuePersonas,
  counterFlowSteps,
  faqs,
  type QrMatrix,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { getActivePromo } from "@/lib/marketing/promo"
import {
  OG_IMAGE,
  ORG_ID,
  SITE_URL,
  absoluteUrl,
  breadcrumbSchema,
  glossarySchema,
  howToSchema,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = "No-App QR Loyalty for UK Food & Drink Venues"
const description =
  "One venue QR replaces paper stamp cards: a browser-based loyalty card — no app, no wallet pass — with venue-linked stamps. £49/mo, 30-day free pilot."

export const metadata: Metadata = {
  title: { absolute: `${title} | Nabaperks` },
  description,
  alternates: { canonical: "/" },
  keywords: [
    "no-app QR loyalty card",
    "loyalty card without an app",
    "loyalty card without Apple Wallet",
    "digital stamp card UK",
    "loyalty programme no POS",
    "cafe loyalty card app UK",
    "pub loyalty scheme",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: SITE_URL,
    locale: "en_GB",
    images: [OG_IMAGE],
  },
  // The most-shared URL gets the large card, like every other marketing route.
  twitter: {
    card: "summary_large_image",
    title: `${title} | Nabaperks`,
    description,
    images: [OG_IMAGE],
  },
}

/** The venue QR is a real code, computed once on the server and handed to the
 * sample card so the `qrcode` library never ships to the browser. */
function buildQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" })
  const { size, data } = qr.modules
  const bits = Array.from(
    { length: size * size },
    (_, index) => data[index] === 1
  )
  return { size, bits }
}

// The hero's sample card carries a live QR: scanning it opens the interactive
// /demo customer card, so a curious prospect lands on the product itself, not
// back on this marketing page.
const demoQrMatrix = buildQrMatrix(absoluteUrl("/demo"))

/** Page-level entity graph: the page (WebPage, reviewed by the operator), the
 * product (SoftwareApplication + Offer), the objection set (FAQPage, byte-synced
 * to the visible FAQ subset — the full set lives on /how-it-works), the
 * Scan/Save/Stamp/Reward HowTo (byte-synced to the visible flow), the
 * term glossary (DefinedTermSet) and breadcrumbs — all cross-referenced by
 * stable @id. Quantitative proof stays unpublished until it is reproducible. */
function buildPageGraph() {
  const graph: Record<string, unknown>[] = [
    webPageSchema({
      path: "/",
      name: `${title} | Nabaperks`,
      description,
      reviewedByOperator: true,
    }),
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Nabaperks",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web browser (iOS, Android, any)",
      description:
        "No-app QR loyalty for UK food and drink venues. Each stamp claim is linked to the venue QR and saved membership, with one claim per customer per UK date.",
      url: SITE_URL,
      publisher: { "@id": ORG_ID },
      offers: {
        "@type": "Offer",
        price: "49.00",
        priceCurrency: "GBP",
        description:
          "£49/month per venue, no contract. 30-day free pilot; build the card free and add billing when you activate your live venue QR.",
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/signup"),
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      // The spine renders the first 4 questions; the schema mirrors the SAME
      // slice (visible copy === structured data). All 8 stay on /how-it-works.
      mainEntity: faqs.slice(0, 4).map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
    howToSchema(counterFlowSteps),
    glossarySchema(),
    breadcrumbSchema([{ name: "Home", path: "/" }]),
  ]

  return { "@context": "https://schema.org", "@graph": graph }
}

/** The conversion spine (MS-landing-conversion-spine): pitch → mechanism →
 * proof → persona routing → pricing teaser → objections → ask. The deep
 * chapters live on their own routes: mechanism + anti-fraud + comparison on
 * /how-it-works, persona fit on /loyalty-for-*, full pricing on /pricing. */
export default function HomePage() {
  const promo = getActivePromo()

  return (
    <MarketingLayout>
      {/* Pitch: value prop with the live demo QR */}
      <LandingHero qrMatrix={demoQrMatrix} promo={promo} />

      {/* The four-beat mechanism (deep dive lives on /how-it-works) */}
      <CounterFlow />

      {/* Product facts only. Quantitative aggregate proof remains unpublished
          until it can be regenerated from durable evidence. */}
      <Section id="proof" size="compact">
        <MonoTag tone="leaf">Product facts</MonoTag>
        <h2 className="mt-3 max-w-[26ch] text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
          What the launch path includes.
        </h2>
        <div className="mt-4 sm:mt-5">
          <ProofStrip />
        </div>
        <NabaperksProofBody headingLevel="h3" />
      </Section>

      {/* Persona routing: which venue is yours */}
      <VenuePersonas />

      {/* Close: pricing teaser → top objections → final ask */}
      <TrustPricing />
      <LandingFaq limit={4} />
      <FinalCta />

      {/* SEO/structured data */}
      <JsonLd id="ld-home" data={buildPageGraph()} />
    </MarketingLayout>
  )
}
