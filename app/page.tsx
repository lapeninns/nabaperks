import type { Metadata } from "next"
import QRCode from "qrcode"

import { MarketingLayout } from "@/components/layout"
import {
  ComparisonTable,
  CounterFlow,
  CounterVerifiedStamp,
  FinalCta,
  JumpNav,
  LandingFaq,
  LandingHero,
  MidPageCta,
  OperatorProof,
  ProofStrip,
  SeparateMarketing,
  TrustPricing,
  VenueBenefits,
  VenuePersonas,
  VenueProof,
  NabaperksProof,
  faqs,
  type QrMatrix,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import {
  ORG_ID,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo/structured-data"

const title = "No-App QR Loyalty Cards for UK Cafes & Pubs"
const description =
  "Replace paper stamp cards with one venue QR. Customers scan, save a browser card (no app, no wallet pass), and collect till-verified stamps. £29/mo, 30-day free pilot."

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
  },
  twitter: {
    card: "summary",
    title: `${title} | Nabaperks`,
    description,
  },
}

/** The landing page's top nav adds the on-page "How it works" anchor; the
 * shared marketing shell supplies the marquee, sticky header CTA, and footer. */
const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Log in" },
]

/** The venue QR is a real code, computed once on the server and handed to the
 * sample card and the reward reveal so the `qrcode` library never ships to the
 * browser. */
function buildQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" })
  const { size, data } = qr.modules
  const bits = Array.from(
    { length: size * size },
    (_, index) => data[index] === 1
  )
  return { size, bits }
}

const qrMatrix = buildQrMatrix("https://nabaperks.com")

/** Page-level entity graph: the product (SoftwareApplication + Offer), the
 * objection set (FAQPage, byte-synced to the visible FAQ), the named anti-fraud
 * method (DefinedTerm) and breadcrumbs. */
function buildPageGraph() {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Nabaperks",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web browser (iOS, Android, any)",
      description:
        "No-app QR loyalty for UK food & drink venues. A browser-based digital stamp card with the Counter-Verified Stamp — every stamp till-verified before it counts. No app, no wallet pass, no POS.",
      url: SITE_URL,
      publisher: { "@id": ORG_ID },
      offers: {
        "@type": "Offer",
        price: "29.00",
        priceCurrency: "GBP",
        description:
          "£29/month per venue, no contract. 30-day free pilot; build the card free and add billing when you activate your live venue QR.",
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/signup"),
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
    {
      "@type": "DefinedTerm",
      "@id": `${SITE_URL}/#counter-verified-stamp`,
      name: "Counter-Verified Stamp",
      description:
        "Nabaperks' anti-fraud method: every loyalty stamp is checked against the physical venue QR, the customer's membership, the venue's live account, a one-stamp-per-customer-per-UK-calendar-date cap, and optional unusual-location checks; rewards are checked at redemption.",
      inDefinedTermSet: `${SITE_URL}/#glossary`,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ],
    },
  ]

  return { "@context": "https://schema.org", "@graph": graph }
}

export default function HomePage() {
  return (
    <MarketingLayout navLinks={navLinks}>
      <LandingHero qrMatrix={qrMatrix} />
      <JumpNav />
      <ProofStrip />
      <OperatorProof />
      <CounterFlow />
      <NabaperksProof />
      <ComparisonTable />
      <CounterVerifiedStamp />
      <MidPageCta />
      <VenueBenefits qrMatrix={qrMatrix} />
      <VenuePersonas />
      <VenueProof />
      <SeparateMarketing />
      <TrustPricing />
      <LandingFaq />
      <FinalCta />
      <JsonLd id="ld-home" data={buildPageGraph()} />
    </MarketingLayout>
  )
}
