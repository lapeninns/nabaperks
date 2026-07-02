import type { Metadata } from "next"
import Link from "next/link"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import {
  ComparisonTable,
  FinalCta,
  NabaperksProof,
  PubCounterFlow,
  RegularsCalculator,
  pubCounterFlowSteps,
} from "@/components/marketing/landing"
import { Button } from "@/components/ui/button"
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { JsonLd } from "@/components/seo/json-ld"
import { GUIDES } from "@/components/marketing/guides/guides-data"
import { CTA, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import {
  counterLoyaltyIndexDataset,
  howToSchema,
  marketingPageGraph,
  OG_IMAGE,
} from "@/lib/seo/structured-data"

const title = "Loyalty for Pubs & Gastropubs — No-App QR Stamp Cards"
const description =
  "Reward regulars without an app or a CRM. One venue QR for the bar, the tables and the takeaway hatch — a browser-based loyalty card with counter-verified stamps. No POS or EPOS integration required. £29/month, 30-day free pilot."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.pubHub },
  keywords: [
    "loyalty for pubs",
    "pub loyalty scheme",
    "reward pub regulars without an app",
    "gastropub loyalty card",
    "pub stamp card no app",
    "QR loyalty card for pubs",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.pubHub,
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

const navLinks = [
  { href: "#how-it-fits", label: "How it works" },
  { href: "#pub-guides", label: "Guides" },
  { href: "/pricing", label: "Pricing" },
]

/** The pub-specific frictions the hub is built to answer (PDF query spectrum). */
const painPoints = [
  {
    title: "Mixed service points",
    body: "The bar, the tables, the kitchen pass and the takeaway hatch all take orders. One permanent venue QR covers every one of them — no extra till, no extra step.",
  },
  {
    title: "App and CRM friction",
    body: "Regulars will not download an app for a pint, and you do not want another CRM to run. The card opens in the browser and saves in one tap, with nothing to install.",
  },
  {
    title: "Paper cards lost and gamed",
    body: "Paper stamp cards end up in the wash or stamped twice by a friendly hand. A browser-based card lives on the customer's phone and every stamp is counter-verified.",
  },
  {
    title: "Stamping that survives a staff change",
    body: "Customers scan and stamp themselves from your QR, so a new face behind the bar changes nothing. The rule — one stamp per customer per UK date — is the same on every shift.",
  },
  {
    title: "Quieter days, without slowing the bar",
    body: "Give regulars a reason to come in on a Tuesday, not just a Friday. Scanning takes a second and never holds up the round — the phone never crosses the counter.",
  },
]

const benefits = [
  "One venue QR for the bar, the tables and the takeaway hatch",
  "Counter-verified stamps that can't be faked or double-claimed",
  "A weekly digest of visits, regulars and redemptions",
  "Loyalty kept separate from marketing — regulars opt in only if they choose",
  PRODUCT.posLine,
]

const hubGraph = marketingPageGraph({
  page: {
    path: ROUTES.pubHub,
    name: `${title} | Nabaperks`,
    description,
    reviewedByOperator: true,
  },
  breadcrumbs: [
    { name: "Home", path: ROUTES.home },
    { name: CTA.pub, path: ROUTES.pubHub },
  ],
  extraNodes: [howToSchema(pubCounterFlowSteps), counterLoyaltyIndexDataset()],
})

export default function LoyaltyForPubsPage() {
  return (
    <MarketingLayout navLinks={navLinks}>
      {/* Hero */}
      <Section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:py-14">
        <div className="flex flex-col gap-5">
          <MonoTag tone="accent">{CTA.pub}</MonoTag>
          <h1 className="text-[clamp(2rem,6vw,4rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
            Loyalty for pubs and gastropubs.
          </h1>
          <p className="max-w-[46ch] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Reward your regulars without an app or a CRM.{" "}
            {PRODUCT.cardLine} One permanent QR covers the bar, the tables and
            the takeaway hatch — and every stamp is{" "}
            <strong className="font-semibold text-foreground">
              counter-verified
            </strong>
            .
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.signup}>{CTA.startPilot}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.pricing}>View pricing</Link>
            </Button>
          </div>
          <p className="mono-meta font-normal leading-relaxed text-muted-foreground">
            {PRODUCT.pilot}, then {PRODUCT.price} · no contract ·{" "}
            {PRODUCT.posLine}
          </p>
        </div>

        <div className="surface-card rounded-[var(--radius)] p-6 sm:p-8">
          <Eyebrow>For a pub, that means</Eyebrow>
          <ul className="mt-4 grid gap-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <Icon
                  icon={Tick02Icon}
                  size={18}
                  strokeWidth={2.5}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span className="text-[0.95rem] leading-snug font-bold text-pretty">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Pub pain points */}
      <Section id="pub-problems">
        <div className="max-w-[46ch]">
          <MonoTag tone="leaf">Built for the bar</MonoTag>
          <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
            Made for how a pub actually runs.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
            A pub is not a coffee shop with one till. The five frictions below are
            the ones we hear from food-led pubs, ale and cask-led locals, wine
            bars and pub restaurants — and what a browser-based card does about
            each.
          </p>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {painPoints.map((point, index) => (
            <li key={point.title} className="surface-card p-5">
              <p className="mono-meta tracking-[0.1em] text-primary">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-lg leading-snug font-extrabold text-balance">
                {point.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <PubCounterFlow />

      {/* Real proof (Counter-Loyalty Index) */}
      <NabaperksProof />

      {/* Browser card vs the alternatives */}
      <ComparisonTable />

      {/* Ungated value-first tool */}
      <RegularsCalculator />

      {/* Pub guide spokes */}
      <Section id="pub-guides">
        <div className="max-w-[44ch]">
          <MonoTag tone="plain">Pub loyalty guides</MonoTag>
          <h2 className="mt-4 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
            Go deeper on pub loyalty.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
            Three short, practical reads for landlords and pub operators.
          </p>
        </div>

        <ul className="mt-6 grid gap-4 lg:grid-cols-3">
          {GUIDES.map((guide) => (
            <li key={guide.href}>
              <Link
                href={guide.href}
                className="group surface-card flex h-full flex-col p-5 transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
              >
                <h3 className="text-lg leading-snug font-extrabold text-balance">
                  {guide.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {guide.summary}
                </p>
                <span className="mono-meta mt-4 inline-flex items-center gap-1 text-primary">
                  {CTA.guideLink}
                  <Icon
                    icon={ArrowRight01Icon}
                    size={14}
                    strokeWidth={2.5}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <FinalCta />
      <JsonLd id="ld-pub-hub" data={hubGraph} />
    </MarketingLayout>
  )
}
