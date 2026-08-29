import type { Metadata } from "next"
import Link from "next/link"

import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { ContrastBand, MarketingLayout, Section } from "@/components/layout"
import { FinePrint } from "@/components/marketing"
import {
  FeaturesListicle,
  LaunchSteps,
  OutcomeTransformation,
  ProblemPains,
  ProcessHero,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  CLAIMS_BOUNDARY,
  DFY_LAUNCH,
  GUARANTEE,
  PRODUCT,
  ROUTES,
  SCARCITY,
  SETUP,
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
      <ProcessHero />
      <ProblemPains />
      <LaunchSteps />
      <FeaturesListicle />
      <OutcomeTransformation />
      <ContrastBand id="promise" size="dense">
        <div className="grid gap-6 md:grid-cols-2 md:gap-10 lg:gap-12">
          {/* Equal weight, deliberately: the boundary is the ASA-critical
              half of the pair and the reason the band exists, so it gets the
              same type size as the promise and a real ground rather than a
              faint dashed outline. */}
          <div className="grid content-start gap-3 rounded-lg border-2 border-paper/60 bg-paper/10 p-4 sm:p-5">
            <p className="mono-meta text-paper/70">What we promise</p>
            <p className="max-w-xl text-lg leading-snug font-extrabold text-balance sm:text-xl">
              {CLAIMS_BOUNDARY.guarantee}
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border-2 border-paper/60 bg-paper/10 p-4 sm:p-5">
            <p className="mono-meta text-paper/70">What we never promise</p>
            <p className="text-lg leading-snug font-extrabold text-balance text-paper sm:text-xl">
              {CLAIMS_BOUNDARY.never}
            </p>
            <p className="text-sm leading-6 text-paper/80">
              {SCARCITY.capLine} {SCARCITY.capReason}
            </p>
          </div>
        </div>
      </ContrastBand>
      <Section id="diy" size="dense">
        <div className="grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10 lg:gap-12">
          <div className="grid content-start gap-5">
            <SectionHeader
              eyebrow="Rather set it up yourself?"
              title="The same five steps, whenever you're ready"
              description={`${SETUP.steps} ${SETUP.noFriction} On a done-for-you launch, the Nabaperks team does those steps for you.`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={ROUTES.signup}>Start your launch</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={ROUTES.pricing}>See pricing</Link>
              </Button>
            </div>
          </div>
          <ReceiptCard edge padding="md" className="h-full content-start gap-3">
            <MonoTag tone="leaf" className="justify-self-start">
              {GUARANTEE.name}
            </MonoTag>
            <p className="text-base leading-7 font-extrabold text-foreground">
              “{GUARANTEE.line}”
            </p>
            <FinePrint className="mt-auto">{PRODUCT.cancelLine}</FinePrint>
          </ReceiptCard>
        </div>
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
