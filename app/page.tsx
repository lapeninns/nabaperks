import type { Metadata } from "next"
import Link from "next/link"
import {
  Alert02Icon,
  Building02Icon,
  CheckmarkBadge04Icon,
  CheckmarkCircle02Icon,
  GiftIcon,
  Home01Icon,
  InformationCircleIcon,
  MapPinIcon,
  QrCode01Icon,
  ScanIcon,
  SecurityCheckIcon,
  Shield01Icon,
  Store01Icon,
  UserAdd01Icon,
  UserCircleIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import {
  Eyebrow,
  Icon,
  PageTitle,
  ReceiptCard,
  SectionHeader,
  VenueMark,
} from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { QrFrame, RewardSeal, StampGrid } from "@/components/loyalty"
import { VenueRollCall } from "@/components/marketing"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Nabaperks · No-app loyalty for food and drink venues",
  description:
    "Replace paper loyalty cards with one venue QR. Customers scan, save a browser card, and collect one honest stamp per day. A 30-day free pilot, then £29/month per venue.",
}

// A decorative QR matrix for the demo cards — a static pattern, not a scannable
// code. Real join/reward QRs are generated per venue in the print kit.
const qrCells = [
  1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0,
  1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1,
]

const proofStats = [
  { value: "<5 min", label: "to set the venue up" },
  { value: "<10 sec", label: "from scan to stamp" },
  { value: "30 days", label: "free, no card" },
]

const painPoints = [
  "Paper cards disappear into pockets and wallets.",
  "App downloads slow the queue at the till, counter, or bar.",
  "Staff handling customer phones creates trust and hygiene friction.",
  "Generic points tools feel too heavy for a single food or drink venue.",
  "Reward promises drift when staff track them on informal paper.",
]

const solutionMechanics = [
  {
    icon: QrCode01Icon,
    title: "Permanent venue QR",
    copy: "One printed code routes new customers to join and regulars to stamp.",
  },
  {
    icon: UserCircleIcon,
    title: "Customers keep their phone",
    copy: "They scan, join, and stamp on their own device, start to finish.",
  },
  {
    icon: SecurityCheckIcon,
    title: "Phone verification saves the card",
    copy: "One text confirms the number and keeps the card on the phone.",
  },
  {
    icon: CheckmarkBadge04Icon,
    title: "One stamp per UK business day",
    copy: "The database enforces it, so the till stays honest.",
  },
  {
    icon: GiftIcon,
    title: "Reward snapshotted when earned",
    copy: "The prize is fixed the moment it unlocks, even if the pool changes later.",
  },
  {
    icon: ScanIcon,
    title: "Merchant scans to collect",
    copy: "The reward QR is scanned once at the counter to redeem it.",
  },
]

const steps = [
  {
    n: "01",
    title: "Scan",
    icon: QrCode01Icon,
    copy: "Customer points their camera at the venue QR.",
  },
  {
    n: "02",
    title: "Join",
    icon: UserAdd01Icon,
    copy: "One text confirms the number and saves the card.",
  },
  {
    n: "03",
    title: "Stamp",
    icon: CheckmarkBadge04Icon,
    copy: "Customer taps to add today's stamp. One per UK business day.",
  },
  {
    n: "04",
    title: "Reward",
    icon: GiftIcon,
    copy: "On the target visit, a mystery reward unlocks for merchant-scanned collection.",
  },
]

const benefits = [
  {
    icon: QrCode01Icon,
    title: "No app, no plastic",
    copy: "Every card opens from the venue QR and stays usable in the browser.",
  },
  {
    icon: UserCircleIcon,
    title: "The phone never crosses the counter",
    copy: "Customers scan, join, and stamp on their own device.",
  },
  {
    icon: CheckmarkBadge04Icon,
    title: "One stamp a day, honest",
    copy: "The database enforces one stamp per customer per UK business day.",
  },
  {
    icon: GiftIcon,
    title: "Mystery rewards bring people back",
    copy: "The reward unlocks at the target visit and is redeemable the next UK business day.",
  },
  {
    icon: Store01Icon,
    title: "Built for food and drink venues",
    copy: "One location, one active card, one price, and no CRM-sized setup.",
  },
]

const setupChecklist = [
  "Loyalty card built",
  "Reward pool set",
  "Venue checks on",
  "QR kit ordered",
]

const trustPoints = [
  {
    icon: CheckmarkBadge04Icon,
    title: "Every stamp is on the record",
    copy: "Each loyalty action is an attributable, server-side event.",
  },
  {
    icon: Shield01Icon,
    title: "Scoped to your venue",
    copy: "Row-level security keeps one venue's data separated from another's.",
  },
  {
    icon: SecurityCheckIcon,
    title: "Private by default",
    copy: "Phone numbers are stored hashed and shown masked by default.",
  },
  {
    icon: InformationCircleIcon,
    title: "Marketing is separate",
    copy: "Customers can collect stamps without opting into marketing.",
  },
  {
    icon: GiftIcon,
    title: "Rewards stay consistent",
    copy: "An earned reward keeps its snapshot even if the pool changes later.",
  },
]

const useCases = [
  {
    icon: Store01Icon,
    title: "Cafes and coffee shops",
    copy: "Keep the coffee-card habit without the paper card.",
  },
  {
    icon: Building02Icon,
    title: "Takeaways",
    copy: "Bring regulars back for the next lunch, curry, pizza, or chippy tea.",
  },
  {
    icon: GiftIcon,
    title: "Dessert and bubble tea",
    copy: "Make repeat visits feel playful with sealed rewards.",
  },
  {
    icon: UserMultiple02Icon,
    title: "Casual restaurants",
    copy: "Reward repeat diners without an app download or POS integration.",
  },
  {
    icon: Home01Icon,
    title: "Food-led pubs",
    copy: "Keep locals returning for lunch, quiz nights, or Sunday roasts.",
  },
  {
    icon: MapPinIcon,
    title: "Single-location independents",
    copy: "Start with one venue, one QR, and one monthly price.",
  },
]

const pricingIncludes = [
  "Unlimited stamps and members",
  "Mystery reward pool",
  "Printed QR kit: poster, till card, sticker",
  "Optional soft location checks",
  "Weekly digest of visits and redemptions",
  "Stripe billing and customer portal",
]

const faqs = [
  {
    q: "Do my customers need an app?",
    a: "No. The card opens in any phone browser from your venue QR. There is nothing to download.",
  },
  {
    q: "Do I need extra hardware?",
    a: "No. Customers use their own phones and your printed QR kit.",
  },
  {
    q: "How is a stamp kept honest?",
    a: "Postgres allows one stamp per customer per UK business day, and every stamp is recorded as a server-side event.",
  },
  {
    q: "What if someone's location says they are not here?",
    a: "The stamp still goes through. Optional location checks write review signals without blocking good customers.",
  },
  {
    q: "Who owns the customer data?",
    a: "Customer data is scoped to your venue. Phone numbers are stored hashed and shown masked by default.",
  },
  {
    q: "Can customers collect stamps without marketing consent?",
    a: "Yes. Loyalty participation and marketing opt-in are separate.",
  },
  {
    q: "What happens when a reward is ready?",
    a: "The customer shows a reward QR. The merchant scans it once, the reward is collected, and the next card cycle opens.",
  },
  {
    q: "What does it cost?",
    a: "The pilot is free for 30 days. After that it is £29/month per venue.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, with one month's notice from the billing page. Earned rewards stay redeemable while the account winds down.",
  },
]

function DemoQr({ size = "w-16" }: { size?: string }) {
  return (
    <div
      className={`grid aspect-square ${size} grid-cols-10 gap-[2px] rounded-sm bg-white p-1`}
    >
      {qrCells.map((cell, index) => (
        <span
          key={index}
          className={cell ? "rounded-[1px] bg-qr" : "bg-transparent"}
        />
      ))}
    </div>
  )
}

export default function Page() {
  return (
    <MarketingLayout>
      {/* 2 · Hero — promise in five seconds, one real product object */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.82fr)] lg:gap-16 lg:py-20">
        <div className="grid gap-7">
          <PageTitle
            eyebrow="No-app loyalty for food and drink venues"
            title="Replace paper loyalty cards with one venue QR."
            description="Customers scan, save a browser card, and collect one honest stamp per day."
            titleClassName="max-w-[18ch] text-[clamp(2.3rem,5vw,3.4rem)] leading-[1.02] tracking-[-0.025em]"
            descriptionClassName="max-w-[42ch] text-base leading-7 sm:text-lg"
            className="md:grid-cols-1"
          />
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start a merchant trial</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            {/* Quiet customer entry — kept out of the main nav, per the blueprint */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-[0.7rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Got a card already?
              </span>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="ghost">
                  <Link href="/home">Open my cards</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/scan">Scan a venue QR</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <WetInkRise
          className="justify-self-center lg:justify-self-end"
          delay={0.08}
        >
          <div className="-rotate-2">
            <ReceiptCard edge className="w-[min(22rem,84vw)] gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1.5">
                  <Eyebrow>The Old Crown</Eyebrow>
                  <p className="text-2xl leading-tight font-extrabold">
                    Free hot drink after 3 visits
                  </p>
                </div>
                <VenueMark size={52} initials="OC" />
              </div>
              <StampGrid current={2} total={3} venueName="The Old Crown" />
              <hr className="w-rule" />
              <div className="flex items-center gap-4">
                <QrFrame label="Demo QR code for joining a no-app loyalty card">
                  <DemoQr />
                </QrFrame>
                <div className="grid gap-2">
                  <Eyebrow>Scan to join</Eyebrow>
                  <div className="flex items-center gap-2.5">
                    <RewardSeal state="sealed" size="sm" />
                    <p className="text-sm leading-5 font-bold">
                      A sealed mystery reward waits at visit three.
                    </p>
                  </div>
                </div>
              </div>
            </ReceiptCard>
          </div>
        </WetInkRise>
      </section>

      {/* 3 · Proof strip — a thin dashed band, not a card grid */}
      <section className="border-y-2 border-dashed border-border">
        <div className="mx-auto grid w-full max-w-5xl gap-px px-6 py-9 sm:grid-cols-3 sm:gap-0 sm:divide-x-2 sm:divide-dashed sm:divide-border">
          {proofStats.map((stat) => (
            <div
              key={stat.label}
              className="grid justify-items-center gap-1 py-1.5 text-center sm:px-6"
            >
              <span className="text-4xl leading-none font-extrabold tracking-[-0.02em] sm:text-5xl">
                {stat.value}
              </span>
              <span className="font-mono text-[0.7rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · Problem — the pain a food and drink venue already feels */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,30rem)_auto] lg:items-center lg:gap-14">
          <div className="grid gap-5">
            <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
              Paper cards get lost. Apps get deleted.
            </h2>
            <p className="max-w-[44ch] text-base leading-7 text-muted-foreground sm:text-lg">
              Your regulars want the reward, not another download. Staff need a
              loyalty flow that works at the counter, bar, or till without
              taking anyone&rsquo;s phone.
            </p>
            <ul className="mt-1 grid gap-2.5">
              {painPoints.map((point) => (
                <li
                  key={point}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
                >
                  <Icon
                    icon={Alert02Icon}
                    size={18}
                    strokeWidth={2.25}
                    className="mt-0.5 text-primary"
                  />
                  <span className="text-sm leading-6 text-muted-foreground">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="justify-self-center opacity-90 grayscale">
            <div className="rotate-3">
              <ReceiptCard className="w-60 gap-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <Eyebrow>A card you lost</Eyebrow>
                  <VenueMark size={34} initials="??" />
                </div>
                <StampGrid current={0} total={6} venueName="Misplaced" />
                <span className="font-mono text-[0.6rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  Last seen: a coat pocket
                </span>
              </ReceiptCard>
            </div>
          </div>
        </div>
      </section>

      {/* 5 · Solution — the better way, with the real proof mechanics */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,34ch)_minmax(0,1fr)] lg:gap-16">
          <div className="grid content-start gap-4">
            <Eyebrow>The Nabaperks way</Eyebrow>
            <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
              One QR at the counter. One card in the browser.
            </h2>
            <p className="max-w-[44ch] text-base leading-7 text-muted-foreground sm:text-lg">
              With Nabaperks, a food or drink venue can launch a customer-owned,
              browser-based loyalty card from a permanent QR, keep every stamp
              server-side, and reveal a mystery reward on the target visit.
            </p>
          </div>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {solutionMechanics.map((m) => (
              <li
                key={m.title}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3.5"
              >
                <span className="grid size-9 -rotate-6 place-items-center rounded-full border-2 border-ink bg-card text-primary shadow-xs">
                  <Icon icon={m.icon} size={18} strokeWidth={2.25} />
                </span>
                <div className="grid gap-0.5">
                  <span className="leading-tight font-extrabold">
                    {m.title}
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">
                    {m.copy}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6 · How it works — the steps look like stamps filling a card */}
      <section
        id="how-it-works"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-14 lg:py-20"
      >
        <SectionHeader
          className="mb-10 max-w-[34ch]"
          title={
            <span className="block text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] tracking-[-0.02em]">
              Four taps from stranger to regular.
            </span>
          }
          description="The customer keeps their own phone the whole time. Your team never needs to touch it."
        />
        <ol className="relative grid gap-x-8 gap-y-5 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-4 lg:gap-y-10">
          <div
            aria-hidden="true"
            className="absolute top-7 right-8 left-8 hidden border-t-2 border-dashed border-border lg:block"
          />
          {steps.map((step) => {
            const active = step.n === "03"
            return (
              <li
                key={step.n}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 lg:grid-cols-1 lg:items-start lg:gap-3"
              >
                <span
                  className={
                    active
                      ? "grid size-12 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-primary-foreground shadow-sm motion-safe:animate-pulse motion-reduce:animate-none lg:size-14"
                      : "grid size-12 -rotate-6 place-items-center rounded-full border-2 border-ink bg-card text-ink shadow-sm lg:size-14"
                  }
                >
                  <Icon icon={step.icon} size={22} strokeWidth={2.25} />
                </span>
                <div className="grid gap-1">
                  <span className="font-mono text-[0.7rem] font-bold tracking-[0.12em] text-muted-foreground">
                    {step.n} · {step.title.toUpperCase()}
                  </span>
                  <p className="max-w-[40ch] text-sm leading-6 text-muted-foreground lg:max-w-[24ch]">
                    {step.copy}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* 7 · Core benefits — product features as operator outcomes */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <SectionHeader
          className="mb-10 max-w-[30ch]"
          title={
            <span className="block text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] tracking-[-0.02em]">
              Everything the counter needs, nothing it doesn&rsquo;t.
            </span>
          }
          description="Five things a food and drink venue actually gets."
        />
        <div className="grid gap-x-10 gap-y-8 border-t-2 border-dashed border-border pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="grid content-start gap-2.5">
              <Icon
                icon={benefit.icon}
                size={24}
                strokeWidth={2.25}
                className="text-primary"
              />
              <h3 className="text-lg font-extrabold">{benefit.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {benefit.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 8 · Product preview — three real product states, no fake dashboard */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <SectionHeader
          className="mb-10 max-w-[34ch]"
          title={
            <span className="block text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] tracking-[-0.02em]">
              See it working at your counter.
            </span>
          }
          description="The same card, from setup to the reward your regular comes back for."
        />
        <div className="grid gap-6 sm:gap-7 lg:grid-cols-3">
          <WetInkRise>
            <ReceiptCard className="grid h-full gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Merchant setup</Eyebrow>
                <Icon icon={Store01Icon} size={22} className="text-primary" />
              </div>
              <p className="text-sm leading-5 font-bold">
                Card, rewards, venue checks, QR kit.
              </p>
              <ul className="grid gap-2">
                {setupChecklist.map((line) => (
                  <li key={line} className="flex items-center gap-2.5">
                    <Icon
                      icon={CheckmarkCircle02Icon}
                      size={16}
                      className="shrink-0 text-primary"
                    />
                    <span className="text-sm leading-5">{line}</span>
                  </li>
                ))}
              </ul>
            </ReceiptCard>
          </WetInkRise>

          <WetInkRise delay={0.06}>
            <ReceiptCard edge className="grid h-full gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Customer card</Eyebrow>
                <VenueMark size={34} initials="OC" />
              </div>
              <StampGrid current={2} total={3} venueName="The Old Crown" />
              <div className="flex items-center gap-3">
                <RewardSeal state="sealed" size="sm" />
                <span className="text-sm leading-5 font-bold">
                  Today&rsquo;s stamp is in. One more to the seal.
                </span>
              </div>
            </ReceiptCard>
          </WetInkRise>

          <WetInkRise delay={0.12}>
            <ReceiptCard className="grid h-full gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>Reward collection</Eyebrow>
                <Icon icon={ScanIcon} size={22} className="text-primary" />
              </div>
              <div className="flex items-center gap-4">
                <QrFrame label="Reward QR shown by the customer for the merchant to scan">
                  <DemoQr />
                </QrFrame>
                <div className="grid gap-2">
                  <RewardSeal state="ready" size="sm" />
                  <span className="text-sm leading-5 font-bold">
                    Merchant scans once. The next card cycle opens.
                  </span>
                </div>
              </div>
            </ReceiptCard>
          </WetInkRise>
        </div>
        <p className="mt-6 font-mono text-[0.65rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Printed QR kit: poster, till card, sticker
        </p>
      </section>

      {/* 9 · Trust and privacy */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,28ch)_minmax(0,1fr)] lg:gap-16">
          <div className="grid content-start gap-3.5">
            <Eyebrow>Trust and privacy</Eyebrow>
            <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">
              Stamped, not tracked.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              Loyalty touches money and customer data, so the careful parts are
              built in, not bolted on.
            </p>
            <p className="rounded-lg border-2 border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
              Customer loyalty participation and marketing opt-in stay separate.
              Customers can collect stamps without joining a marketing list.
            </p>
          </div>
          <ul className="grid divide-y-2 divide-dashed divide-border border-y-2 border-dashed border-border">
            {trustPoints.map((item) => (
              <li
                key={item.title}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3.5 py-4"
              >
                <Icon
                  icon={item.icon}
                  size={22}
                  strokeWidth={2.25}
                  className="mt-0.5 text-primary"
                />
                <div className="grid gap-1">
                  <span className="font-extrabold">{item.title}</span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.copy}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 10 · Pilot proof — the real venues already stamping */}
      <section className="border-y-2 border-dashed border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 lg:py-16">
          <VenueRollCall />
        </div>
      </section>

      {/* 11 · Use cases — help the operator self-identify */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <SectionHeader
          className="mb-10 max-w-[30ch]"
          title={
            <span className="block text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] tracking-[-0.02em]">
              Made for food and drink regulars.
            </span>
          }
          description="One QR fits the way independents actually trade."
        />
        <div className="grid gap-x-10 gap-y-8 border-t-2 border-dashed border-border pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <div key={useCase.title} className="grid content-start gap-2.5">
              <Icon
                icon={useCase.icon}
                size={24}
                strokeWidth={2.25}
                className="text-primary"
              />
              <h3 className="text-lg font-extrabold">{useCase.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {useCase.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 12 · Pricing preview */}
      <section
        id="pricing"
        className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-12 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:py-20"
      >
        <div className="grid gap-6">
          <div className="grid max-w-[28ch] gap-3">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">
              30 days free, then £29/month per venue.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              No card to start the pilot. No tiers, no seats, no contact-sales
              flow.
            </p>
          </div>
          <ul className="grid divide-y-2 divide-dashed divide-border border-y-2 border-dashed border-border">
            {pricingIncludes.map((line) => (
              <li key={line} className="flex items-start gap-2.5 py-3">
                <Icon
                  icon={CheckmarkCircle02Icon}
                  size={18}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span className="text-sm leading-5">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <WetInkRise className="-rotate-1 lg:justify-self-end">
          <ReceiptCard edge className="grid gap-5 p-6 sm:p-7">
            <div className="grid gap-2 text-center">
              <Eyebrow>After the 30-day pilot</Eyebrow>
              <p className="text-5xl leading-none font-extrabold tracking-[-0.02em]">
                £29
                <span className="text-base font-bold text-muted-foreground">
                  /month
                </span>
              </p>
              <span className="font-mono text-[0.6rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                One venue · no contracts
              </span>
            </div>
            <div className="grid gap-2">
              <Button asChild size="lg">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/signup">Start a merchant trial</Link>
              </Button>
            </div>
            <span className="text-center font-mono text-[0.6rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              No card to start the pilot
            </span>
          </ReceiptCard>
        </WetInkRise>
      </section>

      {/* 13 · FAQ */}
      <section
        id="faq"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-14 lg:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.66fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <h2 className="max-w-[16ch] text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">
            Questions, answered plainly.
          </h2>
          <div className="grid divide-y-2 divide-dashed divide-border border-y-2 border-dashed border-border">
            {faqs.map((item) => (
              <details key={item.q} className="group">
                <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-extrabold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink text-xl leading-none transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[60ch] pb-5 text-sm leading-6 text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 14 · Final CTA — one clear next step */}
      <section className="border-y-2 border-ink bg-ink text-paper">
        <div className="mx-auto grid w-full max-w-3xl justify-items-center gap-5 px-6 py-16 text-center lg:py-20">
          <h2 className="max-w-[16ch] text-[clamp(2.2rem,5vw,3.6rem)] leading-[0.98] font-extrabold tracking-[-0.025em] text-paper">
            Set up your venue this afternoon.
          </h2>
          <p className="max-w-[48ch] text-base leading-7 text-paper/70">
            Run the pilot free for 30 days, no card to start. Then it is £29 a
            month for one venue.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Start a merchant trial</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
          <p className="text-sm text-paper/70">
            Already running a venue?{" "}
            <Link
              href="/login"
              className="rounded-sm font-bold text-paper underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              Merchant login
            </Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  )
}
