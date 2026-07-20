import type { Metadata } from "next"

import { MarketingLayout } from "@/components/layout"
import { Marquee } from "@/components/marketing"
import {
  buildQrMatrix,
  FeaturesListicle,
  FinalCta,
  GuaranteeStack,
  LandingFaq,
  LandingGuides,
  LandingHero,
  LandingNav,
  LandingPricing,
  LaunchProcess,
  OutcomeTransformation,
  ProblemPains,
  ProofStrip,
  ScarcityBand,
  VenueFit,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { DFY_LAUNCH, FAQ_ITEMS, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import {
  absoluteUrl,
  faqPageSchema,
  growthPlanSchema,
  howToSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = "The 30-Day First-Regular Pub Loyalty Launch"
const description = `A done-for-you browser loyalty card for single-site UK food-led pubs. No setup fee: rewards configured and posters posted. ${PRODUCT.pilot}, then ${PRODUCT.price}.`

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
  const demoQr = buildQrMatrix(absoluteUrl(ROUTES.demo))

  return (
    <MarketingLayout>
      <LandingHero demoQr={demoQr} />
      <Marquee />
      <LandingNav />
      <ProofStrip />
      <ProblemPains />
      <LaunchProcess />
      <FeaturesListicle />
      <VenueFit />
      <OutcomeTransformation />
      <GuaranteeStack />
      <LandingPricing />
      <ScarcityBand />
      <LandingGuides />
      <LandingFaq />
      <FinalCta />
      <JsonLd
        id="ld-home"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.home, title, description }),
            growthPlanSchema(),
            howToSchema({
              path: ROUTES.home,
              name: "How the Nabaperks done-for-you pub loyalty launch works",
              description:
                "Five steps from venue setup to a live no-app loyalty card and printed counter posters.",
              steps: DFY_LAUNCH.steps,
            }),
            faqPageSchema(ROUTES.home, FAQ_ITEMS),
          ],
        }}
      />
    </MarketingLayout>
  )
}
