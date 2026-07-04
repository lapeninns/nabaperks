import type { Metadata } from "next"
import Link from "next/link"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import {
  ComparisonTable,
  CounterFlow,
  FinalCta,
  NabaperksProof,
  RegularsCalculator,
  counterFlowSteps,
} from "@/components/marketing/landing"
import { Button } from "@/components/ui/button"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { JsonLd } from "@/components/seo/json-ld"
import { CTA, PRODUCT, ROUTES } from "@/lib/marketing/facts"
import {
  absoluteUrl,
  counterLoyaltyIndexDataset,
  howToSchema,
  marketingPageGraph,
  OG_IMAGE,
} from "@/lib/seo/structured-data"

const title = "Loyalty for Cafes & Coffee Shops — No-App QR Stamp Cards"
const description =
  "Turn the daily coffee habit into counter-verified stamps. Customers scan one till QR and save a browser-based loyalty card — no app, no wallet pass, no queue at the till. No POS or EPOS integration required. £29/month, 30-day free pilot."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.cafeHub },
  keywords: [
    "cafe loyalty card app UK",
    "coffee shop loyalty card without an app",
    "digital stamp card for cafes",
    "QR loyalty card for coffee shops",
    "cafe loyalty scheme no POS",
    "coffee stamp card on phone",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.cafeHub,
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

/** The counter frictions the spoke answers — product-led wording only (the
 * broad "cafes" noun is the approved vertical language for this page). */
const painPoints = [
  {
    title: "No app at the counter",
    body: "Nobody downloads an app while their coffee is being made. The card opens in the phone browser from your till QR and saves in one tap — no app store, no wallet pass, no password.",
  },
  {
    title: "A queue that keeps moving",
    body: "Scanning takes a second and the phone never crosses the counter. Customers stamp on their own phones while your team makes the drinks.",
  },
  {
    title: "Paper cards lost and gamed",
    body: "Paper stamp cards get lost, washed and over-stamped. A browser-based card lives on the customer's phone and every stamp is counter-verified against your venue QR.",
  },
  {
    title: "Nothing new on the till",
    body: "One printed QR by the till is the whole setup. No extra hardware, no POS or EPOS integration, nothing for staff to key in.",
  },
  {
    title: "Daily habits, rewarded",
    body: "A visible stamp card gives the regular visit a finish line: reach the threshold, unlock the reward, redeem it in-store. One stamp per customer per UK date keeps it fair.",
  },
]

const benefits = [
  "One permanent QR by the till — the whole setup",
  "Counter-verified stamps that can't be faked or double-claimed",
  "A weekly digest of visits, regulars and redemptions",
  "Loyalty kept separate from marketing — customers opt in only if they choose",
  PRODUCT.posLine,
]

const spokeGraph = marketingPageGraph({
  page: {
    path: ROUTES.cafeHub,
    name: `${title} | Nabaperks`,
    description,
  },
  breadcrumbs: [
    { name: "Home", path: ROUTES.home },
    { name: CTA.cafe, path: ROUTES.cafeHub },
  ],
  extraNodes: [
    howToSchema(counterFlowSteps, {
      id: `${absoluteUrl(ROUTES.cafeHub)}#howto`,
    }),
    counterLoyaltyIndexDataset(),
  ],
})

export default function LoyaltyForCafesPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <Section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:py-14">
        <div className="flex flex-col gap-5">
          <MonoTag tone="accent">{CTA.cafe}</MonoTag>
          <h1 className="text-[clamp(2rem,6vw,4rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
            Loyalty for cafes and coffee shops.
          </h1>
          <p className="max-w-[46ch] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Turn the daily-habit visit into a stamp. {PRODUCT.cardLine} The
            card opens before the coffee cools — no app, no queue at the till —
            and every stamp is{" "}
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
          <Eyebrow>For a cafe, that means</Eyebrow>
          <ul className="mt-4 grid gap-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <Icon
                  icon={Tick02Icon}
                  size={18}
                  strokeWidth={2.5}
                  className="mt-0.5 shrink-0 text-reward"
                />
                <span className="text-[0.95rem] leading-snug font-bold text-pretty">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Cafe counter frictions */}
      <Section id="fit">
        <div className="max-w-[46ch]">
          <MonoTag tone="leaf">Built for the counter</MonoTag>
          <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
            Made for how a busy counter actually runs.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
            The card is built around the till: quick to open, quick to stamp,
            nothing to install and nothing new for staff to run. Five counter
            frictions, and what a browser-based card does about each.
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

      {/* The four beats (generic flow — anchor #how-it-works) */}
      <CounterFlow />

      {/* Real proof (Counter-Loyalty Index) */}
      <NabaperksProof />

      {/* Browser card vs the alternatives */}
      <ComparisonTable />

      {/* Ungated value-first tool */}
      <RegularsCalculator />

      {/* Mechanism cross-link (replaces the pub hub's guides rail) */}
      <Section width="narrow" className="text-center">
        <MonoTag tone="plain">The mechanism</MonoTag>
        <h2 className="mx-auto mt-4 max-w-[24ch] text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
          How counter-verified stamps work.
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-base leading-relaxed text-pretty text-muted-foreground">
          The four beats above are the short version. The full mechanism — the
          five anti-fraud checks and how the card compares to paper, apps and
          wallet passes — lives on one page.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild size="lg" variant="outline">
            <Link href={ROUTES.howItWorks}>See how it works</Link>
          </Button>
        </div>
      </Section>

      <FinalCta />
      <JsonLd id="ld-cafe-hub" data={spokeGraph} />
    </MarketingLayout>
  )
}
