import type { Metadata } from "next"
import Link from "next/link"

import { PageTitle } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { ProofStrip } from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  CLAIMS_BOUNDARY,
  DFY_LAUNCH,
  MARKET,
  OPERATOR,
  PRODUCT,
  ROUTES,
  SCARCITY,
} from "@/lib/marketing/facts"
import {
  breadcrumbSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

const title = "About Lapen Inns, the Operator Behind Nabaperks"
const description = `Nabaperks is built and run by ${OPERATOR.name}, ${OPERATOR.estateLine} — a loyalty card made by a pub operator for the quiet-midweek problem.`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.about },
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.about,
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

export default function AboutPage() {
  return (
    <MarketingLayout>
      <Section width="narrow">
        <PageTitle
          eyebrow="About"
          title="A pub operator's answer to quiet Tuesdays"
          description={`Nabaperks is built and run by ${OPERATOR.name}, ${OPERATOR.estateLine}.`}
        />
        <div className="grid gap-4 pt-6">
          <p className="text-sm leading-7 text-muted-foreground">
            The problem it exists for is the one pubs live with every week:{" "}
            {MARKET.profileLine.toLowerCase()} Strong weekend rooms, then rent,
            staffing and kitchen capacity sitting underused from Tuesday to
            Thursday.
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            The answer is deliberately small: {PRODUCT.cardLine}{" "}
            {PRODUCT.posLine} {DFY_LAUNCH.intro} The venue’s part stays short —
            display the posters, honour the rewards, brief the staff.
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            The selling rules are part of the product. {CLAIMS_BOUNDARY.never}{" "}
            {CLAIMS_BOUNDARY.guarantee} And because a human team does every
            launch, {SCARCITY.capLine.toLowerCase()} {SCARCITY.capReason}
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            Questions, straight to the operator:{" "}
            <a
              className="focus-ring rounded-sm font-bold text-foreground underline underline-offset-4"
              href={`mailto:${OPERATOR.supportEmail}`}
            >
              {OPERATOR.supportEmail}
            </a>
            .
          </p>
        </div>
      </Section>
      <ProofStrip />
      <Section width="narrow" size="compact" className="pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your free pilot</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={ROUTES.howItWorks}>See how the launch works</Link>
          </Button>
        </div>
      </Section>
      <JsonLd
        id="ld-about"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.about, title, description }),
            breadcrumbSchema([
              { name: "Home", path: ROUTES.home },
              { name: "About", path: ROUTES.about },
            ]),
          ],
        }}
      />
    </MarketingLayout>
  )
}
