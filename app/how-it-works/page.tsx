import type { Metadata } from "next"
import Link from "next/link"

import { PageTitle, SectionHeader } from "@/components/brand"
import { ContrastBand, MarketingLayout, Section } from "@/components/layout"
import { LaunchSteps } from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  CLAIMS_BOUNDARY,
  DFY_LAUNCH,
  GUARANTEE,
  MARKET,
  PRODUCT,
  ROUTES,
  SCARCITY,
  SETUP,
  SETUP_FEE,
} from "@/lib/marketing/facts"
import {
  breadcrumbSchema,
  howToSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = "How the Done-For-You Launch Works"
const description = `${DFY_LAUNCH.intro} Venue and card configured, rewards and automations switched on, posters printed and posted — then you go live from one venue QR.`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.howItWorks },
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

export default function HowItWorksPage() {
  return (
    <MarketingLayout>
      <Section>
        <PageTitle
          eyebrow="The process"
          title="We do the launch. You go live."
          description={MARKET.promise}
        />
      </Section>
      <Section size="compact">
        <LaunchSteps />
        <p className="pt-4 text-sm leading-6 text-muted-foreground">
          {DFY_LAUNCH.yourPart}
        </p>
      </Section>
      <ContrastBand>
        <div className="grid gap-3">
          <p className="mono-meta text-paper/70">The deal, plainly</p>
          <p className="max-w-2xl text-lg leading-snug font-extrabold">
            {CLAIMS_BOUNDARY.guarantee}
          </p>
          <p className="max-w-2xl text-sm leading-6 text-paper/80">
            {CLAIMS_BOUNDARY.never} {SCARCITY.capLine} {SCARCITY.capReason}
          </p>
        </div>
      </ContrastBand>
      <Section>
        <SectionHeader
          eyebrow="Rather drive it yourself?"
          title="The same five steps are in the product, self-serve"
          description={`${SETUP.steps} ${SETUP.noFriction} On a done-for-you launch, Lapen Inns does those steps for you — that's what the ${SETUP_FEE.label.toLowerCase()} covers.`}
        />
        <div className="grid gap-3 pt-6 sm:flex sm:flex-wrap sm:items-center">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your free pilot</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.pricing}>See pricing</Link>
          </Button>
        </div>
        <p className="pt-4 text-sm leading-6 text-muted-foreground">
          <span className="font-bold text-foreground">{GUARANTEE.name}:</span>{" "}
          {GUARANTEE.line} {PRODUCT.cancelLine}
        </p>
      </Section>
      <JsonLd
        id="ld-how-it-works"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.howItWorks, title, description }),
            howToSchema({
              path: ROUTES.howItWorks,
              name: title,
              description,
              steps: DFY_LAUNCH.steps,
            }),
            breadcrumbSchema([
              { name: "Home", path: ROUTES.home },
              { name: "How it works", path: ROUTES.howItWorks },
            ]),
          ],
        }}
      />
    </MarketingLayout>
  )
}
