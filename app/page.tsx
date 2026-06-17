import Link from "next/link"
import {
  CheckmarkBadge04Icon,
  ClockIcon,
  GiftIcon,
} from "@hugeicons/core-free-icons"

import {
  Eyebrow,
  MetricTile,
  MonoTag,
  PageTitle,
  ReceiptCard,
  SectionHeader,
  VenueMark,
} from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { QrFrame, StampGrid } from "@/components/loyalty"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const qrCells = [
  1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0,
  1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1,
]

const journey = [
  {
    label: "Scan",
    copy: "Customers point a camera at your till card. The card opens in the browser — nothing to install.",
  },
  {
    label: "Join",
    copy: "They save it to their phone with one text. No app to download, no password to forget.",
  },
  {
    label: "Stamp",
    copy: "They scan the venue QR again and tap to add today's stamp. The phone never leaves their hand.",
  },
  {
    label: "Reward",
    copy: "The third visit breaks a wax seal on a mystery reward from your pool. Redeemable the next day.",
  },
]

const beats = [
  {
    n: "01",
    title: "Scan",
    copy: "Camera up at the till card. The stamp card opens in the browser in about two seconds — no app-store detour.",
  },
  {
    n: "02",
    title: "Tap",
    copy: "The customer lands on a stamp-confirm screen and adds one visit for the UK business day.",
  },
  {
    n: "03",
    title: "Check",
    copy: "Optional GPS checks stay soft: in range is quiet, out of range or unavailable is stamped and flagged.",
  },
  {
    n: "04",
    title: "Unseal",
    copy: "On the third visit a wax seal breaks over a mystery reward. Give it a day to breathe, then redeem.",
  },
]

const quotes = [
  {
    quote:
      "Regulars have their code up before they've even ordered. It's the bit of theatre our counter was missing.",
    who: "Maya · Manager",
    venue: "The Old Crown, Bristol",
    initials: "OC",
    tilt: "-rotate-1",
  },
  {
    quote:
      "Set up between the lunch rush and the school run. Nobody has once asked where the app is.",
    who: "Fern · Owner",
    venue: "Fern & Loaf, Bath",
    initials: "FL",
    tilt: "rotate-1",
  },
  {
    quote:
      "The seal is silly and brilliant. People book a third cut just to break the thing open.",
    who: "Marlowe · Barber",
    venue: "Marlowe's, Leeds",
    initials: "ML",
    tilt: "-rotate-1",
  },
]

const features = [
  {
    title: "No app, no plastic",
    copy: "Every loyalty card opens from a QR link and stays usable from the customer's browser.",
  },
  {
    title: "The phone never crosses the counter",
    copy: "Customers scan the printed venue QR and add one audited stamp per UK business day.",
  },
  {
    title: "Mystery rewards",
    copy: "Customers see progress first, then a sealed reward breaks open when the target visit is earned.",
  },
  {
    title: "Set up in an afternoon",
    copy: "Account, venue details, reward pool, then download your printed QR kit — poster, till card, sticker.",
  },
]

const waysIn = [
  {
    href: "/signup",
    title: "Start a merchant trial",
    copy: "Create the account, add your venue, and build the first mystery card.",
  },
  {
    href: "/login",
    title: "Open merchant setup",
    copy: "Continue onboarding, QR downloads, venue checks, and dashboards.",
  },
  {
    href: "/pricing",
    title: "Check pilot pricing",
    copy: "30 days free for pilots, then GBP 29/month per venue.",
  },
]

export default function Page() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-7xl content-center gap-10 px-6 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1fr)] lg:items-center lg:py-16">
        <div className="grid gap-7">
          <PageTitle
            eyebrow="No-app loyalty for UK counters"
            title="Loyalty, stamped before the coffee cools."
            description="A browser-based loyalty card that lives on your customer's phone. They scan your till QR, tap to stamp at the venue, and a mystery reward unseals on the third visit."
            titleClassName="max-w-[15ch] text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.02em]"
            descriptionClassName="max-w-[40ch] text-base leading-7"
            className="md:grid-cols-1"
          />

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Start a merchant trial</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/pricing">View pricing</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Merchant login</Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Setup target" value="<5 min" icon={ClockIcon} />
            <MetricTile
              label="Stamp flow"
              value="<10 sec"
              icon={CheckmarkBadge04Icon}
            />
            <MetricTile
              label="Pilot offer"
              value="30 days free"
              icon={GiftIcon}
            />
          </div>
          <p className="font-mono text-[0.7rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            £29/month after the pilot · one price, one venue
          </p>
        </div>

        {/* Live receipt + join QR demo */}
        <WetInkRise className="grid gap-4" delay={0.08}>
          <div className="-rotate-1">
            <Card className="gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <Eyebrow>The Old Crown · Bristol</Eyebrow>
                  <p className="text-xl leading-tight font-extrabold">
                    Free hot drink after 3 visits
                  </p>
                </div>
                <VenueMark size={54} />
              </div>
              <hr className="w-rule" />
              <StampGrid
                current={2}
                total={3}
                venueName="The Old Crown"
                className="max-w-64"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  Card Nº OC-0248
                </span>
                <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-primary uppercase">
                  1 visit to the seal
                </span>
              </div>
              <div className="receipt-edge -mx-5 -mb-5" />
            </Card>
          </div>

          <div className="rotate-1 justify-self-end">
            <div className="surface-card flex items-center gap-4 p-4">
              <QrFrame label="Demo QR code for joining a no-app loyalty card">
                <div className="grid aspect-square w-24 grid-cols-10 gap-[2px] rounded-md bg-white p-1.5">
                  {qrCells.map((cell, index) => (
                    <span
                      key={index}
                      className={
                        cell ? "rounded-[1px] bg-qr" : "bg-transparent"
                      }
                    />
                  ))}
                </div>
              </QrFrame>
              <div className="grid gap-1">
                <Eyebrow>Scan to join</Eyebrow>
                <p className="max-w-[18ch] text-sm leading-5 font-bold">
                  One scan opens the card. No app store in the way.
                </p>
              </div>
            </div>
          </div>
        </WetInkRise>
      </section>

      {/* Four-stage journey */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {journey.map((stage, index) => {
            const active = index === 2
            return (
              <div
                key={stage.label}
                className="surface-card grid gap-2 p-4 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      active
                        ? "grid size-7 place-items-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground shadow-xs motion-safe:animate-pulse motion-reduce:animate-none"
                        : "grid size-7 place-items-center rounded-full border-2 border-ink bg-accent text-xs font-extrabold text-accent-foreground"
                    }
                  >
                    {index + 1}
                  </span>
                  <span className="font-extrabold">{stage.label}</span>
                </div>
                <p className="text-sm leading-5 text-muted-foreground">
                  {stage.copy}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* The counter moment — dark ink band */}
      <section className="my-10 border-y-2 border-ink bg-ink text-paper">
        <div className="mx-auto w-full max-w-7xl px-6 py-14">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
            <div className="grid max-w-[46ch] gap-3">
              <span className="font-mono text-[0.7rem] font-bold tracking-[0.1em] text-primary uppercase">
                The counter moment
              </span>
              <h2 className="text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.04] font-extrabold text-paper">
                Four beats, under ten seconds.
              </h2>
              <p className="text-[0.95rem] leading-6 text-paper/65">
                The whole product is one small piece of theatre at the till,
                choreographed so the queue never notices — and the customer
                keeps their phone the entire time.
              </p>
            </div>
            <VenueMark
              size={92}
              caption="The Old Crown"
              className="[&_span:last-child]:text-paper/60"
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {beats.map((beat) => (
              <div
                key={beat.n}
                className="border-t-2 border-dashed border-paper/30 pt-4"
              >
                <div className="font-mono text-[0.7rem] font-bold tracking-[0.1em] text-primary">
                  BEAT {beat.n}
                </div>
                <div className="mt-2 text-xl font-extrabold text-paper">
                  {beat.title}
                </div>
                <p className="mt-2 text-[0.85rem] leading-5 text-paper/60">
                  {beat.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-4">
        <div className="mb-7 grid justify-items-center gap-3 text-center">
          <MonoTag tone="plain">From the pilot</MonoTag>
          <h2 className="text-[clamp(1.7rem,3.6vw,2.4rem)] leading-tight font-extrabold">
            Counters that kept it.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {quotes.map((item) => (
            <figure key={item.initials} className={item.tilt}>
              <ReceiptCard className="grid gap-4">
                <blockquote className="text-[1.05rem] leading-6 font-bold text-balance">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <hr className="w-rule" />
                <figcaption className="flex items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <span className="font-mono text-[0.65rem] font-bold tracking-[0.08em] text-foreground uppercase">
                      {item.who}
                    </span>
                    <span className="font-mono text-[0.6rem] tracking-[0.08em] text-muted-foreground uppercase">
                      {item.venue}
                    </span>
                  </div>
                  <VenueMark size={42} initials={item.initials} />
                </figcaption>
              </ReceiptCard>
            </figure>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto w-full max-w-xl px-6 py-12">
        <div className="-rotate-1">
          <Card className="gap-3 p-6 text-center">
            <Eyebrow>After the 30-day pilot</Eyebrow>
            <p className="text-5xl leading-none font-extrabold">
              £29
              <span className="text-lg font-bold text-muted-foreground">
                /month
              </span>
            </p>
            <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              One price · one venue · no contracts
            </span>
            <hr className="w-rule" />
            <p className="text-sm leading-6 text-muted-foreground">
              Unlimited stamps, the mystery pool, and the printed QR kit —
              everything, no tiers.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link href="/pricing">See what&apos;s included</Link>
            </Button>
            <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              No card to start the pilot
            </span>
          </Card>
        </div>
      </section>

      {/* Closing feature grid */}
      <section className="mx-auto grid w-full max-w-7xl gap-6 px-6 pb-16">
        <SectionHeader
          eyebrow="Built for the counter"
          title="Everything a venue needs to understand the product without a demo call."
          description="The homepage keeps the no-app QR proposition, permanent venue QR stamping, pricing route, and login route available from semantic links."
        />
        <div className="grid gap-4 md:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle className="text-lg font-extrabold">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  {feature.copy}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {waysIn.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="pressable surface-card grid gap-2 p-5 shadow-xs transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none hover:border-primary"
            >
              <span className="font-extrabold">{step.title}</span>
              <span className="text-sm leading-6 text-muted-foreground">
                {step.copy}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  )
}
