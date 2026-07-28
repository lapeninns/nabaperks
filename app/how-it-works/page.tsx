import type { Metadata } from "next"
import Link from "next/link"

import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { ContrastBand, MarketingLayout, Section } from "@/components/layout"
import { Marquee } from "@/components/marketing"
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

/** The marquee strip echoes the five launch steps the page walks through. */
const MARQUEE_STEPS = [
  "Venue + card setup",
  "Rewards configured",
  "Automations on",
  "Posters printed + posted",
  "You go live",
]

export default function HowItWorksPage() {
  return (
    <MarketingLayout>
      <ProcessHero />
      <Marquee items={[...MARQUEE_STEPS]} />
      <ProblemPains />
      <LaunchSteps />
      <FeaturesListicle />
      <OutcomeTransformation />
      <ContrastBand id="promise">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="grid content-start gap-3">
            <p className="mono-meta text-paper/70">What we promise</p>
            <p className="max-w-xl text-xl leading-snug font-extrabold text-balance sm:text-2xl">
              {CLAIMS_BOUNDARY.guarantee}
            </p>
          </div>
          <div className="grid content-start gap-3 rounded-lg border-2 border-dashed border-paper/40 p-4 sm:p-5">
            <p className="mono-meta text-paper/70">What we never promise</p>
            <p className="text-base leading-7 font-extrabold text-paper">
              {CLAIMS_BOUNDARY.never}
            </p>
            <p className="text-sm leading-6 text-paper/80">
              {SCARCITY.capLine} {SCARCITY.capReason}
            </p>
          </div>
        </div>
      </ContrastBand>
      <Section id="diy" size="dense">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          <div className="grid content-start gap-5">
            <SectionHeader
              eyebrow="Rather set it up yourself?"
              title="The same five steps, whenever you're ready"
              description={`${SETUP.steps} ${SETUP.noFriction} On a done-for-you launch, Lapen Inns does those steps for you.`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={ROUTES.signup}>Start your free pilot</Link>
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
            <p className="mono-id mt-auto text-muted-foreground uppercase">
              {PRODUCT.cancelLine}
            </p>
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
