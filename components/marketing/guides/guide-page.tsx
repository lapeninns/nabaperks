import type { Metadata } from "next"
import Link from "next/link"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  GUARANTEE,
  OPERATOR,
  PLAN_LINE,
  PRODUCT,
  ROUTES,
} from "@/lib/marketing/facts"
import {
  articleSchema,
  breadcrumbSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"

import { ComparisonTable } from "./comparison-table"
import { GUIDES, PAPER_VS_QR_ROWS, type Guide } from "./guides-data"

/** Shared metadata recipe for the guide routes. */
export function guidePageMetadata(guide: Guide): Metadata {
  return {
    title: guide.metaTitle,
    description: guide.description,
    alternates: { canonical: guide.path },
    openGraph: {
      title: `${guide.metaTitle} | Nabaperks`,
      description: guide.description,
      type: "article",
      siteName: "Nabaperks",
      url: guide.path,
      locale: "en_GB",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${guide.metaTitle} | Nabaperks`,
      description: guide.description,
      images: [OG_IMAGE],
    },
  }
}

/**
 * Guide shell: narrow reading column, doc-grounded sections, the honest
 * comparison table where the guide calls for it, and one clearly-priced CTA.
 */
export function GuidePage({ guide }: { guide: Guide }) {
  return (
    <MarketingLayout>
      <Section width="narrow">
        <PageTitle
          eyebrow="Guide"
          title={guide.title}
          description={guide.intro}
        />
        <p className="mono-id mt-4 text-muted-foreground uppercase">
          Published by Nabaperks · operated by {OPERATOR.name} · updated{" "}
          <time dateTime={guide.updatedOn}>19 July 2026</time>
        </p>
      </Section>
      <Section width="narrow" size="compact" as="div">
        <article className="grid gap-8">
          {guide.sections.map((section) => (
            <section key={section.heading} className="grid gap-3">
              <h2 className="text-xl leading-snug font-extrabold text-foreground">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm leading-7 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              {guide.comparisonAfterHeading === section.heading ? (
                <div className="pt-2">
                  <ComparisonTable
                    rows={PAPER_VS_QR_ROWS}
                    caption="Paper stamp cards compared with the QR browser card"
                  />
                </div>
              ) : null}
            </section>
          ))}
        </article>
      </Section>
      <Section width="narrow" size="compact">
        <h2 className="text-xl leading-snug font-extrabold text-foreground">
          More practical pub loyalty guides
        </h2>
        <ul className="mt-3 grid gap-2">
          {GUIDES.filter((candidate) => candidate.slug !== guide.slug).map(
            (candidate) => (
              <li
                key={candidate.slug}
                className="border-b-2 border-dashed border-border pb-2"
              >
                <Link
                  href={candidate.path}
                  className="focus-ring rounded-sm text-sm font-bold text-primary underline underline-offset-4"
                >
                  {candidate.title}
                </Link>
              </li>
            )
          )}
        </ul>
      </Section>
      <Section width="narrow" size="compact" className="pb-10">
        <ReceiptCard edge padding="md" className="gap-3">
          <p className="mono-meta text-muted-foreground">
            If you’d rather not do any of this yourself
          </p>
          <p className="text-sm leading-6 text-foreground">
            {PLAN_LINE} <span className="font-bold">{GUARANTEE.name}:</span>{" "}
            {GUARANTEE.line}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={ROUTES.signup}>Start your free pilot</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={ROUTES.howItWorks}>See how the launch works</Link>
            </Button>
          </div>
          <p className="mono-id text-muted-foreground uppercase">
            {PRODUCT.cancelLine}
          </p>
        </ReceiptCard>
      </Section>
      <JsonLd
        id={`ld-guide-${guide.slug}`}
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({
              path: guide.path,
              title: guide.metaTitle,
              description: guide.description,
            }),
            articleSchema({
              path: guide.path,
              headline: guide.title,
              description: guide.description,
              datePublished: guide.publishedOn,
              dateModified: guide.updatedOn,
            }),
            breadcrumbSchema([
              { name: "Home", path: ROUTES.home },
              { name: guide.title, path: guide.path },
            ]),
          ],
        }}
      />
    </MarketingLayout>
  )
}
