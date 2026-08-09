import Link from "next/link"
import { Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import {
  Icon,
  MonoTag,
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { PriceLockup } from "@/components/marketing"
import { FinePrint } from "@/components/marketing/fine-print"
import { JsonLd } from "@/components/seo/json-ld"
import { Button } from "@/components/ui/button"
import {
  CLAIMS_BOUNDARY,
  CORE_OFFER,
  GUARANTEE,
  GUARANTEE_ROI,
  MARKET,
  OFFER,
  PERSONAS,
  PLAN_LINE,
  PRODUCT,
  ROUTES,
  SCARCITY,
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
    robots: persona.primary
      ? undefined
      : {
          index: false,
          // Keep discovery flowing to the supported pub-first offer while
          // these unsupported vertical spokes await traffic/backlink evidence
          // for a safe 301, consolidation, or retention decision.
          follow: true,
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
          size="band"
          eyebrow="What's included"
          title="What the launch sets up for you"
        />
        {/* "What you get", "who it's for" and "who it's not for" used to be
            three visually identical grey dashed lists. This one is the
            checked-inclusion idiom the pricing sheet owns. */}
        <ul className="grid gap-3 pt-5 md:grid-cols-2 md:gap-x-8">
          {CORE_OFFER.map((component) => (
            <li key={component.name} className="flex items-start gap-3">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={18}
                className="mt-0.5 shrink-0 text-reward"
              />
              <span className="grid gap-1">
                <span className="text-sm font-extrabold text-foreground">
                  {component.name}
                </span>
                <span className="text-sm leading-6 text-muted-foreground">
                  {component.why}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {persona.primary ? (
        <Section size="compact">
          <SectionHeader
            eyebrow="Who it's built for"
            title="Is this right for your pub?"
          />
          <div className="grid gap-5 pt-5 md:grid-cols-2">
            {/* Bordered card for the qualifier, dashed card for the "not yet",
                with the same glyph vocabulary the hub's fit test uses — so the
                two lists are legible at a glance instead of being two
                identical grey dashed stacks. */}
            <div className="grid content-start gap-4 rounded-lg border-2 border-ink bg-card p-5 shadow-sm sm:p-6">
              <MonoTag tone="leaf" className="justify-self-start">
                Right for you
              </MonoTag>
              <ul className="grid gap-3">
                {MARKET.qualify.map((rule) => (
                  <li key={rule} className="flex items-start gap-3">
                    <Icon
                      icon={CheckmarkCircle02Icon}
                      size={18}
                      className="mt-0.5 shrink-0 text-reward"
                    />
                    <span className="text-sm leading-6 text-foreground">
                      {rule}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-4 rounded-lg border-2 border-dashed border-line-strong bg-card p-5 sm:p-6">
              {/* `plain`, not `ink` — see pub-fit-test.tsx. */}
              <MonoTag className="justify-self-start">Not right yet</MonoTag>
              <ul className="grid gap-3">
                {MARKET.disqualify.map((rule) => (
                  <li key={rule} className="flex items-start gap-3">
                    <Icon
                      icon={Cancel01Icon}
                      size={18}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <span className="text-sm leading-6 text-muted-foreground">
                      {rule}
                    </span>
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
            Your guarantees, and the catch
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
      <Section size="last">
        <div className="grid gap-4">
          {/* The spokes never showed a numeral, so a page bought for direct
              traffic forced a second click before the first objection could be
              answered. The plan line stays; the price now leads it. */}
          <PriceLockup
            size="lead"
            amount={PRODUCT.priceAmount}
            cadence={PRODUCT.priceCadence}
          />
          <p className="text-sm leading-6 font-bold text-foreground">
            {PLAN_LINE}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {SCARCITY.capLine} {SCARCITY.capReason}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.signup}>Start your launch</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={ROUTES.howItWorks}>See how the launch works</Link>
            </Button>
          </div>
          <FinePrint>{PRODUCT.cancelLine}</FinePrint>
          {/* Sibling spokes. Before this, /loyalty-for-cafes, -bars and
              -takeaways were ORPHANS: a crawl of every internal link on every
              public page found not one pointing at them. They were reachable
              only from the sitemap or a direct URL, while each carried a
              `navLabel` ("Cafés", "Bars", "Takeaways") that nothing rendered —
              a nav that was specified and never built.

              Labels come from PERSONAS, so this invents no copy and cannot
              drift from the page titles. */}
          <nav aria-label="Other venue types" className="grid gap-2 pt-2">
            <p className="text-sm leading-6 text-muted-foreground">
              Not a {persona.noun}?
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {PERSONAS.filter((sibling) => sibling.slug !== persona.slug).map(
                (sibling) => (
                  <li key={sibling.slug}>
                    <Link
                      href={sibling.path}
                      className="text-sm leading-6 font-bold underline underline-offset-4"
                    >
                      {sibling.title}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </nav>
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
