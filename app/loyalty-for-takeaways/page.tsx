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

const title = "Takeaway Loyalty — QR Stamp Cards on Any Till"
const description =
  "A loyalty card that works on any till, even cash-only: scan the counter QR, collect counter-verified stamps — no app, no POS. £29/month, 30-day free pilot."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: ROUTES.takeawayHub },
  keywords: [
    "takeaway loyalty card",
    "loyalty card for cash-only till",
    "digital stamp card for takeaways",
    "QR loyalty card no POS",
    "takeaway loyalty scheme UK",
    "loyalty card without an app",
  ],
  openGraph: {
    title: `${title} | Nabaperks`,
    description,
    type: "website",
    siteName: "Nabaperks",
    url: ROUTES.takeawayHub,
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
 * broad "takeaways" noun is the approved vertical language for this page). */
const painPoints = [
  {
    title: "Works with a cash-only till",
    body: "No card machine integration and no POS. The loyalty card runs entirely on the customer's phone browser from one printed QR — if your counter takes cash, it takes stamps.",
  },
  {
    title: "Stamps while they wait for the order",
    body: "The wait between paying and collection is when phones are already out. Customers scan the counter QR and stamp on their own phone — done before their order is called, no staff step at the till.",
  },
  {
    title: "Nothing for staff to type",
    body: "No phone numbers collected at the till and no codes to key in. The counter-verified stamp checks your venue QR, the saved card and the one-stamp-per-UK-date rule on its own.",
  },
  {
    title: "Paper doesn't survive a takeaway counter",
    body: "Heat, steam and pockets finish off paper stamp cards. The browser card lives on the customer's phone, and one stamp per customer per UK date means it can't be over-stamped.",
  },
  {
    title: "The Friday-night order, made visible",
    body: "The customer who orders every week is easy to miss at a busy counter. The weekly digest shows who is coming back — visits, regulars and redemptions — without a CRM to run.",
  },
]

const benefits = [
  "Works on any till — cash-only included",
  "Counter-verified stamps checked at the counter, never from a screenshot",
  "No staff step — customers stamp while they wait for their order",
  "A weekly digest showing who comes back — no CRM to run",
  PRODUCT.posLine,
]

const spokeGraph = marketingPageGraph({
  page: {
    path: ROUTES.takeawayHub,
    name: `${title} | Nabaperks`,
    description,
  },
  breadcrumbs: [
    { name: "Home", path: ROUTES.home },
    { name: CTA.takeaway, path: ROUTES.takeawayHub },
  ],
  extraNodes: [
    howToSchema(counterFlowSteps, {
      id: `${absoluteUrl(ROUTES.takeawayHub)}#howto`,
    }),
    counterLoyaltyIndexDataset(),
  ],
})

export default function LoyaltyForTakeawaysPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <Section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:py-14">
        <div className="flex flex-col gap-5">
          <MonoTag tone="accent">{CTA.takeaway}</MonoTag>
          <h1 className="text-[clamp(2rem,6vw,4rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
            Loyalty for takeaways.
          </h1>
          <p className="max-w-[46ch] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Works on any till, even cash-only. {PRODUCT.cardLine} No POS to
            buy, no number to type — just the QR by the counter, and every
            stamp is{" "}
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
          <Eyebrow>For a takeaway, that means</Eyebrow>
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

      {/* Takeaway counter frictions */}
      <Section>
        <div className="max-w-[46ch]">
          <MonoTag tone="leaf">Built for the counter</MonoTag>
          <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
            Made for a counter with no POS at all.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
            The card asks nothing of your till: no integration, no hardware,
            no numbers typed at the counter. Five counter frictions, and what
            a browser-based card does about each.
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
          from your counter QR and saves in one tap —{" "}
          quick enough for the collection wait.
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
      <JsonLd id="ld-takeaway-hub" data={spokeGraph} />
    </MarketingLayout>
  )
}
