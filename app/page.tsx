import type { Metadata } from "next"

import { MarketingLayout } from "@/components/layout"
import { Marquee } from "@/components/marketing"
import {
  buildQrMatrix,
  CommercialEvidenceProof,
  FinalCta,
  FitNote,
  LandingHero,
  LandingPricing,
  ProductMoment,
  ProofLine,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { PRODUCT, ROUTES } from "@/lib/marketing/facts"
import {
  absoluteUrl,
  growthPlanSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = "The 28-Day First-Regular Pub Loyalty Launch"
const description = `Done-for-you browser loyalty for single-site UK food-led pubs. ${PRODUCT.launchFee} launch today; 28-day free pilot from poster delivery; then ${PRODUCT.price}.`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.home },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.home,
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

export default function LandingPage() {
  const demoQr = buildQrMatrix(absoluteUrl(ROUTES.demo))

  return (
    <MarketingLayout>
      <LandingHero demoQr={demoQr} />
      <Marquee />
      <ProofLine />
      <CommercialEvidenceProof />
      <ProductMoment demoQr={demoQr} />
      <FitNote />
      <LandingPricing />
      <FinalCta />
      <JsonLd
        id="ld-home"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.home, title, description }),
            growthPlanSchema(),
          ],
        }}
      />
    </MarketingLayout>
  )
}
