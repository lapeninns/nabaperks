import Link from "next/link"
import {
  Alert02Icon,
  CheckmarkBadge04Icon,
  CheckmarkCircle02Icon,
  GiftIcon,
  InformationCircleIcon,
  QrCode01Icon,
  UserAdd01Icon,
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
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"

const qrCells = [
  1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0,
  1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1,
]

const stats = [
  { value: "<5 min", label: "to set the venue up" },
  { value: "<10 sec", label: "from scan to stamp" },
  { value: "30 days", label: "free pilot, no card" },
]

const steps = [
  {
    n: "01",
    title: "Scan",
    icon: QrCode01Icon,
    copy: "Camera up at the till card. The card opens in the browser in about two seconds.",
  },
  {
    n: "02",
    title: "Join",
    icon: UserAdd01Icon,
    copy: "One text confirms the number and the card saves to the phone. No password to forget.",
  },
  {
    n: "03",
    title: "Stamp",
    icon: CheckmarkBadge04Icon,
    copy: "Scan again and tap once. Postgres allows a single stamp per UK business day.",
  },
  {
    n: "04",
    title: "Reward",
    icon: GiftIcon,
    copy: "On the third visit a wax seal breaks over a mystery reward, redeemable the next day.",
  },
]

const moreFeatures = [
  {
    icon: CheckmarkBadge04Icon,
    title: "One stamp a day, honest",
    copy: "A single stamp per customer per UK business day, enforced in the database. No double dips at the till.",
  },
  {
    icon: UserAdd01Icon,
    title: "The phone never crosses the counter",
    copy: "Customers scan your printed QR and add their own stamp. Your team never needs the customer's phone.",
  },
  {
    icon: Alert02Icon,
    title: "Soft location checks",
    copy: "An optional check around the venue stays gentle. Out of range is stamped and flagged, never blocked.",
  },
]

const pilotVoices = [
  {
    quote:
      "Regulars have their code up before they've even ordered. It's the bit of theatre our counter was missing.",
    who: "Maya · Manager",
    venue: "The Old Crown, Bristol",
    initials: "OC",
  },
  {
    quote:
      "Set up between the lunch rush and the school run. Nobody has once asked where the app is.",
    who: "Fern · Owner",
    venue: "Fern & Loaf, Bath",
    initials: "FL",
  },
  {
    quote:
      "The seal is silly and brilliant. People book a third cut just to break the thing open.",
    who: "Marlowe · Barber",
    venue: "Marlowe's, Leeds",
    initials: "ML",
  },
]

const trust = [
  {
    icon: CheckmarkBadge04Icon,
    title: "Every stamp is on the record",
    copy: "Each stamp is an attributable, server-side event in the ledger, so a card is always recoverable.",
  },
  {
    icon: CheckmarkCircle02Icon,
    title: "Scoped to your venue",
    copy: "Row-level security checks every read at the database, so one venue never sees another's customers.",
  },
  {
    icon: InformationCircleIcon,
    title: "Private by default",
    copy: "Phone numbers are stored hashed and shown masked. Consent is logged to UK GDPR, nothing is sold on.",
  },
]

const pricingIncludes = [
  "Unlimited stamps and members",
  "The mystery reward pool, your prizes",
  "Printed QR kit: poster, till card, sticker",
  "Optional soft location checks",
  "Weekly digest of visits and redemptions",
]

const faqs = [
  {
    q: "Do my customers need an app?",
    a: "No. The card opens in any phone browser straight from your venue QR. There is nothing to download and no account to log in to.",
  },
  {
    q: "What if someone's location says they're not here?",
    a: "The stamp still goes through. The optional location check is soft: out of range or unavailable is stamped and flagged for you to review, never blocked.",
  },
  {
    q: "How is a stamp kept honest?",
    a: "Postgres allows one stamp per customer per UK business day, and every stamp is recorded as a server-side event you can audit.",
  },
  {
    q: "Is my customer data safe?",
    a: "Phone numbers are stored hashed and shown masked on your dashboard. Row-level security scopes every read to your venue, and consent is logged to UK GDPR.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, with one month's notice from the billing page. Rewards your regulars have already earned stay redeemable while the account winds down.",
  },
]

export default function Page() {
  return (
    <MarketingLayout>
      {/* Hero — one message, one object */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.8fr)] lg:gap-16 lg:py-20">
        <div className="grid gap-7">
          <PageTitle
            eyebrow="No-app loyalty for UK counters"
            title="Loyalty, stamped before the coffee cools."
            description="A browser-based loyalty card. Customers scan, tap to stamp, and unseal a mystery reward on visit three."
            titleClassName="max-w-[20ch] text-[clamp(2.4rem,5vw,3.4rem)] leading-[1.0] tracking-[-0.025em]"
            descriptionClassName="max-w-[44ch] text-base leading-7 sm:text-lg"
            className="md:grid-cols-1"
          />
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start a merchant trial</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
            {/* Quiet customer entry, so a regular landing here can reach their
                own card or a fresh scan without going through the merchant trial. */}
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

        {/* The one hero object: a real loyalty card with its join QR */}
        <WetInkRise
          className="justify-self-center lg:justify-self-end"
          delay={0.08}
        >
          <div className="-rotate-2">
            <ReceiptCard edge className="w-[min(22rem,84vw)] gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1.5">
                  <Eyebrow>The Old Crown · Bristol</Eyebrow>
                  <p className="text-2xl leading-tight font-extrabold">
                    Free hot drink after 3 visits
                  </p>
                </div>
                <VenueMark size={52} />
              </div>
              <StampGrid current={2} total={3} venueName="The Old Crown" />
              <hr className="w-rule" />
              <div className="flex items-center gap-4">
                <QrFrame label="Demo QR code for joining a no-app loyalty card">
                  <div className="grid aspect-square w-16 grid-cols-10 gap-[2px] rounded-sm bg-white p-1">
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
                  <p className="text-sm leading-5 font-bold">
                    One scan opens the card. No app store in the way.
                  </p>
                </div>
              </div>
            </ReceiptCard>
          </div>
        </WetInkRise>
      </section>

      {/* Proof — three numbers, no boxes */}
      <section className="border-y-2 border-dashed border-border">
        <div className="mx-auto grid w-full max-w-5xl gap-px px-6 py-9 sm:grid-cols-3 sm:gap-0 sm:divide-x-2 sm:divide-dashed sm:divide-border">
          {stats.map((stat) => (
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

      {/* Problem — a big claim and a quiet, abandoned card */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_auto] lg:items-center lg:justify-start lg:gap-14">
          <div className="grid gap-5">
            <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
              Paper cards get lost. Apps get deleted.
            </h2>
            <p className="max-w-[42ch] text-base leading-7 text-muted-foreground sm:text-lg">
              So we took the card off the keyring and put it where the phone
              already is: in the browser, behind one scan.
            </p>
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

      {/* How it works — the steps look like stamps filling a card */}
      <section
        id="how-it-works"
        className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20"
      >
        <SectionHeader
          className="mb-10 max-w-[34ch]"
          title={
            <span className="block text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] tracking-[-0.02em]">
              Four taps from a stranger to a regular.
            </span>
          }
          description="The customer keeps their own phone the whole time. Your team never needs to touch it."
        />
        <ol className="relative grid gap-x-8 gap-y-5 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-4 lg:gap-y-10">
          {/* The dashed line the stamps sit on, like a loyalty card row */}
          <div
            aria-hidden="true"
            className="absolute top-7 right-8 left-8 hidden border-t-2 border-dashed border-border lg:block"
          />
          {steps.map((step) => {
            // The stamp is the product's core verb, so it carries a soft live pulse.
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
                  <p className="max-w-[40ch] text-sm leading-6 text-muted-foreground lg:max-w-[26ch]">
                    {step.copy}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Features — two split rows and a quiet trio, tightly spaced */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <h2 className="mb-10 max-w-[18ch] text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">
          Everything the counter needs, nothing it doesn’t.
        </h2>

        <div className="grid gap-12">
          {/* No app — text and a clean QR */}
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div className="grid max-w-[40ch] gap-3">
              <h3 className="text-2xl font-extrabold tracking-[-0.01em]">
                No app, no plastic
              </h3>
              <p className="text-base leading-7 text-muted-foreground">
                Every card opens from your venue QR and stays usable in the
                customer’s browser. Nothing to install, nothing to lose, nothing
                between them and their next stamp.
              </p>
            </div>
            <div className="flex items-center gap-5 justify-self-center lg:justify-self-start">
              <QrFrame label="A loyalty card opening from a venue QR">
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
              <p className="max-w-[16ch] text-sm leading-5 font-bold">
                Scan, and the card is on the phone. That is the whole download.
              </p>
            </div>
          </div>

          {/* Mystery rewards — the seal leads */}
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div className="flex items-center gap-6 justify-self-center lg:order-1 lg:justify-self-start">
              <RewardSeal state="sealed" size="lg" wiggle />
              <div className="grid gap-1">
                <span className="font-mono text-[0.65rem] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                  Visit 3 of 3
                </span>
                <span className="text-sm leading-5 font-bold">
                  The seal breaks here.
                </span>
              </div>
            </div>
            <div className="grid max-w-[40ch] gap-3 lg:order-2">
              <h3 className="text-2xl font-extrabold tracking-[-0.01em]">
                Mystery rewards
              </h3>
              <p className="text-base leading-7 text-muted-foreground">
                Customers watch the stamps fill, then a sealed reward from your
                pool breaks open on the target visit. The reward rests a day, so
                the next visit always has a reason.
              </p>
            </div>
          </div>
        </div>

        {/* The quiet trio — grouped by a hairline, not boxes */}
        <div className="mt-12 grid gap-x-10 gap-y-8 border-t-2 border-dashed border-border pt-10 sm:grid-cols-3">
          {moreFeatures.map((feature) => (
            <div key={feature.title} className="grid content-start gap-2.5">
              <Icon
                icon={feature.icon}
                size={24}
                strokeWidth={2.25}
                className="text-primary"
              />
              <h3 className="text-lg font-extrabold">{feature.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {feature.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pilot voices — three notes, light and spaced */}
      <section className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20">
        <div className="mb-10 grid justify-items-center gap-2 text-center">
          <Eyebrow>From the pilot</Eyebrow>
          <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">
            Counters that kept it.
          </h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
          {pilotVoices.map((item) => (
            <figure key={item.initials} className="grid gap-4">
              <blockquote className="text-base leading-6 font-bold text-balance">
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
                <VenueMark size={38} initials={item.initials} />
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Trust + Pricing — paired so the proof sits next to the price */}
      <section
        id="pricing"
        className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:py-20"
      >
        <div className="grid gap-6">
          <div className="grid max-w-[24ch] gap-3">
            <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">
              Stamped, not tracked.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              Loyalty touches money and customer data, so the boring parts are
              built in, not bolted on.
            </p>
          </div>
          <ul className="grid divide-y-2 divide-dashed divide-border border-y-2 border-dashed border-border">
            {trust.map((item) => (
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

        {/* Pricing — the receipt object, landscape so it stays compact */}
        <WetInkRise className="-rotate-1 lg:justify-self-end">
          <ReceiptCard
            edge
            className="grid gap-5 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-7 sm:p-7"
          >
            <div className="grid gap-2 text-center sm:border-r-2 sm:border-dashed sm:border-border sm:pr-7 sm:text-left">
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
              <Button asChild size="lg" className="mt-2 w-full">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <span className="font-mono text-[0.6rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                No card to start the pilot
              </span>
            </div>
            <ul className="grid gap-2">
              {pricingIncludes.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Icon
                    icon={CheckmarkCircle02Icon}
                    size={18}
                    className="mt-0.5 shrink-0 text-primary"
                  />
                  <span className="text-sm leading-5">{line}</span>
                </li>
              ))}
            </ul>
          </ReceiptCard>
        </WetInkRise>
      </section>

      {/* FAQ — a clean list of expandable rows */}
      <section
        id="faq"
        className="mx-auto w-full max-w-6xl px-6 py-14 lg:py-20"
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

      {/* Closing — the one deliberate ink band */}
      <section className="border-y-2 border-ink bg-ink text-paper">
        <div className="mx-auto grid w-full max-w-3xl justify-items-center gap-5 px-6 py-16 text-center lg:py-20">
          <h2 className="max-w-[16ch] text-[clamp(2.2rem,5vw,3.6rem)] leading-[0.98] font-extrabold tracking-[-0.025em] text-paper">
            Set up your venue this afternoon.
          </h2>
          <p className="max-w-[46ch] text-base leading-7 text-paper/70">
            Run the pilot free for 30 days, then £29 a month for one venue with
            no contract. Earned rewards stay good even if you leave.
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
              className="font-bold text-paper underline underline-offset-4 hover:text-primary"
            >
              Merchant login
            </Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  )
}
