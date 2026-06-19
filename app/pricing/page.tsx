import Link from "next/link"

import { CreditCardIcon, Tick02Icon } from "@hugeicons/core-free-icons"

import { startCheckoutAction } from "@/app/app/billing/actions"
import { Eyebrow, Icon, PageTitle } from "@/components/brand"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const planIncludes = [
  "Unlimited stamps and members",
  "Mystery reward pool, you pick the prizes",
  "Printed QR kit: A4 poster, till card, sticker",
  "Optional soft GPS checks with geocoded venue address",
  "Weekly digest of visits, regulars, and redemptions",
]

const faqs = [
  {
    q: "Is there a contract?",
    a: "No. It is month to month after the pilot. GBP 29, one venue, one month's notice to leave. The pilot itself needs no card at all.",
  },
  {
    q: "Do I need any hardware?",
    a: "No. Customers use their own phones and the permanent printed QR kit. If you turn on GPS checks, the app uses the phone location as a soft fraud signal.",
  },
  {
    q: "Who owns the customer data?",
    a: "You do, scoped to your venue. Phone numbers are stored hashed and shown masked, nothing is sold, and marketing texts only ever go to customers who tick the separate opt-in. UK GDPR throughout.",
  },
  {
    q: "What counts as a visit?",
    a: "One stamp per customer per UK business day from the venue QR. Optional GPS checks can flag out-of-range or unavailable location without blocking legitimate customers.",
  },
  {
    q: "What if I want to cancel?",
    a: "One month's notice from your billing page, any time. Earned rewards stay redeemable while things wind down, so no regular is left holding a broken seal.",
  },
]

type PricingPageProps = {
  searchParams?: Promise<{
    checkout?: string
  }>
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const params = searchParams ? await searchParams : {}
  const checkoutMessage =
    params.checkout === "success"
      ? {
          title: "Checkout complete",
          body: "Your Growth Plan setup can continue from the merchant billing page.",
        }
      : params.checkout === "cancelled"
        ? {
            title: "Checkout cancelled",
            body: "No payment details were changed. You can start checkout again whenever you are ready.",
          }
        : null

  return (
    <MarketingLayout>
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <PageTitle
          eyebrow="Pricing"
          title="One price. The whole machine."
          description="A 30-day free pilot, then GBP 29/month per venue. No tiers, no seats, no contact-sales. Checkout and account creation stay separate, so a team can create an account before billing."
          titleClassName="text-[clamp(2.3rem,5vw,3.5rem)]"
          descriptionClassName="text-base leading-7"
          className="md:grid-cols-1"
        />

        {checkoutMessage ? (
          <Alert className="mt-6 max-w-2xl border-primary/30 bg-primary/10">
            <AlertTitle>{checkoutMessage.title}</AlertTitle>
            <AlertDescription>{checkoutMessage.body}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.45fr)] lg:items-start">
          {/* The plan receipt */}
          <div className="lg:-rotate-1">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-2xl font-extrabold">
                    Growth Plan
                  </CardTitle>
                  <Badge>30-day free pilot</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div>
                  <p className="text-5xl leading-none font-extrabold">
                    £29
                    <span className="text-lg font-bold text-muted-foreground">
                      /month
                    </span>
                  </p>
                  <p className="mt-2 font-mono text-[0.7rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                    GBP 29/month · billed monthly through Stripe · per venue
                  </p>
                </div>
                <hr className="w-rule" />
                <div>
                  <Eyebrow className="mb-3">Everything included</Eyebrow>
                  <ul className="grid gap-3">
                    {planIncludes.map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <Icon
                          icon={Tick02Icon}
                          size={18}
                          strokeWidth={2.5}
                          className="text-primary"
                        />
                        <span className="text-[0.95rem] leading-snug font-bold">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-3 border-t-2 border-dashed">
                <form action={startCheckoutAction}>
                  <Button type="submit" size="lg" className="w-full">
                    <Icon icon={CreditCardIcon} size={18} />
                    Start checkout
                  </Button>
                </form>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  <Link href="/signup">Create account</Link>
                </Button>
                <p className="text-center font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                  No card to start · cancel any time
                </p>
              </CardFooter>
            </Card>
          </div>

          {/* Pilot explainer */}
          <div className="grid gap-5 pt-2">
            <div className="grid gap-3">
              <Eyebrow>The pilot</Eyebrow>
              <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] leading-tight font-extrabold">
                30 days free. No card. If it doesn&apos;t earn its keep, walk
                away.
              </h2>
              <p className="max-w-[46ch] text-[0.95rem] leading-6 text-muted-foreground">
                Most venues see their first repeat visit inside the first week,
                so you will know long before day 30. Your dashboard counts the
                regulars; you do the maths.
              </p>
            </div>
            <div className="rounded-lg border-2 border-dashed border-border p-5">
              <Eyebrow className="mb-2 text-foreground">After day 30</Eyebrow>
              <p className="text-sm leading-6 text-muted-foreground">
                Add a card in Stripe and carry on. Leaving later takes one
                month&apos;s notice from your billing page. Earned rewards stay
                good for your regulars.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-16 max-w-2xl">
          <h2 className="mb-2 text-[clamp(1.5rem,3vw,2rem)] font-extrabold">
            Asked at the counter
          </h2>
          <div className="border-b-2 border-dashed border-border">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group border-t-2 border-dashed border-border [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="pressable flex cursor-pointer items-center justify-between gap-4 py-4 outline-none">
                  <span className="text-[1.05rem] font-extrabold">{faq.q}</span>
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-card font-mono text-base font-bold group-open:bg-primary group-open:text-primary-foreground"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">–</span>
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-4 text-sm leading-6 text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
          <div className="mt-10 grid justify-items-center gap-3 text-center">
            <Button asChild size="lg">
              <Link href="/signup">Start your 30-day pilot</Link>
            </Button>
            <p className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              No card to start · GBP 29/month after · one month&apos;s notice
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  )
}
