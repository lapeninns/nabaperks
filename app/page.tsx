import Link from "next/link"
import { InformationCircleIcon, UserAdd01Icon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, ReceiptCard } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import type { MarketingNavLink } from "@/components/layout/marketing-layout"
import {
  MarketingHeroLoyaltyCard,
  MarketingHowItWorksSection,
} from "@/components/marketing"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"

const HOME_NAV_LINKS: MarketingNavLink[] = [
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Log in" },
]

const stats = [
  { value: "<5 min", label: "to set the venue up" },
  { value: "<10 sec", label: "from scan to stamp" },
  { value: "30 days", label: "free, card required" },
]

const trust = [
  {
    icon: InformationCircleIcon,
    title: "Private by default",
    copy: "Phone numbers are stored hashed and shown masked. Consent is logged to UK GDPR.",
  },
  {
    icon: UserAdd01Icon,
    title: "Marketing is separate",
    copy: "Customers can collect stamps without opting into marketing.",
  },
]

const faqs = [
  {
    q: "Do customers need an app or extra hardware?",
    a: "No. Customers use their own phone, and your venue uses the printed QR kit.",
  },
  {
    q: "How is a stamp kept honest?",
    a: "One stamp per customer per UK business day, recorded as a server-side event on your venue ledger.",
  },
  {
    q: "What if location looks wrong?",
    a: "The stamp still goes through. Optional location checks write review signals without blocking good customers.",
  },
  {
    q: "Can people collect stamps without marketing consent?",
    a: "Yes. Loyalty participation and marketing opt-in are separate.",
  },
  {
    q: "What does it cost after the pilot?",
    a: "The pilot is free for 30 days. After that it is £29/month per venue, with one month's notice to cancel.",
  },
]

export default function Page() {
  return (
    <MarketingLayout navLinks={HOME_NAV_LINKS}>
      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="grid min-w-0 items-center gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.82fr)] lg:gap-14">
          <div className="min-w-0 grid gap-6 lg:gap-7">
            <div className="grid gap-4">
              <Eyebrow>No-app loyalty for food and drink venues</Eyebrow>
              <h1 className="max-w-[18ch] text-[clamp(2.2rem,7vw,3.4rem)] leading-[0.98] font-extrabold tracking-[-0.025em] text-balance">
                Replace paper loyalty cards with one venue QR.
              </h1>
              <p className="max-w-[44ch] text-base leading-7 text-muted-foreground sm:text-lg">
                Customers scan, save a browser card, and collect one honest
                stamp per day. Your venue can be live in under five minutes.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/signup">Start a merchant trial</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="w-full justify-center sm:w-auto"
                >
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
              <p className="pt-1 text-sm text-muted-foreground">
                <span className="font-mono text-[0.7rem] font-bold tracking-[0.08em] uppercase">
                  Got a card already?{" "}
                </span>
                <Link
                  href="/home"
                  className="font-bold text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Open my cards
                </Link>
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <MarketingHeroLoyaltyCard />
          </div>
        </div>
      </section>

      <section className="border-y-2 border-dashed border-border">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-3 gap-2 px-5 py-5 sm:gap-0 sm:divide-x-2 sm:divide-dashed sm:divide-border sm:px-6 sm:py-7">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="grid justify-items-center gap-1.5 text-center sm:px-6"
            >
              <span className="text-2xl leading-none font-extrabold tracking-[-0.02em] sm:text-5xl">
                {stat.value}
              </span>
              <span className="font-mono text-[0.62rem] font-bold tracking-[0.06em] text-muted-foreground uppercase sm:text-[0.7rem]">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <MarketingHowItWorksSection />

      <section
        id="pricing"
        className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-12 lg:py-14"
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <div className="grid gap-5">
            <div className="grid gap-3">
              <Eyebrow>Trust and pricing</Eyebrow>
              <h2 className="max-w-[18ch] text-[clamp(1.8rem,6vw,2.7rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
                Stamped, not tracked.
              </h2>
              <p className="max-w-[44ch] text-sm leading-6 text-muted-foreground sm:text-base">
                Customer loyalty participation and marketing opt-in stay
                separate. Pricing stays just as plain.
              </p>
            </div>
            <ul className="grid divide-y-2 divide-dashed divide-border border-y-2 border-dashed border-border">
              {trust.map((item) => (
                <li
                  key={item.title}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3.5 py-3.5"
                >
                  <Icon
                    icon={item.icon}
                    size={21}
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
          <WetInkRise className="-rotate-1 lg:justify-self-end">
            <ReceiptCard edge className="grid gap-4 p-6 text-center sm:p-7 sm:text-left">
              <div className="grid gap-2">
                <Eyebrow>Growth Plan</Eyebrow>
                <p className="text-5xl leading-none font-extrabold tracking-[-0.02em]">
                  £29
                  <span className="text-base font-bold text-muted-foreground">
                    /month
                  </span>
                </p>
                <span className="font-mono text-[0.6rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  GBP 29/month · one venue · no contracts
                </span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                30-day pilot free, with a card required to go live. Unlimited
                stamps, mystery rewards, and the printed QR kit.
              </p>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </ReceiptCard>
          </WetInkRise>
        </div>
      </section>

      <section
        id="faq"
        className="border-y-2 border-ink bg-ink text-paper"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)] lg:items-start lg:gap-14 lg:py-14">
          <div className="grid gap-6">
            <h2 className="max-w-[16ch] text-[clamp(1.8rem,6vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
              Questions, answered plainly.
            </h2>
            <div className="grid divide-y-2 divide-dashed divide-paper/25 border-y-2 border-dashed border-paper/25">
              {faqs.map((item) => (
                <details key={item.q} className="group">
                  <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-extrabold text-paper [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-paper text-xl leading-none transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open:rotate-45 motion-reduce:transition-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-[60ch] pb-5 text-sm leading-6 text-paper/70">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
          <div className="grid content-start gap-5 lg:pt-2">
            <h2 className="max-w-[14ch] text-[clamp(2rem,7vw,3.4rem)] leading-[0.98] font-extrabold tracking-[-0.025em] text-paper text-balance">
              Set up your venue this afternoon.
            </h2>
            <p className="max-w-[42ch] text-base leading-7 text-paper/70">
              Run the pilot free for 30 days, with a card required to activate.
              Then it is £29/month for one venue.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/signup">Start a merchant trial</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="w-full justify-center sm:w-auto"
              >
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
        </div>
      </section>
    </MarketingLayout>
  )
}
