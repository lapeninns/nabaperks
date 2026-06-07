import Link from "next/link"

import { startCheckoutAction } from "@/app/app/billing/actions"
import { PageTitle, SectionHeader } from "@/components/brand"
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
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-6xl content-center gap-8 px-6 py-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,0.65fr)] lg:items-center">
        <div className="grid gap-6">
          <PageTitle
            eyebrow="Pricing"
            title="Growth Plan for local loyalty pilots"
            description="Start with a 30-day free pilot, then keep Stampiee running for GBP 29/month per location. Checkout and account creation stay separate so teams can create an account before billing."
            titleClassName="text-4xl sm:text-5xl"
            descriptionClassName="text-base leading-7"
          />

          {checkoutMessage ? (
            <Alert className="max-w-2xl border-primary/30 bg-primary/10">
              <AlertTitle>{checkoutMessage.title}</AlertTitle>
              <AlertDescription>{checkoutMessage.body}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border bg-card p-4 shadow-xs">
              <p className="text-sm font-bold text-muted-foreground">
                Included cards
              </p>
              <p className="mt-2 text-2xl font-extrabold">1 active card</p>
            </div>
            <div className="rounded-3xl border bg-card p-4 shadow-xs">
              <p className="text-sm font-bold text-muted-foreground">
                QR assets
              </p>
              <p className="mt-2 text-2xl font-extrabold">3 downloads</p>
            </div>
            <div className="rounded-3xl border bg-card p-4 shadow-xs">
              <p className="text-sm font-bold text-muted-foreground">
                Staff approval
              </p>
              <p className="mt-2 text-2xl font-extrabold">PIN stamping</p>
            </div>
          </div>
        </div>

        <Card className="surface-card rounded-[2rem] border-primary/20 bg-card shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-2xl font-extrabold">
                Growth Plan
              </CardTitle>
              <Badge>30-day free pilot</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2 rounded-3xl bg-secondary/60 p-5">
              <p className="text-sm font-bold text-muted-foreground">
                First 30 days
              </p>
              <p className="text-5xl font-extrabold tracking-tight">Free</p>
            </div>
            <div className="grid gap-2 rounded-3xl bg-primary/10 p-5">
              <p className="text-sm font-bold text-muted-foreground">
                After the pilot
              </p>
              <p className="text-5xl font-extrabold tracking-tight">
                GBP 29/month
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Per location, billed through the existing Stripe checkout.
              </p>
            </div>
            <SectionHeader
              eyebrow="What is included"
              title="The QR loyalty MVP stack"
              description="One active loyalty card, dynamic QR image/downloads, staff PIN stamp issuing, reward unlocks, dashboard metrics, and access to the Stripe billing portal."
            />
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3 border-t sm:flex-row sm:items-center">
            <form action={startCheckoutAction}>
              <Button type="submit" className="w-full sm:w-auto">
                Start checkout
              </Button>
            </form>
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href="/signup">Create account</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    </MarketingLayout>
  )
}
