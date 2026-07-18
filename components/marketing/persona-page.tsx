import Link from "next/link"

import {
  MonoTag,
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  CLAIMS_BOUNDARY,
  CORE_OFFER,
  GUARANTEE,
  GUARANTEE_ROI,
  MARKET,
  OFFER,
  PRODUCT,
  ROUTES,
  SCARCITY,
  SETUP_FEE,
  type MarketingPersona,
} from "@/lib/marketing/facts"
import {
  breadcrumbSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"
import type { Metadata } from "next"

/** Shared metadata recipe for the four persona spokes. */
export function personaPageMetadata({
  persona,
  title,
  description,
}: {
  persona: MarketingPersona
  title: string
  description: string
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: persona.path },
    openGraph: {
      title: `${title} | Nabaperks`,
      description,
      type: "website",
      siteName: "Nabaperks",
      url: persona.path,
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
}

/**
 * Shared persona spoke: the same offer engine presented for one vertical. The
 * pub spoke is the primary offer and carries the pack's qualify/disqualify
 * rules; the other spokes lead with the ASA-safer wrapper and an explicit
 * pub-first fit note, so no vertical gets a claim the offer wasn't built for.
 */
export function PersonaSpokePage({
  persona,
  title,
  description,
}: {
  persona: MarketingPersona
  title: string
  description: string
}) {
  return (
    <MarketingLayout>
      <Section>
        <PageTitle
          eyebrow={persona.quietQuestion}
          title={persona.title}
          description={persona.audience}
        />
        <div className="mt-6 grid gap-2 border-l-2 border-ink pl-4">
          <p className="mono-meta text-muted-foreground">The offer</p>
          <p className="text-xl leading-snug font-extrabold text-foreground">
            {persona.offerName}
          </p>
          {persona.primary ? (
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              {OFFER.nameNote}
            </p>
          ) : null}
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            {persona.fitNote}
          </p>
        </div>
      </Section>
      <Section size="compact">
        <SectionHeader
          eyebrow="Same engine, four components"
          title="What the launch includes"
        />
        <ul className="grid gap-2.5 pt-5">
          {CORE_OFFER.map((component) => (
            <li
              key={component.name}
              className="grid gap-1 border-b-2 border-dashed border-border pb-2.5"
            >
              <span className="text-sm font-extrabold text-foreground">
                {component.name}
              </span>
              <span className="text-sm leading-6 text-muted-foreground">
                {component.why}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {persona.primary ? (
        <Section size="compact">
          <SectionHeader
            eyebrow="Who it's built for"
            title="We qualify hard — that's what keeps the launch good"
          />
          <div className="grid gap-5 pt-5 lg:grid-cols-2">
            <div className="grid content-start gap-2">
              <MonoTag tone="leaf" className="justify-self-start">
                We prioritise
              </MonoTag>
              <ul className="grid gap-2">
                {MARKET.qualify.map((rule) => (
                  <li
                    key={rule}
                    className="border-b-2 border-dashed border-border pb-2 text-sm leading-6 text-muted-foreground"
                  >
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-2">
              <MonoTag tone="ink" className="justify-self-start">
                We honestly turn away
              </MonoTag>
              <ul className="grid gap-2">
                {MARKET.disqualify.map((rule) => (
                  <li
                    key={rule}
                    className="border-b-2 border-dashed border-border pb-2 text-sm leading-6 text-muted-foreground"
                  >
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      ) : null}
      <Section size="compact">
        <ReceiptCard edge padding="md" className="gap-3">
          <p className="mono-meta text-muted-foreground">
            The guarantees — and the boundary
          </p>
          <p className="text-sm leading-6 text-foreground">
            <span className="font-bold">{GUARANTEE.name}:</span>{" "}
            {GUARANTEE.line}
          </p>
          <p className="text-sm leading-6 text-foreground">
            <span className="font-bold">{GUARANTEE_ROI.name}:</span>{" "}
            {GUARANTEE_ROI.line}
          </p>
          <p className="border-t-2 border-dashed border-border pt-2 text-sm leading-6 text-muted-foreground">
            {CLAIMS_BOUNDARY.never} {CLAIMS_BOUNDARY.yourPart}
          </p>
        </ReceiptCard>
      </Section>
      <Section size="compact" className="pb-10">
        <div className="grid gap-4">
          <p className="text-sm leading-6 font-bold text-foreground">
            {SETUP_FEE.label} · then {PRODUCT.price} (or {PRODUCT.priceAnnual} —{" "}
            {PRODUCT.annualSaving}) after a {PRODUCT.pilot}.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {SCARCITY.capLine} {SCARCITY.capReason}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.signup}>Start your free pilot</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={ROUTES.howItWorks}>See how the launch works</Link>
            </Button>
          </div>
          <p className="mono-id text-muted-foreground uppercase">
            {PRODUCT.cancelLine}
          </p>
        </div>
      </Section>
      <JsonLd
        id={`ld-${persona.slug}`}
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: persona.path, title, description }),
            breadcrumbSchema([
              { name: "Home", path: ROUTES.home },
              { name: persona.title, path: persona.path },
            ]),
          ],
        }}
      />
    </MarketingLayout>
  )
}
