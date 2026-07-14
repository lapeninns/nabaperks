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
  howToSchema,
  marketingPageGraph,
  OG_IMAGE,
} from "@/lib/seo/structured-data"

const title = "Bar & Wine Bar Loyalty — No-App QR Stamp Cards"
const description =
  "Give regulars a reason to choose your bar again — a browser-based card with venue-linked stamps, nothing lost between rounds. £49/month, 30-day free pilot."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.barHub },
  keywords: [
    "bar loyalty card",
    "wine bar loyalty scheme",
    "loyalty card for bars without an app",
    "digital stamp card for bars",
    "QR loyalty card for bars UK",
    "reward bar regulars",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.barHub,
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

/** The bar-floor frictions the spoke answers — bars and wine bars are approved
 * vertical language, so the copy can speak to the room directly. */
const painPoints = [
  {
    title: "One scan, mid-round",
    body: "Customers scan and claim on their own side of the bar, with no card handed over and no staff entry at the till.",
  },
  {
    title: "No app between rounds",
    body: "Nobody downloads an app at the bar. The card opens in the phone browser from your venue QR and saves in one tap — no app store, no wallet pass, no password.",
  },
  {
    title: "Stamps that survive last orders",
    body: "Each claim is linked to your venue QR and the customer's saved membership, with a one-stamp-per-customer-per-UK-date cap.",
  },
  {
    title: "Regulars you can actually see",
    body: "A bar runs on regulars. The weekly digest shows who is coming back — visits, regulars and redemptions — without a CRM to run.",
  },
  {
    title: "A reason to come back midweek",
    body: "Weeknights need a nudge the weekend doesn't. A visible stamp card gives regulars a running reason to choose your room midweek, with the reward redeemed in-store.",
  },
]

const benefits = [
  "One venue QR for the bar and the tables",
  "Venue-linked claims — one per customer per UK date",
  "Customer self-service with no staff entry at the till",
  "A weekly digest that shows your regulars coming back",
  PRODUCT.posLine,
]

const spokeGraph = marketingPageGraph({
  page: {
    path: ROUTES.barHub,
    name: `${title} | Nabaperks`,
    description,
  },
  breadcrumbs: [
    { name: "Home", path: ROUTES.home },
    { name: CTA.bar, path: ROUTES.barHub },
  ],
  extraNodes: [
    howToSchema(counterFlowSteps, {
      id: `${absoluteUrl(ROUTES.barHub)}#howto`,
    }),
  ],
})

export default function LoyaltyForBarsPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <Section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:py-14">
        <div className="flex flex-col gap-5">
          <MonoTag tone="accent">{CTA.bar}</MonoTag>
          <h1 className="text-[clamp(2rem,6vw,4rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
            Loyalty for bars and wine bars.
          </h1>
          <p className="max-w-[46ch] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Give regulars a reason to choose your bar again. {PRODUCT.cardLine}{" "}
            The card lives on their phone — nothing to lose between rounds —
            and every stamp is{" "}
            <strong className="font-semibold text-foreground">
              venue-linked
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
          <Eyebrow>For a bar, that means</Eyebrow>
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

      {/* Bar-floor frictions */}
      <Section>
        <div className="max-w-[46ch]">
          <MonoTag tone="leaf">Built for the bar</MonoTag>
          <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
            Made for how a bar actually runs.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
            Wine bars and cask-led rooms run on the same thing: regulars who
            keep choosing you. Five bar-floor frictions, and what a
            browser-based card does about each.
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

      {/* Aggregate proof is centrally gated until durable evidence exists. */}
      <NabaperksProof />

      {/* Comparison wedge + mechanism cross-link — one band; the full table
          lives on /how-it-works (marketing audit v2 fixes AV-3) */}
      <Section width="narrow" className="text-center">
        <MonoTag tone="plain">The mechanism</MonoTag>
        <h2 className="mx-auto mt-4 max-w-[24ch] text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
          How venue-linked stamps work.
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-base leading-relaxed text-pretty text-muted-foreground">
          Most &ldquo;no-app&rdquo; loyalty cards still make customers install
          an Apple or Google Wallet pass. Nabaperks opens in the phone browser
          from your venue QR, saves to the customer&apos;s account and needs no
          staff entry at the bar.
        </p>
        <p className="mx-auto mt-3 max-w-[52ch] text-base leading-relaxed text-pretty text-muted-foreground">
          The five claim controls — and the full side-by-side against paper
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
      <JsonLd id="ld-bar-hub" data={spokeGraph} />
    </MarketingLayout>
  )
}
