import type { Metadata } from "next"
import Link from "next/link"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { MarketingLayout, Section } from "@/components/layout"
import {
  CounterFlow,
  FinalCta,
  NabaperksProof,
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

const title = "Cafe Loyalty Cards — No-App QR Stamp Cards"
const description =
  "Turn the daily coffee habit into counter-verified stamps. One till QR opens a browser-based card — no app, no wallet pass. £49/month, 30-day free pilot."

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
    title: "No app in the coffee queue",
    body: "Nobody downloads an app while the milk steams. The card opens in the phone browser from your till QR and saves in one tap — done before the flat white is.",
  },
  {
    title: "The morning rush keeps moving",
    body: "Scanning takes a second from the customer's side of the counter, so the queue never bunches. They stamp their own phone while your team pulls the shots.",
  },
  {
    title: "Paper cards die in pockets",
    body: "Punch cards go through the wash, hide in other wallets and turn up over-stamped. The browser card can't be lost between visits, and every stamp is checked against your real till QR before it counts.",
  },
  {
    title: "Nothing new on the till",
    body: "One printed QR by the till is the whole setup. No extra hardware, no POS or EPOS integration, nothing for staff to key in.",
  },
  {
    title: "The daily habit, made visible",
    body: "The same faces order the same drink most days. A stamp card gives that habit a finish line — reach the threshold, unlock the reward, redeem it in-store — one stamp per customer per UK date.",
  },
]

const benefits = [
  "One permanent QR by the till — the whole setup",
  "Counter-verified stamps, each checked against your real till QR",
  "Quick enough for the morning queue — customers stamp their own phones",
  "A weekly digest of visits, regulars and redemptions",
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
      <Section>
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

      {/* Comparison wedge + mechanism cross-link — one band; the full table
          lives on /how-it-works (MS-marketing-audit-v2-fixes AV-3) */}
      <Section width="narrow" className="text-center">
        <MonoTag tone="plain">The mechanism</MonoTag>
        <h2 className="mx-auto mt-4 max-w-[24ch] text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
          How counter-verified stamps work.
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-base leading-relaxed text-pretty text-muted-foreground">
          Most &ldquo;no-app&rdquo; loyalty cards still make customers install
          an Apple or Google Wallet pass. Nabaperks opens in the phone browser
          from your till QR and saves in one tap —{" "}
          quick enough for the morning rush.
        </p>
        <p className="mx-auto mt-3 max-w-[52ch] text-base leading-relaxed text-pretty text-muted-foreground">
          The five anti-fraud checks — and the full side-by-side against paper
          cards, wallet-pass apps and POS loyalty — live on one page.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild size="lg" variant="outline">
            <Link href={`${ROUTES.howItWorks}#no-app`}>
              See the full comparison
            </Link>
          </Button>
        </div>
        <p className="mx-auto mt-4 max-w-[52ch] text-sm leading-relaxed text-pretty text-muted-foreground">
          <Link
            href={`${ROUTES.pubHub}#regulars-calculator`}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Work out the maths for your venue
          </Link>
          {" "}
          with the regulars calculator on the pub loyalty hub.
        </p>
      </Section>

      <FinalCta />
      <JsonLd id="ld-cafe-hub" data={spokeGraph} />
    </MarketingLayout>
  )
}
