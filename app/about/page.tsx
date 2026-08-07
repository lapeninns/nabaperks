import type { Metadata } from "next"
import Link from "next/link"

import { PageTitle } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { ProofStrip } from "@/components/marketing/landing"
import { MARKETING_TEXT_LINK } from "@/components/marketing/text-link"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  BRAND,
  CLAIMS_BOUNDARY,
  DFY_LAUNCH,
  LEGAL_CONTACT,
  MARKET,
  PRODUCT,
  ROUTES,
  SCARCITY,
} from "@/lib/marketing/facts"
import {
  breadcrumbSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"
import { cn } from "@/lib/utils"

const title = "About Nabaperks — Loyalty Made for Independent Pubs"
const description = `${BRAND.pointOfView}. A done-for-you browser loyalty card for independent food-led pubs with busy weekends and quieter midweek trade.`

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
          title="Pub loyalty built around the counter"
          description={`${BRAND.name} is ${BRAND.positioning.toLowerCase()} — practical for staff, simple for regulars and ready to run without another software project.`}
        />
        {/* Three subheaded sections, not five undifferentiated paragraphs:
            the page had no document outline at all between its H1 and the
            ProofStrip, so a reader looking for "who are these people" had no
            entry points. Prose moves from 14px at a 105-character measure to
            the guides' `text-base leading-7` at `max-w-[68ch]`. No copy
            removed. */}
        <div className="grid gap-8 pt-6">
          <section className="grid gap-3">
            <h2 className="text-xl leading-tight font-extrabold text-balance text-foreground sm:text-2xl">
              The pattern we built for
            </h2>
            <p className="max-w-[68ch] text-base leading-7 text-muted-foreground">
              It starts with a pattern independent pubs know well:{" "}
              {MARKET.profileLine.toLowerCase()} Strong weekend rooms, then
              rent, staffing and kitchen capacity sitting underused from Tuesday
              to Thursday.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="text-xl leading-tight font-extrabold text-balance text-foreground sm:text-2xl">
              What we actually do
            </h2>
            <p className="max-w-[68ch] text-base leading-7 text-muted-foreground">
              Independent pubs do not need another complicated software project.
              They need something regulars can understand and staff can run
              during service. The answer is deliberately small:{" "}
              {PRODUCT.cardLine} {PRODUCT.posLine}
            </p>
            <p className="max-w-[68ch] text-base leading-7 text-muted-foreground">
              {DFY_LAUNCH.intro} The venue’s part stays short — display the
              posters, honour the rewards and brief the staff.
            </p>
          </section>
          <section className="grid gap-3">
            <h2 className="text-xl leading-tight font-extrabold text-balance text-foreground sm:text-2xl">
              What we won’t promise
            </h2>
            <p className="max-w-[68ch] text-base leading-7 text-muted-foreground">
              Here’s what we promise, and what we don’t. {CLAIMS_BOUNDARY.never}{" "}
              {CLAIMS_BOUNDARY.guarantee} And because a human team does every
              launch, {SCARCITY.capLine.toLowerCase()} {SCARCITY.capReason}
            </p>
            <p className="max-w-[68ch] text-base leading-7 text-muted-foreground">
              Questions, straight to the Nabaperks team:{" "}
              <a
                className="focus-ring rounded-sm font-bold text-foreground underline underline-offset-4"
                href={`mailto:${LEGAL_CONTACT.supportEmail}`}
              >
                Contact us
              </a>
              .
            </p>
          </section>
        </div>
      </Section>
      <ProofStrip />
      <Section width="narrow" size="last">
        {/* One primary; the secondary destination is a text link. */}
        <div className="grid justify-items-start gap-3">
          <p className="text-base leading-7 font-extrabold text-balance text-foreground">
            Ready to see it working in your own venue?
          </p>
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>Start your launch</Link>
          </Button>
          <Link
            className={cn(MARKETING_TEXT_LINK, "text-foreground")}
            href={ROUTES.howItWorks}
          >
            See how the launch works
          </Link>
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
