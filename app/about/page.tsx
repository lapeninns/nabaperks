import type { Metadata } from "next"
import Link from "next/link"

import { Eyebrow, Icon, MonoTag, PageTitle } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Mail01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { JsonLd } from "@/components/seo/json-ld"
import {
  CTA,
  OPERATOR,
  OPERATOR_ESTATE,
  PRODUCT,
  ROUTES,
} from "@/lib/marketing/facts"
import { marketingPageGraph, OG_IMAGE } from "@/lib/seo/structured-data"

const title = "About Nabaperks"
const description = `Nabaperks is built and run by ${OPERATOR.name}, a ${OPERATOR.role} running ${OPERATOR.estateShort}. A browser-based loyalty card with counter-verified stamps, made by people who run the counter.`

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

const story = [
  // The lede above already introduces the operator; open on what we make so
  // the page does not repeat its first sentence verbatim.
  "We make a browser-based loyalty card with counter-verified stamps — and we run it across our own bars before we ask anyone else to.",
  "We built it because the loyalty tools we tried got in the way of the counter: an app to download for a pint, a wallet pass to install, paper cards lost in the wash, or a POS we did not want to replace. So we made the opposite — a card that opens from a QR in the browser, saves in one tap, and verifies every stamp at the counter.",
  "That operator's view is the whole point. Nabaperks is shaped by what actually works on a busy shift, in a real pub, with real regulars.",
]

const principles = [
  "Built by an operator that runs its own pubs, not a software house guessing at the counter",
  PRODUCT.posLine,
  "Loyalty kept separate from marketing — a regular can collect and redeem without joining any list",
  "Counter-verified stamps, so a finished card always means a real regular",
]

const aboutGraph = marketingPageGraph({
  page: { path: ROUTES.about, name: `${title} | Nabaperks`, description },
  breadcrumbs: [
    { name: "Home", path: ROUTES.home },
    { name: "About", path: ROUTES.about },
  ],
})

export default function AboutPage() {
  return (
    <MarketingLayout>
      <Section>
        <PageTitle
          eyebrow="About"
          title="The operator behind Nabaperks."
          description={`Nabaperks is built and run by ${OPERATOR.name} — a ${OPERATOR.role} running ${OPERATOR.estateShort}.`}
          titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
          descriptionClassName="text-base leading-7 text-pretty"
          className="md:grid-cols-1"
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <article className="flex max-w-[65ch] flex-col gap-4">
            {story.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="text-[0.975rem] leading-relaxed text-pretty text-foreground"
              >
                {paragraph}
              </p>
            ))}

            <ul className="mt-2 grid gap-3">
              {principles.map((principle) => (
                <li key={principle} className="flex items-start gap-3">
                  <Icon
                    icon={Tick02Icon}
                    size={18}
                    strokeWidth={2.5}
                    className="mt-0.5 shrink-0 text-primary"
                  />
                  <span className="text-[0.95rem] leading-snug font-bold text-pretty">
                    {principle}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          {/* Operator fact card */}
          <aside className="surface-card p-6 lg:sticky lg:top-20">
            <Eyebrow>Operator</Eyebrow>
            <p className="mt-2 text-xl font-extrabold">{OPERATOR.name}</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              {OPERATOR.role} · {OPERATOR.region}, {OPERATOR.country}
            </p>
            <hr className="w-rule my-4" />
            <Eyebrow className="mb-2">Contact</Eyebrow>
            <a
              href={`mailto:${OPERATOR.supportEmail}`}
              className="inline-flex items-center gap-2 text-sm font-bold underline-offset-4 hover:text-primary hover:underline"
            >
              <Icon icon={Mail01Icon} size={16} strokeWidth={2.25} />
              {OPERATOR.supportEmail}
            </a>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The same address is our privacy and data contact. See our{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-primary"
              >
                privacy summary
              </Link>
              .
            </p>
          </aside>
        </div>
      </Section>

      {/* The operating estate */}
      <Section id="estate" size="compact">
        <div className="surface-card px-6 py-8 sm:px-10 sm:py-10">
          <MonoTag tone="leaf">Our pubs</MonoTag>
          <h2 className="mt-4 max-w-[34ch] text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
            {OPERATOR.estateShort}.
          </h2>
          <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-pretty text-muted-foreground">
            The {OPERATOR.name} estate — the pubs where Nabaperks is built, run and
            pressure-tested.
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {OPERATOR_ESTATE.map((pub) => (
              <li
                key={pub.postcode}
                className="rounded-[var(--radius)] border-2 border-dashed border-border p-4"
              >
                <p className="text-[0.95rem] leading-snug font-extrabold text-balance">
                  {pub.name}
                </p>
                <p className="mono-meta mt-1 text-muted-foreground">
                  {pub.postcode} · {OPERATOR.region}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* CTA */}
      <Section width="narrow" className="max-w-2xl text-center">
        <h2 className="mx-auto max-w-[20ch] text-[clamp(1.6rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.02em] text-balance">
          Run a venue? Try it on your own counter.
        </h2>
        <p className="mx-auto mt-3 max-w-[44ch] text-base leading-relaxed text-muted-foreground">
          Build your card, preview the QR flow, and start a {PRODUCT.pilot} when
          you activate your live venue QR.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href={ROUTES.signup}>{CTA.startPilot}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={ROUTES.pubHub}>{CTA.pub}</Link>
          </Button>
        </div>
      </Section>
      <JsonLd id="ld-about" data={aboutGraph} />
    </MarketingLayout>
  )
}
