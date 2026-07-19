import type { Metadata } from "next"

import { MarketingLayout } from "@/components/layout"
import { Marquee } from "@/components/marketing"
import {
  buildQrMatrix,
  FeaturesListicle,
  FinalCta,
  GuaranteeStack,
  LandingFaq,
  LandingHero,
  LandingPricing,
  OutcomeTransformation,
  ProblemPains,
  ProofStrip,
  ScarcityBand,
  VenuePersonas,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { FAQ_ITEMS, OFFER, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import { getActivePromo } from "@/lib/marketing/promo"
import {
  absoluteUrl,
  faqPageSchema,
  growthPlanSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = OFFER.name
// 151 code points (budget 145–159); prices render only via the single-source
// facts so the description can never drift from the offer.
const description = `Lapen Inns sets up and launches a no-app loyalty card for your pub — rewards configured, posters printed and posted. ${PRODUCT.pilot}, then ${PRODUCT.price}.`

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

export default function LandingPage() {
  const promo = getActivePromo()
  const demoQr = buildQrMatrix(absoluteUrl(ROUTES.demo))

  return (
    <MarketingLayout>
      <LandingHero promo={promo} demoQr={demoQr} />
      <Marquee />
      <ProofStrip />
      <ProblemPains />
      <FeaturesListicle />
      <OutcomeTransformation />
      <GuaranteeStack />
      <LandingPricing promo={promo} />
      <ScarcityBand promo={promo} />
      <VenuePersonas />
      <LandingFaq />
      <FinalCta promo={promo} />
      <JsonLd
        id="ld-home"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.home, title, description }),
            growthPlanSchema(),
            faqPageSchema(ROUTES.home, FAQ_ITEMS),
          ],
        }}
      />
    </MarketingLayout>
  )
}
