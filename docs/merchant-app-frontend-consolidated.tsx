/**
 * Nabaperks — Merchant-Facing Frontend Consolidated TSX Dump
 * Generated: 2026-06-13
 *
 * Analysis-only artifact. NOT compilable as-is (duplicate exports, mixed modules).
 * Each section is prefixed with its original repo path.
 *
 * Scope: merchant auth, /app/* pages, merchant components, layout shell,
 * server actions, QR asset routes, and directly-used loyalty/motion helpers.
 * Excludes: components/brand, components/ui, lib/, customer/staff/admin surfaces.
 */



// ==============================================================================
// FILE: app/(auth)/login/page.tsx
// LINES: 69
// ==============================================================================

import { signInAction } from "@/app/(auth)/actions"
import { Eyebrow, PageTitle, ReceiptCard, VenueMark } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type LoginPageProps = {
  searchParams: Promise<{
    next?: string
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-5xl content-center gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center">
        <div className="grid gap-6">
          <PageTitle
            eyebrow="Merchant access"
            title="Welcome back to your loyalty counter."
            description="Log in to continue onboarding, launch QR downloads, manage your counter station, and check loyalty readbacks."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7"
            className="md:grid-cols-1"
          />
          <ReceiptCard edge className="flex items-center gap-4">
            <VenueMark size={52} />
            <div className="grid gap-1">
              <Eyebrow>Your venue, one tap away</Eyebrow>
              <p className="text-sm leading-5 font-bold">
                Stamps, rewards, and the printed QR kit — all from one console.
              </p>
            </div>
          </ReceiptCard>
        </div>

        <ReceiptCard edge className="w-full">
          <div className="mb-6 grid gap-2">
            <p className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              Log in
            </p>
            <h2 className="text-3xl leading-tight font-extrabold">
              Continue merchant setup
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Use the email and password for your Nabaperks merchant account.
            </p>
          </div>
          {params.error ? (
            <Alert
              variant="destructive"
              className="mb-4 border-destructive/30 bg-destructive/10"
            >
              <AlertTitle>Verification link could not be used</AlertTitle>
              <AlertDescription>
                Log in or request a fresh link. Provider details are hidden for
                safety.
              </AlertDescription>
            </Alert>
          ) : null}
          <AuthForm action={signInAction} mode="sign-in" next={params.next} />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}


// ==============================================================================
// FILE: app/(auth)/signup/page.tsx
// LINES: 61
// ==============================================================================

import { signUpAction } from "@/app/(auth)/actions"
import { Eyebrow, PageTitle, ReceiptCard, VenueMark } from "@/components/brand"
import { AuthForm } from "@/components/auth/auth-form"
import { MarketingLayout } from "@/components/layout"

const trustPoints = [
  "No app to download",
  "No card to start the pilot",
  "Stamped in seconds at the counter",
]

export default function SignUpPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto grid min-h-[calc(100svh-73px)] w-full max-w-5xl content-center gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center">
        <div className="grid gap-6">
          <PageTitle
            eyebrow="Start trial"
            title="Your first stamp is waiting."
            description="Create a merchant account for your first QR loyalty card. Verify your email, then continue through the safe setup path to add your venue, card, rewards, and QR assets."
            titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"
            descriptionClassName="text-base leading-7"
            className="md:grid-cols-1"
          />
          <ReceiptCard edge className="grid gap-3">
            <div className="flex items-center gap-3">
              <VenueMark size={46} />
              <Eyebrow>30-day pilot · no card</Eyebrow>
            </div>
            <ul className="grid gap-2">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-baseline gap-3 text-sm font-bold">
                  <span aria-hidden="true" className="text-primary">
                    ✱
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </ReceiptCard>
        </div>

        <ReceiptCard edge className="w-full">
          <div className="mb-6 grid gap-2">
            <p className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              Merchant account
            </p>
            <h2 className="text-3xl leading-tight font-extrabold">
              Start your 30-day free pilot
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Use email and password to start the 5-minute setup. Verification
              continues through /auth/confirm before onboarding.
            </p>
          </div>
          <AuthForm action={signUpAction} mode="sign-up" />
        </ReceiptCard>
      </section>
    </MarketingLayout>
  )
}


// ==============================================================================
// FILE: app/(auth)/actions.ts
// LINES: 127
// ==============================================================================

"use server"

import { redirect } from "next/navigation"

import { getServerEnv } from "@/lib/env/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AuthActionState = {
  fields?: {
    name?: string
    email?: string
  }
  errors?: {
    name?: string
    email?: string
    password?: string
    form?: string
  }
  message?: string
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function safeNextPath(next: string) {
  const appOrigin = "https://nabaperks.local"

  try {
    const url = new URL(next, appOrigin)

    if (url.origin !== appOrigin) {
      return "/app"
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/app"
  }
}

export async function signUpAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = value(formData, "name")
  const email = value(formData, "email").toLowerCase()
  const password = value(formData, "password")
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (name.length < 2) errors.name = "Enter your name."
  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  if (password.length < 8) {
    errors.password = "Use at least 8 characters."
  }

  if (Object.keys(errors).length) {
    return { fields: { name, email }, errors }
  }

  const supabase = await createSupabaseServerClient()
  const env = getServerEnv()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/app/onboarding`,
    },
  })

  if (error) {
    return {
      fields: { name, email },
      errors: { form: error.message },
    }
  }

  if (data.session) {
    redirect("/app/onboarding")
  }

  return {
    fields: { name, email },
    message: "Check your email to verify your account, then continue setup.",
  }
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = value(formData, "email").toLowerCase()
  const password = value(formData, "password")
  const next = value(formData, "next") || "/app"
  const errors: NonNullable<AuthActionState["errors"]> = {}

  if (!validateEmail(email)) errors.email = "Enter a valid email address."
  if (!password) errors.password = "Enter your password."

  if (Object.keys(errors).length) {
    return { fields: { email }, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      fields: { email },
      errors: { form: "Email or password was not accepted." },
    }
  }

  redirect(safeNextPath(next))
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}


// ==============================================================================
// FILE: app/pricing/page.tsx
// LINES: 212
// ==============================================================================

import Link from "next/link"

import { startCheckoutAction } from "@/app/app/billing/actions"
import { Eyebrow, PageTitle } from "@/components/brand"
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
  "Mystery reward pool — you pick the prizes",
  "Printed QR kit: A4 poster, till card, sticker",
  "A paired counter station with named staff sessions",
  "Weekly digest of visits, regulars, and redemptions",
]

const faqs = [
  {
    q: "Is there a contract?",
    a: "No. It is month to month after the pilot — GBP 29, one venue, one month's notice to leave. The pilot itself needs no card at all.",
  },
  {
    q: "Do I need any hardware?",
    a: "None for customers — they use their own phones. Staff approve from a paired counter station, which can be any spare tablet or phone in the venue, by confirming a short code. The only kit is printed paper, and we send print-ready files.",
  },
  {
    q: "Who owns the customer data?",
    a: "You do, scoped to your venue. Phone numbers are stored hashed and shown masked, nothing is sold, and marketing texts only ever go to customers who tick the separate opt-in. UK GDPR throughout.",
  },
  {
    q: "What counts as a visit?",
    a: "One stamp per customer per business day, confirmed by a staff member at the counter station. The customer shows a single-use code, so there is no drive-by stamping from the bus stop.",
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
                      <li key={item} className="flex items-baseline gap-3">
                        <span
                          aria-hidden="true"
                          className="text-base font-extrabold text-primary"
                        >
                          ✱
                        </span>
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
                    Start checkout
                  </Button>
                </form>
                <Button asChild variant="secondary" size="lg" className="w-full">
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
                month&apos;s notice from your billing page — earned rewards stay
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


// ==============================================================================
// FILE: app/app/layout.tsx
// LINES: 21
// ==============================================================================

import { redirect } from "next/navigation"

import { signOutAction } from "@/app/(auth)/actions"
import { MerchantAppShell } from "@/components/layout"
import { getCurrentUser } from "@/lib/auth/session"

export default async function MerchantAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login?next=/app")
  }

  return (
    <MerchantAppShell signOutAction={signOutAction}>{children}</MerchantAppShell>
  )
}


// ==============================================================================
// FILE: app/app/page.tsx
// LINES: 241
// ==============================================================================

import Link from "next/link"
import { redirect } from "next/navigation"

import {
  EmptyState,
  MetricTile,
  PageTitle,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { ActivityCompactFeed } from "@/components/merchant/activity-compact-feed"
import { MotionReveal } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { capturePostHogEvent } from "@/lib/analytics/events"
import { getEnrichedMerchantActivity } from "@/lib/merchant/activity"
import { getMerchantDashboardData } from "@/lib/merchant/dashboard"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"

export default async function MerchantAppPage() {
  const setup = await getMerchantOnboardingStatus()

  if (setup.status !== "complete") {
    redirect("/app/onboarding")
  }

  const merchant = setup.merchant
  const [dashboard, compactActivity] = await Promise.all([
    getMerchantDashboardData(merchant),
    getEnrichedMerchantActivity(merchant.id, { limit: 6 }),
  ])
  const metrics = dashboard.metrics
  const metricTiles = [
    { label: "Members", value: metrics.members.toString() },
    { label: "New members (7d)", value: metrics.newMembers.toString() },
    { label: "Stamps issued", value: metrics.stampsIssued.toString() },
    { label: "Repeat customers", value: metrics.repeatCustomers.toString() },
    { label: "Rewards redeemed", value: metrics.rewardsRedeemed.toString() },
    { label: "QR downloads", value: metrics.qrDownloads.toString() },
    { label: "Billing status", value: formatStatus(dashboard.billingStatus) },
    {
      label: "Estimated repeat revenue",
      value: formatPence(metrics.estimatedRepeatRevenuePence),
      helper: "Estimate only: repeat customers x average order value.",
    },
  ]

  await capturePostHogEvent({
    eventName: "dashboard_viewed",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
  })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Merchant dashboard"
        title={merchant.business_name}
        description="Current MVP metrics for this merchant only."
        actions={
          <Button asChild>
            <Link href="/app/qr">Launch QR</Link>
          </Button>
        }
      />

      <BillingNotice status={dashboard.billingStatus} />

      {metrics.members === 0 ? (
        <EmptyState
          title="No members yet"
          description="Generate the venue QR and place it at the till so customers can join before their next order."
          actions={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/app/qr">Generate QR</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/card">Check card setup</Link>
              </Button>
            </div>
          }
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricTiles.map((metric, index) => (
          <MotionReveal key={metric.label} delay={index * 0.045} distance={12}>
            <MetricTile
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
            />
          </MotionReveal>
        ))}
      </section>

      <ReceiptCard className="grid gap-4">
        <SectionHeader
          title="Recent activity"
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/activity">View all</Link>
            </Button>
          }
        />
        <ActivityCompactFeed
          rows={compactActivity.rows}
          emptyState={
            <EmptyState
              title="No activity yet"
              description="Activity will appear here after customers join, stamps are issued, rewards are redeemed, or QR assets are downloaded."
              className="bg-background"
            />
          }
        />
      </ReceiptCard>
    </div>
  )
}

function BillingNotice({ status }: { status: string }) {
  const billing = billingStateCopy(status)

  return (
    <section className={billing.className}>
      <SectionHeader
        title={
          <span className={billing.titleClassName}>{billing.title}</span>
        }
        description={billing.description}
        actions={
          billing.actionHref ? (
            <Button asChild variant={billing.actionVariant} size="sm">
              <Link href={billing.actionHref}>{billing.actionLabel}</Link>
            </Button>
          ) : null
        }
      />
    </section>
  )
}

function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ")
}

function billingStateCopy(status: string) {
  const state = status === "trial" ? "trialing" : status
  const baseClassName = "rounded-lg border-2 p-5 shadow-md"

  const states: Record<
    string,
    {
      title: string
      description: string
      className: string
      titleClassName?: string
      actionHref?: string
      actionLabel?: string
      actionVariant?: "default" | "secondary"
    }
  > = {
    not_started: {
      title: "Billing not started",
      description:
        "Start checkout when the venue is ready. Customers can be configured, but billing should be activated before launch.",
      className: `${baseClassName} border-primary/30 bg-primary/10`,
      actionHref: "/app/billing",
      actionLabel: "Start billing",
      actionVariant: "default",
    },
    trialing: {
      title: "Trial active",
      description:
        "The 30-day Growth Plan pilot is running with full MVP access.",
      className: `${baseClassName} border-reward/30 bg-accent`,
      actionHref: "/app/billing",
      actionLabel: "View billing",
      actionVariant: "secondary",
    },
    active: {
      title: "Billing active",
      description:
        "Stripe marks this merchant as active. Loyalty participation and staff stamping stay enabled.",
      className: `${baseClassName} border-reward/30 bg-reward/10`,
      actionHref: "/app/billing",
      actionLabel: "Manage billing",
      actionVariant: "secondary",
    },
    past_due: {
      title: `Billing ${formatStatus(status)}`,
      description:
        "Payment needs attention. Loyalty remains visible, but billing should be resolved.",
      className: `${baseClassName} border-destructive/30 bg-destructive/10`,
      titleClassName: "text-destructive",
      actionHref: "/app/billing",
      actionLabel: "Resolve billing",
      actionVariant: "default",
    },
    cancelled: {
      title: `Billing ${formatStatus(status)}`,
      description:
        "New customer actions are disabled until billing is restored.",
      className: `${baseClassName} border-destructive/30 bg-destructive/10`,
      titleClassName: "text-destructive",
      actionHref: "/app/billing",
      actionLabel: "Restart billing",
      actionVariant: "default",
    },
    suspended: {
      title: `Billing ${formatStatus(status)}`,
      description:
        "New customer actions are disabled until billing is restored.",
      className: `${baseClassName} border-destructive/30 bg-destructive/10`,
      titleClassName: "text-destructive",
      actionHref: "/app/billing",
      actionLabel: "Restore access",
      actionVariant: "default",
    },
  }

  return (
    states[state] ?? {
      title: `Billing ${formatStatus(status)}`,
      description:
        "Billing status is available for support review. Check Stripe before changing customer access.",
      className: `${baseClassName} border-border bg-card`,
      actionHref: "/app/billing",
      actionLabel: "Review billing",
      actionVariant: "secondary",
    }
  )
}


// ==============================================================================
// FILE: app/app/onboarding/page.tsx
// LINES: 76
// ==============================================================================

import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { OnboardingForm } from "@/components/merchant/onboarding-form"
import { getMerchantOnboardingStatus } from "@/lib/merchant/onboarding"

const setupSteps = [
  {
    title: "Business profile",
    description: "Name, type, and the first public-facing venue details.",
  },
  {
    title: "Mystery card",
    description: "Set the visit target and reward pool after onboarding.",
  },
  {
    title: "Launch QR",
    description: "Download the poster, till card, and sticker from the QR page.",
  },
]

export default async function OnboardingPage() {
  const setup = await getMerchantOnboardingStatus()

  if (setup.status === "complete") {
    redirect("/app")
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ReceiptCard className="grid gap-3">
        <PageTitle
          eyebrow="Merchant setup"
          title="Tell us about your business"
          description={
            setup.status === "missing_location"
              ? "Your business profile is saved. Add the first location to finish setup."
              : "Create one merchant profile and one first location for the MVP."
          }
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
      <OnboardingForm initialFields={setup.initialFields} />

      <aside className="grid h-fit gap-4 rounded-lg border bg-secondary/60 p-5 shadow-xs lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div>
          <p className="eyebrow">Setup path</p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight">
            From profile to counter QR
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Finish this form, then Nabaperks keeps the next merchant steps in the
            app shell.
          </p>
        </div>
        <ol className="grid gap-3">
          {setupSteps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-card font-mono text-sm font-bold shadow-xs">
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-extrabold">
                  {step.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}


// ==============================================================================
// FILE: app/app/onboarding/actions.ts
// LINES: 97
// ==============================================================================

"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ONBOARDING_SAVE_ERROR =
  "Profile could not be saved. Check your details and try again."

export type OnboardingActionState = {
  fields?: {
    businessName?: string
    businessType?: string
    locationName?: string
    phone?: string
  }
  errors?: {
    businessName?: string
    businessType?: string
    locationName?: string
    form?: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export async function completeOnboardingAction(
  _state: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const user = await getCurrentUser()

  if (!user) {
    return { errors: { form: "Your session expired. Log in again." } }
  }

  const businessName = value(formData, "businessName")
  const businessType = value(formData, "businessType")
  const locationName = value(formData, "locationName")
  const phone = value(formData, "phone")
  const fields = { businessName, businessType, locationName, phone }
  const errors: NonNullable<OnboardingActionState["errors"]> = {}

  if (!businessName) errors.businessName = "Enter the business name."
  if (!businessType) errors.businessType = "Choose a business type."
  if (!locationName) errors.locationName = "Enter the first location name."

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const baseSlug = slugify(businessName) || "merchant"
  const businessSlug = `${baseSlug}-${user.id.slice(0, 8)}`
  const { data, error } = await supabase.rpc("create_merchant_onboarding", {
    p_owner_user_id: user.id,
    p_email: user.email ?? "",
    p_business_name: businessName,
    p_business_slug: businessSlug,
    p_business_type: businessType,
    p_phone: phone,
    p_location_name: locationName,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: ONBOARDING_SAVE_ERROR,
      },
    }
  }

  const merchantId = data?.[0]?.merchant_id
  await capturePostHogEvent({
    eventName: "merchant_signed_up",
    merchantId,
    actorType: "merchant",
    actorId: user.id,
  })

  redirect("/app")
}


// ==============================================================================
// FILE: app/app/card/page.tsx
// LINES: 93
// ==============================================================================

import { redirect } from "next/navigation"

import { PageTitle, ReceiptCard } from "@/components/brand"
import { LoyaltyCardForm } from "@/components/merchant/loyalty-card-form"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { getLoyaltyCardSetup } from "@/lib/merchant/loyalty-card"

type CardPageProps = {
  searchParams: Promise<{
    saved?: string
    error?: string
  }>
}

export default async function LoyaltyCardPage({ searchParams }: CardPageProps) {
  const { merchant, location, card, rewardPoolItems } =
    await getLoyaltyCardSetup()
  const params = await searchParams

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!location) {
    return (
      <ReceiptCard>
        <PageTitle
          title="Finish onboarding first"
          description="A primary location is required before creating an MVP loyalty card."
          titleClassName="sm:text-3xl"
        />
      </ReceiptCard>
    )
  }

  return (
    <div className="grid gap-5">
      <CardStatus params={params} />
      <LoyaltyCardForm
        merchantName={merchant.business_name}
        locationName={location.name}
        initialValues={{
          cardId: card?.id,
          cardName: card?.card_name ?? "Mystery Visit Card",
          stampsRequired: String(card?.stamps_required ?? 3),
          rewardTerms:
            card?.reward_terms ??
            "Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day.",
          minSpendPence: "",
          isActive: card?.is_active ?? true,
        }}
        rewardPoolItems={rewardPoolItems.map((item) => ({
          id: item.id,
          rewardName: item.reward_name,
          rewardTerms: item.reward_terms,
          minSpendPence:
            item.min_spend_pence === null ? "" : String(item.min_spend_pence),
          weight: String(item.weight),
          displayOrder: String(item.display_order),
          isActive: item.is_active,
        }))}
      />
    </div>
  )
}

function CardStatus({ params }: { params: Awaited<CardPageProps["searchParams"]> }) {
  if (params.saved === "1") {
    return (
      <StatusBanner tone="success" title="Mystery card saved.">
        Your visit-card settings are ready for customer previews.
      </StatusBanner>
    )
  }

  if (params.saved === "pool") {
    return (
      <StatusBanner tone="success" title="Reward pool saved.">
        Launch eligibility has been refreshed with your latest reward changes.
      </StatusBanner>
    )
  }

  if (params.error) {
    return (
      <StatusBanner tone="error" title="Reward update failed.">
        Unable to update reward. Check the reward and try again.
      </StatusBanner>
    )
  }

  return null
}


// ==============================================================================
// FILE: app/app/card/actions.ts
// LINES: 291
// ==============================================================================

"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const CARD_SAVE_ERROR =
  "Mystery card could not be saved. Check your details and try again."
const REWARD_SAVE_ERROR =
  "Reward could not be saved. Check your details and try again."
const REWARD_UPDATE_ERROR = "Unable to update reward"

export type LoyaltyCardActionState = {
  fields?: {
    cardId?: string
    cardName?: string
    stampsRequired?: string
    rewardTerms?: string
    minSpendPence?: string
    isActive?: boolean
  }
  errors?: {
    cardName?: string
    stampsRequired?: string
    rewardTerms?: string
    minSpendPence?: string
    form?: string
  }
}

export type RewardPoolItemActionState = {
  fields?: {
    rewardPoolItemId?: string
    loyaltyCardId?: string
    rewardName?: string
    rewardTerms?: string
    minSpendPence?: string
    weight?: string
    displayOrder?: string
    isActive?: boolean
  }
  errors?: {
    loyaltyCardId?: string
    rewardName?: string
    rewardTerms?: string
    minSpendPence?: string
    weight?: string
    displayOrder?: string
    form?: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function parseInteger(input: string) {
  if (!/^\d+$/.test(input)) return null
  return Number.parseInt(input, 10)
}

function rewardPoolFields(formData: FormData) {
  return {
    rewardPoolItemId: value(formData, "rewardPoolItemId"),
    loyaltyCardId: value(formData, "loyaltyCardId"),
    rewardName: value(formData, "rewardName"),
    rewardTerms: value(formData, "rewardTerms"),
    minSpendPence: value(formData, "minSpendPence"),
    weight: value(formData, "weight") || "1",
    displayOrder: value(formData, "displayOrder") || "0",
    isActive: formData.get("isActive") === "on",
  }
}

export async function saveLoyaltyCardAction(
  _state: LoyaltyCardActionState,
  formData: FormData
): Promise<LoyaltyCardActionState> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return { errors: { form: "Complete merchant onboarding before saving a card." } }
  }

  const cardId = value(formData, "cardId")
  const cardName = value(formData, "cardName")
  const stampsRequired = value(formData, "stampsRequired")
  const rewardTerms = value(formData, "rewardTerms")
  const minSpendPence = value(formData, "minSpendPence")
  const isActive = formData.get("isActive") === "on"
  const fields = {
    cardId,
    cardName,
    stampsRequired,
    rewardTerms,
    minSpendPence,
    isActive,
  }
  const errors: NonNullable<LoyaltyCardActionState["errors"]> = {}
  const parsedStampsRequired = parseInteger(stampsRequired)
  const parsedMinSpendPence = minSpendPence ? parseInteger(minSpendPence) : null

  if (!cardName) errors.cardName = "Enter a card name."
  if (cardName.length > 80) errors.cardName = "Use 80 characters or fewer."

  if (parsedStampsRequired === null) {
    errors.stampsRequired = "Enter a whole number of stamps."
  } else if (parsedStampsRequired < 1) {
    errors.stampsRequired = "Use at least 1 stamp."
  } else if (parsedStampsRequired > 99) {
    errors.stampsRequired = "Use 99 stamps or fewer."
  }

  if (!rewardTerms) {
    errors.rewardTerms = "Enter clear mystery reward terms."
  } else if (rewardTerms.length < 12) {
    errors.rewardTerms = "Add enough detail for customers to understand the offer."
  } else if (rewardTerms.length > 500) {
    errors.rewardTerms = "Use 500 characters or fewer."
  }

  if (minSpendPence && parsedMinSpendPence === null) {
    errors.minSpendPence = "Enter minimum spend in whole pence."
  } else if (parsedMinSpendPence !== null && parsedMinSpendPence > 100000) {
    errors.minSpendPence = "Use a minimum spend of GBP 1,000 or less."
  }

  if (Object.keys(errors).length || parsedStampsRequired === null) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("save_loyalty_card", {
    p_merchant_id: merchant.id,
    p_card_id: cardId || null,
    p_card_name: cardName,
    p_stamps_required: parsedStampsRequired,
    p_reward_name: "Surprise reward",
    p_reward_terms: rewardTerms,
    p_min_spend_pence: parsedMinSpendPence,
    p_is_active: isActive,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: CARD_SAVE_ERROR,
      },
    }
  }

  await capturePostHogEvent({
    eventName: cardId ? "loyalty_card_updated" : "loyalty_card_created",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
  })

  redirect("/app/card?saved=1")
}

export async function saveRewardPoolItemAction(
  _state: RewardPoolItemActionState,
  formData: FormData
): Promise<RewardPoolItemActionState> {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    return {
      errors: { form: "Complete merchant onboarding before saving rewards." },
    }
  }

  const fields = rewardPoolFields(formData)
  const errors: NonNullable<RewardPoolItemActionState["errors"]> = {}
  const parsedMinSpendPence = fields.minSpendPence
    ? parseInteger(fields.minSpendPence)
    : null
  const parsedWeight = parseInteger(fields.weight)
  const parsedDisplayOrder = parseInteger(fields.displayOrder)

  if (!fields.loyaltyCardId) {
    errors.loyaltyCardId = "Save the mystery card before adding rewards."
  }

  if (!fields.rewardName) errors.rewardName = "Enter the reward name."
  if (fields.rewardName.length > 100) {
    errors.rewardName = "Use 100 characters or fewer."
  }

  if (!fields.rewardTerms) {
    errors.rewardTerms = "Enter clear customer-facing reward terms."
  } else if (fields.rewardTerms.length < 12) {
    errors.rewardTerms = "Add enough detail for customers to understand the offer."
  } else if (fields.rewardTerms.length > 500) {
    errors.rewardTerms = "Use 500 characters or fewer."
  }

  if (fields.minSpendPence && parsedMinSpendPence === null) {
    errors.minSpendPence = "Enter minimum spend in whole pence."
  } else if (parsedMinSpendPence !== null && parsedMinSpendPence > 100000) {
    errors.minSpendPence = "Use a minimum spend of GBP 1,000 or less."
  }

  if (parsedWeight === null) {
    errors.weight = "Enter a whole-number weight."
  } else if (parsedWeight < 1) {
    errors.weight = "Use a weight of at least 1."
  } else if (parsedWeight > 1000) {
    errors.weight = "Use a weight of 1,000 or less."
  }

  if (parsedDisplayOrder === null) {
    errors.displayOrder = "Enter a whole-number display order."
  }

  if (
    Object.keys(errors).length ||
    parsedWeight === null ||
    parsedDisplayOrder === null
  ) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("upsert_reward_pool_item", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: fields.loyaltyCardId,
    p_reward_pool_item_id: fields.rewardPoolItemId || null,
    p_reward_name: fields.rewardName,
    p_reward_terms: fields.rewardTerms,
    p_min_spend_pence: parsedMinSpendPence,
    p_weight: parsedWeight,
    p_is_active: fields.isActive,
    p_display_order: parsedDisplayOrder,
  })

  if (error) {
    return {
      fields,
      errors: {
        form: REWARD_SAVE_ERROR,
      },
    }
  }

  await capturePostHogEvent({
    eventName: data?.[0]?.saved_action ?? "reward_pool_item_saved",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { loyalty_card_id: fields.loyaltyCardId },
  })

  redirect("/app/card?saved=pool")
}

export async function deleteRewardPoolItemAction(formData: FormData) {
  const merchant = await getCurrentMerchant()
  const rewardPoolItemId = value(formData, "rewardPoolItemId")

  if (!merchant || !rewardPoolItemId) {
    redirect(`/app/card?error=${encodeURIComponent(REWARD_UPDATE_ERROR)}`)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("delete_reward_pool_item", {
    p_merchant_id: merchant.id,
    p_reward_pool_item_id: rewardPoolItemId,
  })

  if (error) {
    redirect(`/app/card?error=${encodeURIComponent(REWARD_UPDATE_ERROR)}`)
  }

  await capturePostHogEvent({
    eventName: data?.[0]?.deleted
      ? "reward_pool_item_deleted"
      : "reward_pool_item_archived",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { reward_pool_item_id: rewardPoolItemId },
  })

  redirect("/app/card?saved=pool")
}


// ==============================================================================
// FILE: app/app/qr/page.tsx
// LINES: 343
// ==============================================================================

import Link from "next/link"
import { redirect } from "next/navigation"

import { generateQrCodeAction, setQrActiveAction } from "@/app/app/qr/actions"
import { PageTitle, ReceiptCard } from "@/components/brand"
import { QrFrame } from "@/components/loyalty/qr-frame"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { CopyUrlButton } from "@/components/merchant/copy-url-button"
import { Button } from "@/components/ui/button"
import { getServerEnv } from "@/lib/env/server"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { listStaffMembers } from "@/lib/merchant/staff-members"
import { listStations } from "@/lib/merchant/stations"

type QrPageProps = {
  searchParams: Promise<{
    created?: string
    enabled?: string
    disabled?: string
    error?: string
  }>
}

export default async function QrPage({ searchParams }: QrPageProps) {
  const [
    { merchant, activeCard, activeRewardPoolItemCount, qrCode },
    staffMembers,
    stations,
    params,
  ] = await Promise.all([
    getQrSetup(),
    listStaffMembers(),
    listStations(),
    searchParams,
  ])

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!activeCard) {
    return (
      <ReceiptCard className="grid gap-4">
        <PageTitle
          eyebrow="Dynamic QR"
          title="Create an active card first"
          description="Nabaperks needs one active mystery visit card before it can generate a permanent venue QR for customers."
          titleClassName="sm:text-3xl"
        />
        <Button asChild className="w-fit">
          <Link href="/app/card">Go to card builder</Link>
        </Button>
      </ReceiptCard>
    )
  }

  if (!qrCode) {
    return (
      <ReceiptCard className="grid gap-5">
        <PageTitle
          eyebrow="Permanent venue QR"
          title="Generate your venue QR"
          description={
            <>
              This creates one app-controlled customer entry QR for{" "}
              <strong>{activeCard.card_name}</strong>. Add at least one active
              mystery reward before launch.
            </>
          }
          titleClassName="sm:text-3xl"
        />
        <QrErrorBanner error={params.error} />
        {activeRewardPoolItemCount < 1 ? (
          <StatusBanner tone="warning" title="Add a reward before launch.">
            The QR stays blocked until at least one active mystery reward is in
            the pool.{" "}
            <Link
              href="/app/card"
              className="font-bold underline underline-offset-4"
            >
              Add or activate a reward
            </Link>
            .
          </StatusBanner>
        ) : null}
        <form action={generateQrCodeAction} className="flex flex-wrap gap-2">
          <Button type="submit" disabled={activeRewardPoolItemCount < 1}>
            Generate QR
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/card">Review card builder</Link>
          </Button>
        </form>
      </ReceiptCard>
    )
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrCode.qr_id}`
  const activeStaffCount = staffMembers.filter((member) => member.isActive).length
  const hasActiveStation = stations.some((station) => station.status === "active")
  const staffStationReady = activeStaffCount > 0 && hasActiveStation
  const downloads = [
    {
      href: `/app/qr/download/poster?qr=${qrCode.id}`,
      previewHref: `/app/qr/preview/poster?qr=${qrCode.id}`,
      title: "Counter poster PDF",
      description: "A4 print piece for tills, tables, and entrance boards.",
      format: "PDF",
      shape: "aspect-[3/4]",
    },
    {
      href: `/app/qr/download/till-card?qr=${qrCode.id}`,
      previewHref: `/app/qr/preview/till-card?qr=${qrCode.id}`,
      title: "Till card PNG",
      description: "Small counter card for staff to place beside payment.",
      format: "PNG",
      shape: "aspect-[5/3]",
    },
    {
      href: `/app/qr/download/sticker?qr=${qrCode.id}`,
      previewHref: `/app/qr/preview/sticker?qr=${qrCode.id}`,
      title: "Sticker PNG",
      description: "Square asset for vinyl stickers and quick reprints.",
      format: "PNG",
      shape: "aspect-square",
    },
  ]

  return (
    <div className="grid gap-5">
      {statusMessage(params)}
      <ReceiptCard className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <QrFrame label={`Scanner-safe QR code for ${activeCard.card_name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR images need merchant cookies */}
            <img
              src={`/app/qr/image/${qrCode.id}`}
              alt={`QR code for ${activeCard.card_name}`}
              className="aspect-square w-full rounded-lg bg-white"
            />
          </QrFrame>
          <p className="font-mono text-xs text-muted-foreground uppercase">
            {qrCode.is_active ? "Active customer entry" : "Disabled"}
          </p>
        </div>

        <div className="grid content-start gap-5">
          <PageTitle
            eyebrow="Permanent venue QR"
            title={activeCard.card_name}
            description="Customers scan this permanent URL to collect visit stamps and unlock a surprise reward. Disabled QR codes remain in history but stop new customer entry."
            titleClassName="sm:text-3xl"
          />

          <QrErrorBanner error={params.error} />
          {!staffStationReady ? (
            <StatusBanner
              tone="warning"
              title="Finish staff station setup before launch."
            >
              Add at least one named staff member and pair one active counter
              station from{" "}
              <Link
                href="/app/staff"
                className="font-bold underline underline-offset-4"
              >
                Staff station
              </Link>
              .
            </StatusBanner>
          ) : null}

          <div className="grid gap-2 rounded-lg border bg-secondary/50 p-4">
            <p className="text-sm font-bold">Shareable URL</p>
            <p className="font-mono text-sm break-all text-muted-foreground">
              {shareUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyUrlButton url={shareUrl} />
              <Button asChild variant="outline">
                <Link href={shareUrl} target="_blank">
                  Open URL
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-bold">Preview and download assets</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {downloads.map((download) => (
                <article
                  key={download.href}
                  className="grid content-between gap-4 rounded-lg border bg-background p-4 shadow-xs"
                >
                  <span className="grid gap-2">
                    <span
                      className={`grid ${download.shape} overflow-hidden rounded-lg border border-border/80 bg-card p-2`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- preview route is protected by merchant cookies */}
                      <img
                        src={download.previewHref}
                        alt={`${download.title} preview`}
                        className="h-full w-full rounded-lg bg-white object-contain shadow-xs"
                      />
                    </span>
                    <span className="inline-flex w-fit rounded-full bg-secondary px-3 py-1 font-mono text-xs font-bold text-muted-foreground">
                      {download.format}
                    </span>
                    <span className="text-sm font-extrabold">
                      {download.title}
                    </span>
                    <span className="text-sm leading-6 text-muted-foreground">
                      {download.description}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={download.previewHref} target="_blank">
                        Preview
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm">
                      <Link href={download.href}>Download</Link>
                    </Button>
                  </span>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border bg-background p-4">
            <p className="text-sm font-bold">Pilot setup checklist</p>
            <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
              <li>Card active: {activeCard.card_name}</li>
              <li>Active mystery rewards: {activeRewardPoolItemCount}</li>
              <li>QR status: {qrCode.is_active ? "enabled" : "disabled"}</li>
              <li>
                Staff members:{" "}
                {activeStaffCount > 0 ? (
                  `${activeStaffCount} active`
                ) : (
                  <Link
                    href="/app/staff"
                    className="font-bold text-foreground underline underline-offset-4"
                  >
                    Add staff
                  </Link>
                )}
              </li>
              <li>
                Counter station:{" "}
                {hasActiveStation ? (
                  "active"
                ) : (
                  <Link
                    href="/app/staff"
                    className="font-bold text-foreground underline underline-offset-4"
                  >
                    Pair station
                  </Link>
                )}
              </li>
              <li>Print the counter poster and till card before launch.</li>
              <li>Run the staff flow once before the first customer scan.</li>
            </ul>
          </div>

          <div className="grid gap-3 rounded-lg border bg-background p-4">
            <p className="text-sm font-bold">Staff training</p>
            <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Customer opens their card and taps for a stamp code.</li>
              <li>
                They read the short code to staff at the counter station — the
                phone stays in their hand.
              </li>
              <li>
                Staff confirm the code on the station. On the third visit the
                reward unseals, redeemable from the next business day.
              </li>
            </ol>
            <p className="text-sm font-bold text-foreground">
              Target: train one staff member in under 3 minutes.
            </p>
          </div>

          <form action={setQrActiveAction}>
            <input type="hidden" name="qrCodeId" value={qrCode.id} />
            <input
              type="hidden"
              name="nextActive"
              value={qrCode.is_active ? "false" : "true"}
            />
            <Button
              type="submit"
              variant={qrCode.is_active ? "destructive" : "reward"}
              disabled={!qrCode.is_active && !staffStationReady}
            >
              {qrCode.is_active ? "Disable QR" : "Enable QR"}
            </Button>
          </form>
        </div>
      </ReceiptCard>
    </div>
  )
}

function statusMessage(params: Awaited<QrPageProps["searchParams"]>) {
  const message = params.created
    ? "QR code created."
    : params.enabled
      ? "QR code enabled."
      : params.disabled
        ? "QR code disabled."
        : null

  if (!message) return null

  return (
    <StatusBanner tone="success" title={message}>
      The permanent <code>/q/{"{qr_id}"}</code> resolver, share URL, and
      downloads remain unchanged.
    </StatusBanner>
  )
}

function QrErrorBanner({ error }: { error?: string }) {
  if (!error) return null

  const message =
    error === "Add at least one active mystery reward before launching the QR."
      ? error
      : error === "Unable to update QR"
        ? "Unable to update QR. Check the QR status and try again."
        : "Unable to create QR. Check your card and reward setup, then try again."

  return (
    <StatusBanner tone="error" title="QR action failed.">
      {message}
    </StatusBanner>
  )
}


// ==============================================================================
// FILE: app/app/qr/actions.ts
// LINES: 88
// ==============================================================================

"use server"

import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getQrSetup } from "@/lib/merchant/qr-code"
import { listStaffMembers } from "@/lib/merchant/staff-members"
import { listStations } from "@/lib/merchant/stations"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const QR_REWARD_POOL_ERROR =
  "Add at least one active mystery reward before launching the QR."
const QR_STAFF_SETUP_ERROR =
  "Add at least one staff member and active counter station before launching the QR."
const QR_CREATE_ERROR = "Unable to create QR"
const QR_UPDATE_ERROR = "Unable to update QR"

export async function generateQrCodeAction() {
  const { merchant, activeCard, activeRewardPoolItemCount } = await getQrSetup()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  if (!activeCard) {
    redirect("/app/card")
  }

  if (activeRewardPoolItemCount < 1) {
    redirect(`/app/qr?error=${encodeURIComponent(QR_REWARD_POOL_ERROR)}`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("create_or_get_join_qr", {
    p_merchant_id: merchant.id,
    p_loyalty_card_id: activeCard.id,
  })

  if (error) {
    redirect(`/app/qr?error=${encodeURIComponent(QR_CREATE_ERROR)}`)
  }

  await capturePostHogEvent({
    eventName: "qr_created",
    merchantId: merchant.id,
    actorType: "merchant",
    actorId: merchant.id,
    metadata: { source: "merchant_qr_action" },
  })

  redirect("/app/qr?created=1")
}

export async function setQrActiveAction(formData: FormData) {
  const { merchant } = await getQrSetup()
  const qrCodeId = formData.get("qrCodeId")
  const nextActive = formData.get("nextActive") === "true"

  if (!merchant || typeof qrCodeId !== "string") {
    redirect(`/app/qr?error=${encodeURIComponent(QR_UPDATE_ERROR)}`)
  }

  if (nextActive) {
    const [staffMembers, stations] = await Promise.all([
      listStaffMembers(),
      listStations(),
    ])
    const hasActiveStaff = staffMembers.some((member) => member.isActive)
    const hasActiveStation = stations.some((station) => station.status === "active")

    if (!hasActiveStaff || !hasActiveStation) {
      redirect(`/app/qr?error=${encodeURIComponent(QR_STAFF_SETUP_ERROR)}`)
    }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("set_qr_active", {
    p_merchant_id: merchant.id,
    p_qr_code_id: qrCodeId,
    p_is_active: nextActive,
  })

  if (error) {
    redirect(`/app/qr?error=${encodeURIComponent(QR_UPDATE_ERROR)}`)
  }

  redirect(`/app/qr?${nextActive ? "enabled" : "disabled"}=1`)
}


// ==============================================================================
// FILE: app/app/qr/preview/[asset]/route.ts
// LINES: 68
// ==============================================================================

import { NextResponse } from "next/server"

import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrAssetContext } from "@/lib/merchant/qr-code"
import {
  assetFilename,
  assetKindFromSlug,
  renderQrAssetPng,
  renderQrPosterPng,
  type QrAssetContext,
} from "@/lib/qr/assets"

export const runtime = "nodejs"

type QrPreviewRouteContext = {
  params: Promise<{
    asset: string
  }>
}

export async function GET(request: Request, context: QrPreviewRouteContext) {
  const { asset } = await context.params
  const assetKind = assetKindFromSlug(asset)
  const qrCodeId = new URL(request.url).searchParams.get("qr")

  if (!assetKind || !qrCodeId) {
    return new NextResponse("QR asset preview not found", { status: 404 })
  }

  const qrContext = await getOwnedQrAssetContext(qrCodeId)

  if (!qrContext) {
    return new NextResponse("QR code not found", { status: 404 })
  }

  const env = getServerEnv()
  const assetContext: QrAssetContext = {
    shareUrl: `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`,
    qrPublicId: qrContext.qrCode.qr_id,
    merchantName: qrContext.merchant.business_name,
    locationName: qrContext.location.name,
    cardName: qrContext.activeCard.card_name,
    rewardName: qrContext.activeCard.reward_name,
    isActive: qrContext.qrCode.is_active,
  }

  const body =
    assetKind === "poster_pdf"
      ? await renderQrPosterPng(assetContext)
      : await renderQrAssetPng(assetKind, assetContext)

  return new NextResponse(toArrayBuffer(body), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="preview-${assetFilename(
        assetKind,
        qrContext.qrCode.qr_id
      ).replace(/\.pdf$/, ".png")}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

function toArrayBuffer(bytes: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}


// ==============================================================================
// FILE: app/app/qr/image/[qrCodeId]/route.ts
// LINES: 39
// ==============================================================================

import { NextResponse } from "next/server"

import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrAssetContext } from "@/lib/merchant/qr-code"
import { renderQrCodePng } from "@/lib/qr/assets"

export const runtime = "nodejs"

type QrImageRouteContext = {
  params: Promise<{
    qrCodeId: string
  }>
}

export async function GET(_request: Request, context: QrImageRouteContext) {
  const { qrCodeId } = await context.params
  const qrContext = await getOwnedQrAssetContext(qrCodeId)

  if (!qrContext) {
    return new NextResponse("QR code not found", { status: 404 })
  }

  const env = getServerEnv()
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`
  const png = await renderQrCodePng(shareUrl)

  return new NextResponse(toArrayBuffer(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
    },
  })
}

function toArrayBuffer(bytes: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}


// ==============================================================================
// FILE: app/app/qr/download/[asset]/route.ts
// LINES: 90
// ==============================================================================

import { NextResponse } from "next/server"

import { capturePostHogEvent } from "@/lib/analytics/events"
import { getServerEnv } from "@/lib/env/server"
import { getOwnedQrAssetContext } from "@/lib/merchant/qr-code"
import {
  assetFilename,
  assetKindFromSlug,
  renderQrAssetPng,
  renderQrPosterPdf,
  type QrAssetContext,
} from "@/lib/qr/assets"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type QrDownloadRouteContext = {
  params: Promise<{
    asset: string
  }>
}

export async function GET(request: Request, context: QrDownloadRouteContext) {
  const { asset } = await context.params
  const assetKind = assetKindFromSlug(asset)
  const qrCodeId = new URL(request.url).searchParams.get("qr")

  if (!assetKind || !qrCodeId) {
    return new NextResponse("QR asset not found", { status: 404 })
  }

  const qrContext = await getOwnedQrAssetContext(qrCodeId)

  if (!qrContext) {
    return new NextResponse("QR code not found", { status: 404 })
  }

  const env = getServerEnv()
  const assetContext: QrAssetContext = {
    shareUrl: `${env.NEXT_PUBLIC_APP_URL}/q/${qrContext.qrCode.qr_id}`,
    qrPublicId: qrContext.qrCode.qr_id,
    merchantName: qrContext.merchant.business_name,
    locationName: qrContext.location.name,
    cardName: qrContext.activeCard.card_name,
    rewardName: qrContext.activeCard.reward_name,
    isActive: qrContext.qrCode.is_active,
  }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("record_qr_download", {
    p_merchant_id: qrContext.merchant.id,
    p_qr_code_id: qrContext.qrCode.id,
    p_asset_type: assetKind,
  })

  if (error) {
    return new NextResponse("QR download could not be recorded.", { status: 500 })
  }

  await capturePostHogEvent({
    eventName: "qr_downloaded",
    merchantId: qrContext.merchant.id,
    qrCodeId: qrContext.qrCode.id,
    actorType: "merchant",
    actorId: qrContext.merchant.id,
    metadata: { asset_type: assetKind },
  })

  const body =
    assetKind === "poster_pdf"
      ? await renderQrPosterPdf(assetContext)
      : await renderQrAssetPng(assetKind, assetContext)
  const contentType = assetKind === "poster_pdf" ? "application/pdf" : "image/png"

  return new NextResponse(toArrayBuffer(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${assetFilename(
        assetKind,
        qrContext.qrCode.qr_id
      )}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

function toArrayBuffer(bytes: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)
  return arrayBuffer
}


// ==============================================================================
// FILE: app/app/customers/page.tsx
// LINES: 57
// ==============================================================================

import { redirect } from "next/navigation"

import { EmptyState, PageTitle } from "@/components/brand"
import { CustomerReadbackTable } from "@/components/merchant/customer-readback-table"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantCustomers } from "@/lib/merchant/dashboard"

type CustomersPageProps = {
  searchParams?: Promise<{
    highlight?: string | string[]
  }>
}

type CustomersSearchParams = Awaited<
  NonNullable<CustomersPageProps["searchParams"]>
>

export default async function MerchantCustomersPage({
  searchParams,
}: CustomersPageProps) {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const params = searchParams
    ? await searchParams
    : ({} satisfies CustomersSearchParams)
  const customers = await getMerchantCustomers(merchant.id)
  const highlightedMembershipId = firstParam(params.highlight)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Customers"
        title="Loyalty members"
        description="Current stamp progress and reward totals for this merchant."
      />

      <CustomerReadbackTable
        customers={customers}
        highlightedMembershipId={highlightedMembershipId}
        emptyState={
          <EmptyState
            title="No customers yet"
            description="Customers will appear here after they join from the venue QR."
          />
        }
      />
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}


// ==============================================================================
// FILE: app/app/activity/page.tsx
// LINES: 89
// ==============================================================================

import { redirect } from "next/navigation"
import { Suspense } from "react"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  type ActivityCategory,
  getEnrichedMerchantActivity,
} from "@/lib/merchant/activity"

type MerchantActivitySearchParams = {
  filter?: string | string[]
  q?: string | string[]
  limit?: string | string[]
}

export default async function MerchantActivityPage({
  searchParams,
}: {
  searchParams?: Promise<MerchantActivitySearchParams>
}) {
  const query = await searchParams
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const filter = normalizeActivityFilter(firstParam(query?.filter))
  const searchQuery = firstParam(query?.q) ?? ""
  const limit = parseActivityLimit(firstParam(query?.limit))
  const activity = await getEnrichedMerchantActivity(merchant.id, { limit })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Activity"
        title="Activity log"
        description="Recent operational events."
      />

      <Suspense fallback={null}>
        <ActivityDetailFeed
          rows={activity.rows}
          totalCount={activity.totalCount}
          loadedCount={activity.loadedCount}
          limit={activity.limit}
          initialFilter={filter}
          initialQuery={searchQuery}
          emptyState={
            <EmptyState
              title="No activity yet"
              description="Activity will appear after customers join, staff issue stamps, rewards are redeemed, or QR assets are downloaded."
            />
          }
        />
      </Suspense>
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseActivityLimit(value: string | undefined) {
  if (!value) return 25

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 25
  return Math.min(Math.max(Math.floor(parsed), 1), 250)
}

function normalizeActivityFilter(
  value: string | undefined
): "all" | ActivityCategory {
  if (
    value === "customer" ||
    value === "stamp" ||
    value === "reward" ||
    value === "qr" ||
    value === "account"
  ) {
    return value
  }

  return "all"
}


// ==============================================================================
// FILE: app/app/staff/page.tsx
// LINES: 151
// ==============================================================================

import { redirect } from "next/navigation"

import { revokeStationAction, setStaffActiveAction } from "./actions"
import { Eyebrow, ReceiptCard } from "@/components/brand"
import {
  AddStaffForm,
  CreateStationForm,
} from "@/components/merchant/staff-station-forms"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { listStaffMembers } from "@/lib/merchant/staff-members"
import { listStations } from "@/lib/merchant/stations"

export const dynamic = "force-dynamic"

export default async function MerchantStaffPage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) redirect("/app/onboarding")

  const [staffMembers, stations] = await Promise.all([
    listStaffMembers(),
    listStations(),
  ])

  const visibleStations = stations.filter(
    (station) => station.status !== "revoked"
  )

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <Eyebrow>Staff &amp; stations</Eyebrow>
        <h1 className="text-3xl font-extrabold leading-tight">
          Who stamps, and where
        </h1>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Customers show a short-lived code; your team approves it on a paired
          counter station. Each stamp is signed with a staff name — no shared
          PINs typed on customer phones.
        </p>
      </header>

      <ReceiptCard className="grid gap-5">
        <div className="grid gap-1">
          <h2 className="text-xl font-extrabold">Staff members</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Each person gets their own PIN for starting a session on the
            counter station.
          </p>
        </div>

        {staffMembers.length > 0 ? (
          <ul className="grid gap-2">
            {staffMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-lg border-2 border-ink/15 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{member.displayName}</p>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {member.isActive ? member.role : "Deactivated"}
                  </p>
                </div>
                <form action={setStaffActiveAction}>
                  <input type="hidden" name="staffId" value={member.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={member.isActive ? "false" : "true"}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    {member.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-accent px-4 py-3 text-sm leading-6">
            No staff yet. Add the people who work the counter — display names
            are enough, no email needed.
          </p>
        )}

        <AddStaffForm />
      </ReceiptCard>

      <ReceiptCard className="grid gap-5">
        <div className="grid gap-1">
          <h2 className="text-xl font-extrabold">Counter stations</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Pair the till device once with a pairing code. Open{" "}
            <span className="font-mono text-xs">/staff</span> on that device
            and it becomes the counter station.
          </p>
        </div>

        {visibleStations.length > 0 ? (
          <ul className="grid gap-2">
            {visibleStations.map((station) => (
              <li
                key={station.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-ink/15 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{station.stationName}</p>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {station.status === "active"
                      ? `Paired${station.lastSeenAt ? ` · last seen ${formatDateTime(station.lastSeenAt)}` : ""}`
                      : station.pairingCode
                        ? `Pairing code ${station.pairingCode} · expires ${formatDateTime(station.pairingExpiresAt)}`
                        : "Waiting to pair"}
                  </p>
                </div>
                <form action={revokeStationAction}>
                  <input type="hidden" name="stationId" value={station.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-accent px-4 py-3 text-sm leading-6">
            No stations yet. Create one to get a pairing code for the counter
            device.
          </p>
        )}

        <CreateStationForm />
      </ReceiptCard>
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return "soon"

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}


// ==============================================================================
// FILE: app/app/staff/actions.ts
// LINES: 102
// ==============================================================================

"use server"

import { revalidatePath } from "next/cache"

import { addStaffMember, setStaffMemberActive } from "@/lib/merchant/staff-members"
import { createStationPairing, revokeStation } from "@/lib/merchant/stations"

export type AddStaffState = {
  errors?: {
    displayName?: string
    pin?: string
  }
  added?: string
}

export type CreateStationState = {
  errors?: {
    stationName?: string
  }
  pairing?: {
    stationName: string
    pairingCode: string
    pairingExpiresAt: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function addStaffMemberAction(
  _state: AddStaffState,
  formData: FormData
): Promise<AddStaffState> {
  const displayName = value(formData, "displayName")
  const pin = value(formData, "pin")

  if (!displayName) {
    return { errors: { displayName: "Give the staff member a name." } }
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return { errors: { pin: "PIN must be 4 to 6 digits." } }
  }

  const result = await addStaffMember(displayName, pin)

  if (result.status === "invalid") {
    return { errors: { pin: result.reason } }
  }

  revalidatePath("/app/staff")
  return { added: displayName }
}

export async function setStaffActiveAction(formData: FormData) {
  const staffId = value(formData, "staffId")
  const active = value(formData, "active") === "true"

  if (staffId) {
    await setStaffMemberActive(staffId, active)
  }

  revalidatePath("/app/staff")
}

export async function createStationAction(
  _state: CreateStationState,
  formData: FormData
): Promise<CreateStationState> {
  const stationName = value(formData, "stationName")

  if (!stationName) {
    return { errors: { stationName: "Give the station a name." } }
  }

  const result = await createStationPairing(stationName)

  if (result.status === "invalid") {
    return { errors: { stationName: result.reason } }
  }

  revalidatePath("/app/staff")
  return {
    pairing: {
      stationName: result.stationName,
      pairingCode: result.pairingCode,
      pairingExpiresAt: result.pairingExpiresAt,
    },
  }
}

export async function revokeStationAction(formData: FormData) {
  const stationId = value(formData, "stationId")

  if (stationId) {
    await revokeStation(stationId)
  }

  revalidatePath("/app/staff")
}


// ==============================================================================
// FILE: app/app/settings/page.tsx
// LINES: 45
// ==============================================================================

import { redirect } from "next/navigation"

import { PageTitle, SectionHeader } from "@/components/brand"
import { RoiSettingsForm } from "@/components/merchant/roi-settings-form"
import { getCurrentMerchant } from "@/lib/auth/session"

export default async function MerchantSettingsPage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Settings"
        title="Merchant settings"
        description="Manage the estimate values used for pilot dashboard readback."
      />

      <section className="grid gap-4">
        <SectionHeader
          title="ROI estimate settings"
          description="These values power estimated dashboard figures only. Nabaperks does not claim guaranteed revenue attribution."
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <RoiSettingsForm
            averageOrderValuePence={merchant.average_order_value_pence}
            estimatedGrossMarginBps={merchant.estimated_gross_margin_bps}
            rewardCostPence={merchant.reward_cost_pence}
          />
          <section className="rounded-lg border bg-card p-5 shadow-xs">
            <h3 className="text-lg font-extrabold">Estimate formula</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Estimated repeat revenue = repeat customers x average order value.
              Gross margin and reward cost are stored now for pilot readback and
              later profitability reporting.
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}


// ==============================================================================
// FILE: app/app/settings/actions.ts
// LINES: 100
// ==============================================================================

"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const ROI_SAVE_ERROR = "Settings could not be saved. Try again."

export type RoiSettingsState = {
  fields?: {
    averageOrderValue?: string
    estimatedGrossMargin?: string
    rewardCost?: string
  }
  errors?: {
    averageOrderValue?: string
    estimatedGrossMargin?: string
    rewardCost?: string
    form?: string
  }
  message?: string
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function parseMoney(input: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) return null
  return Math.round(Number(input) * 100)
}

function parsePercent(input: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) return null
  return Math.round(Number(input) * 100)
}

export async function saveRoiSettingsAction(
  _state: RoiSettingsState,
  formData: FormData
): Promise<RoiSettingsState> {
  const merchant = await getCurrentMerchant()
  const averageOrderValue = value(formData, "averageOrderValue")
  const estimatedGrossMargin = value(formData, "estimatedGrossMargin")
  const rewardCost = value(formData, "rewardCost")
  const fields = { averageOrderValue, estimatedGrossMargin, rewardCost }
  const errors: NonNullable<RoiSettingsState["errors"]> = {}

  if (!merchant) {
    return { fields, errors: { form: "Complete merchant onboarding first." } }
  }

  const averageOrderValuePence = parseMoney(averageOrderValue)
  const estimatedGrossMarginBps = parsePercent(estimatedGrossMargin)
  const rewardCostPence = parseMoney(rewardCost)

  if (averageOrderValuePence === null) {
    errors.averageOrderValue = "Enter a valid average order value."
  }

  if (
    estimatedGrossMarginBps === null ||
    estimatedGrossMarginBps < 0 ||
    estimatedGrossMarginBps > 10000
  ) {
    errors.estimatedGrossMargin = "Enter a gross margin from 0 to 100."
  }

  if (rewardCostPence === null) {
    errors.rewardCost = "Enter a valid reward cost."
  }

  if (Object.keys(errors).length) {
    return { fields, errors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from("merchants")
    .update({
      average_order_value_pence: averageOrderValuePence,
      estimated_gross_margin_bps: estimatedGrossMarginBps,
      reward_cost_pence: rewardCostPence,
    })
    .eq("id", merchant.id)

  if (error) {
    return {
      fields,
      errors: { form: ROI_SAVE_ERROR },
    }
  }

  revalidatePath("/app")
  revalidatePath("/app/settings")

  return { fields, message: "Settings saved." }
}


// ==============================================================================
// FILE: app/app/billing/page.tsx
// LINES: 244
// ==============================================================================

import { redirect } from "next/navigation"

import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/app/billing/actions"
import { PageTitle, ReceiptCard, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const BILLING_PAGE_ERROR = "Billing details could not be loaded. Try again."

type BillingPageProps = {
  searchParams: Promise<{
    checkout?: string
    portal?: string
  }>
}

type BillingRecord = {
  status: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const merchant = await getCurrentMerchant()
  const params = await searchParams

  if (!merchant) {
    redirect("/app/onboarding")
  }

  let billing: BillingRecord | null = null
  let billingLoadFailed = false

  try {
    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .from("billing_customers")
      .select(
        "status, current_period_end, stripe_customer_id, stripe_subscription_id"
      )
      .eq("merchant_id", merchant.id)
      .maybeSingle()

    if (error) {
      billingLoadFailed = true
    } else {
      billing = data as BillingRecord | null
    }
  } catch {
    billingLoadFailed = true
  }

  const status = billing?.status ?? "not_started"

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Billing"
        title="Growth Plan"
        description="First 30 days free, then GBP 29/month per location through Stripe Billing."
      />

      <BillingOutcomeMessages
        checkout={params.checkout}
        portal={params.portal}
      />

      {billingLoadFailed ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {BILLING_PAGE_ERROR}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ReceiptCard className="grid gap-4">
          <SectionHeader
            eyebrow="Plan"
            title="30-day pilot, then GBP 29/month"
            description="Checkout creates the Stripe customer and subscription. Webhooks keep the Supabase billing state in sync for merchant readbacks."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <BillingFact label="Pilot" value="30 days free" />
            <BillingFact label="After pilot" value="GBP 29/month" />
            <BillingFact label="Scope" value="Per location" />
          </div>
        </ReceiptCard>

        <div className="grid content-between gap-4 rounded-lg border bg-secondary/60 p-6 shadow-xs">
          <div>
            <p className="eyebrow">Current state</p>
            <p className="mt-3 numeric-tabular text-3xl font-extrabold">
              {formatStatus(status)}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {billing?.current_period_end
                ? `Current period ends ${formatDate(billing.current_period_end)}.`
                : "No current Stripe period has been synced yet."}
            </p>
          </div>
          <BillingAccessNote status={status} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <p className="eyebrow">Stripe controls</p>
          <CardTitle className="text-2xl font-extrabold">
            Checkout and portal
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-5">
          <div className="grid gap-3 rounded-lg bg-secondary/60 p-4 text-sm text-secondary-foreground sm:grid-cols-2">
            <div>
              <p className="font-bold">Stripe customer</p>
              <p className="text-muted-foreground">
                {billing?.stripe_customer_id
                  ? "Portal access is available."
                  : "Create a Stripe customer through checkout first."}
              </p>
            </div>
            <div>
              <p className="font-bold">Stripe subscription</p>
              <p className="text-muted-foreground">
                {billing?.stripe_subscription_id
                  ? "Subscription record synced."
                  : "No subscription record synced yet."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={startCheckoutAction}>
              <Button type="submit">Start checkout</Button>
            </form>
            <form action={openCustomerPortalAction}>
              <Button
                type="submit"
                variant="secondary"
                disabled={!billing?.stripe_customer_id}
              >
                Open Stripe portal
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BillingFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-extrabold">{value}</p>
    </div>
  )
}

function BillingOutcomeMessages({
  checkout,
  portal,
}: {
  checkout?: string
  portal?: string
}) {
  return (
    <div className="grid gap-3">
      {checkout === "success" ? (
        <p className="rounded-lg border border-reward/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Checkout completed. Billing access updates after Stripe webhook sync.
        </p>
      ) : null}
      {checkout === "cancelled" ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Checkout was cancelled. You can restart the Growth Plan checkout when
          you are ready.
        </p>
      ) : null}
      {portal === "missing" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Start checkout before opening the Stripe portal.
        </p>
      ) : null}
    </div>
  )
}

function BillingAccessNote({ status }: { status: string }) {
  if (status === "past_due") {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Payment is past due. Dashboard access remains available during the MVP
        grace period.
      </p>
    )
  }

  if (status === "cancelled") {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Subscription is cancelled. Dashboard data remains available, but new
        stamps are blocked.
      </p>
    )
  }

  if (status === "suspended") {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Subscription is suspended. Customer-facing card use is disabled.
      </p>
    )
  }

  return (
    <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
      Not-started, trialing, and active billing states keep merchant readbacks
      available while Stripe setup is completed.
    </p>
  )
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ")
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value))
}


// ==============================================================================
// FILE: app/app/billing/actions.ts
// LINES: 145
// ==============================================================================

"use server"

import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/auth/session"
import { getServerEnv } from "@/lib/env/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe/server"

const BILLING_ACTION_ERROR = "Billing action could not be completed. Try again."

export async function startCheckoutAction() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  let env: ReturnType<typeof getServerEnv>
  let billingCustomerId: string | null | undefined

  try {
    env = getServerEnv()

    const supabase = createSupabaseServiceRoleClient()
    const { data: billing, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("merchant_id", merchant.id)
      .maybeSingle()

    if (error) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    billingCustomerId = billing?.stripe_customer_id
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  let checkoutUrl: string

  try {
    const stripe = getStripe()
    const customer =
      billingCustomerId ??
      (
        await stripe.customers.create({
          email: merchant.email,
          name: merchant.business_name,
          metadata: {
            merchant_id: merchant.id,
          },
        })
      ).id

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [
        {
          price: env.STRIPE_GROWTH_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          merchant_id: merchant.id,
          plan: "growth",
        },
      },
      metadata: {
        merchant_id: merchant.id,
        plan: "growth",
      },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=cancelled`,
    })

    if (!session.url) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    checkoutUrl = session.url
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  redirect(checkoutUrl)
}

export async function openCustomerPortalAction() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  let env: ReturnType<typeof getServerEnv>
  let billingCustomerId: string | null | undefined

  try {
    env = getServerEnv()

    const supabase = createSupabaseServiceRoleClient()
    const { data: billing, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("merchant_id", merchant.id)
      .maybeSingle()

    if (error) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    billingCustomerId = billing?.stripe_customer_id
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  if (!billingCustomerId) {
    redirect("/app/billing?portal=missing")
  }

  let portalUrl: string

  try {
    const stripe = getStripe()
    const portal = await stripe.billingPortal.sessions.create({
      customer: billingCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/app/billing`,
    })

    if (!portal.url) {
      throw new Error(BILLING_ACTION_ERROR)
    }

    portalUrl = portal.url
  } catch {
    throw new Error(BILLING_ACTION_ERROR)
  }

  redirect(portalUrl)
}


// ==============================================================================
// FILE: components/layout/merchant-app-shell.tsx
// LINES: 50
// ==============================================================================

import type { ReactNode } from "react"

import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { ShellNavigation, type ShellNavItem } from "./shell-navigation"

const merchantNavItems: ShellNavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/card", label: "Card" },
  { href: "/app/qr", label: "QR" },
  { href: "/app/customers", label: "Customers" },
  { href: "/app/staff", label: "Staff" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/billing", label: "Billing" },
]

export function MerchantAppShell({
  children,
  signOutAction,
}: {
  children: ReactNode
  signOutAction: React.ComponentProps<"form">["action"]
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/app" />
          <div className="flex items-center gap-2">
            <ShellNavigation
              items={merchantNavItems}
              mobileTitle="Merchant navigation"
              mobileDescription="Move between dashboard, setup, QR, customers, activity, settings, and billing."
              desktopClassName="md:flex"
            />
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}

export { merchantNavItems }


// ==============================================================================
// FILE: components/layout/shell-navigation.tsx
// LINES: 108
// ==============================================================================

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export type ShellNavItem = {
  href: string
  label: string
}

function isActivePath(pathname: string, href: string) {
  if (href === "/app" || href === "/admin") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function ShellNavigation({
  items,
  mobileTitle,
  mobileDescription,
  desktopClassName,
}: {
  items: ShellNavItem[]
  mobileTitle: string
  mobileDescription: string
  desktopClassName?: string
}) {
  const pathname = usePathname()

  return (
    <>
      {/* Wet Ink pill tab bar — active = ink pill / paper text. */}
      <nav
        aria-label={mobileTitle}
        className={cn(
          "hidden items-center gap-1 rounded-full border-2 border-ink bg-card p-1",
          desktopClassName
        )}
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
                active
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:bg-accent hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary" className="md:hidden">
            Menu
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="gap-0">
          <SheetHeader>
            <SheetTitle>{mobileTitle}</SheetTitle>
            <SheetDescription>{mobileDescription}</SheetDescription>
          </SheetHeader>
          <nav aria-label={`${mobileTitle} mobile`} className="grid gap-1 px-6">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href)

              return (
                <SheetClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-active={active}
                    className="justify-start inline-flex min-h-11 w-full items-center rounded-full px-4 text-sm font-bold text-ink-soft transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 data-[active=true]:bg-ink data-[active=true]:text-paper"
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}


// ==============================================================================
// FILE: components/auth/auth-form.tsx
// LINES: 114
// ==============================================================================

"use client"

import Link from "next/link"
import { useActionState } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { Eyebrow, VenueMark } from "@/components/brand"
import { FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>
  mode: "sign-in" | "sign-up"
  next?: string
}

const initialState: AuthActionState = {}

export function AuthForm({ action, mode, next = "/app" }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const isSignUp = mode === "sign-up"

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid justify-items-center gap-2 pb-1">
        <VenueMark name="Nabaperks" caption={isSignUp ? "New venue" : "Counter"} />
        <Eyebrow>{isSignUp ? "Open the till" : "Back to the counter"}</Eyebrow>
      </div>
      {isSignUp ? (
        <Field
          id="name"
          label="Name"
          name="name"
          autoComplete="name"
          defaultValue={state.fields?.name}
          error={state.errors?.name}
        />
      ) : null}
      <Field
        id="email"
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.fields?.email}
        error={state.errors?.email}
      />
      <Field
        id="password"
        label="Password"
        name="password"
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        error={state.errors?.password}
      />
      <input type="hidden" name="next" value={next} />
      {state.errors?.form ? (
        <Alert
          variant="destructive"
          className="border-destructive/30 bg-destructive/10"
        >
          <AlertDescription>{state.errors.form}</AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <Alert className="border-reward/30 bg-accent">
          <AlertDescription className="text-accent-foreground">
            {state.message}
          </AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Working..." : isSignUp ? "Create merchant account" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "New to Nabaperks?"}{" "}
        <Link
          href={isSignUp ? "/login" : "/signup"}
          className="inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        >
          {isSignUp ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <FormField id={id} label={<Eyebrow>{label}</Eyebrow>} error={error}>
      <Input
        id={id}
        className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FormField>
  )
}


// ==============================================================================
// FILE: components/merchant/activity-compact-feed.tsx
// LINES: 91
// ==============================================================================

import Link from "next/link"
import type { ReactNode } from "react"

import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import type {
  ActivityCategory,
  ActivityDisplayRow,
} from "@/lib/merchant/activity"
import { cn } from "@/lib/utils"

export function ActivityCompactFeed({
  rows,
  emptyState,
}: {
  rows: ActivityDisplayRow[]
  emptyState: ReactNode
}) {
  if (!rows.length) {
    return <>{emptyState}</>
  }

  return (
    <ol className="surface-card overflow-hidden p-0 [&>li+li]:border-t-2 [&>li+li]:border-dashed [&>li+li]:border-ink/15">
      {rows.map((row) => (
        <li
          key={row.id}
          className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <MonoTag
                tone={categoryBadgeTone(row.category)}
                className={cn(
                  categoryBadgeTone(row.category) === "plain" &&
                    categoryBadgeClass(row.category)
                )}
              >
                {row.badgeLabel}
              </MonoTag>
              <time
                dateTime={row.timestamp}
                className="numeric-tabular font-mono text-xs text-muted-foreground"
              >
                {row.relativeTime}
              </time>
            </div>
            <p className="text-sm font-bold leading-6">{row.headline}</p>
          </div>
          {row.primaryAction ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={row.primaryAction.href}>{row.primaryAction.label}</Link>
            </Button>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function categoryBadgeTone(
  category: ActivityCategory
): "plain" | "accent" | "ink" | "leaf" | "sun" {
  switch (category) {
    case "customer":
      return "accent"
    case "stamp":
      return "ink"
    case "reward":
      return "leaf"
    case "qr":
      return "sun"
    case "account":
      return "plain"
  }
}

function categoryBadgeClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "bg-accent text-accent-foreground"
    case "stamp":
      return "bg-primary/15 text-primary"
    case "reward":
      return "bg-reward/15 text-reward"
    case "qr":
      return "bg-qr/15 text-qr"
    case "account":
      return "bg-secondary text-secondary-foreground"
  }
}


// ==============================================================================
// FILE: components/merchant/activity-detail-feed.tsx
// LINES: 307
// ==============================================================================

"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  useDeferredValue,
  useMemo,
  useTransition,
  type ReactNode,
} from "react"

import { EmptyState, MonoTag } from "@/components/brand"
import { MotionReveal } from "@/components/motion/motion-reveal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ActivityCategory,
  ActivityDisplayRow,
} from "@/lib/merchant/activity"
import { cn } from "@/lib/utils"

const filterOptions: Array<{
  id: "all" | ActivityCategory
  label: string
}> = [
  { id: "all", label: "All" },
  { id: "customer", label: "Joins" },
  { id: "stamp", label: "Stamps" },
  { id: "reward", label: "Rewards" },
  { id: "qr", label: "QR" },
  { id: "account", label: "Account" },
]

export function ActivityDetailFeed({
  rows,
  totalCount,
  loadedCount,
  limit,
  initialFilter = "all",
  initialQuery = "",
  emptyState,
}: {
  rows: ActivityDisplayRow[]
  totalCount: number
  loadedCount: number
  limit: number
  initialFilter?: "all" | ActivityCategory
  initialQuery?: string
  emptyState: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const filter = normalizeFilter(searchParams.get("filter") ?? initialFilter)
  const query = searchParams.get("q") ?? initialQuery
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const categoryMatches = filter === "all" || row.category === filter
      const queryMatches =
        deferredQuery.length === 0 ||
        row.searchText.includes(deferredQuery) ||
        row.headline.toLowerCase().includes(deferredQuery) ||
        row.summary.toLowerCase().includes(deferredQuery)

      return categoryMatches && queryMatches
    })
  }, [deferredQuery, filter, rows])

  const groupedRows = useMemo(
    () => groupRowsByDate(filteredRows),
    [filteredRows]
  )

  if (!rows.length) {
    return <>{emptyState}</>
  }

  return (
    <div className="grid gap-4">
      <section className="surface-card grid gap-3 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              updateUrl({ q: event.target.value, limit: String(limit) })
            }}
            placeholder="Search activity"
            aria-label="Search activity"
          />
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              return (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={filter === option.id ? "default" : "secondary"}
                  aria-pressed={filter === option.id}
                  onClick={() => {
                    updateUrl({
                      filter: option.id === "all" ? "" : option.id,
                      limit: String(limit),
                    })
                  }}
                >
                  {option.label}
                </Button>
              )
            })}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {filteredRows.length} shown
          {filteredRows.length === loadedCount ? "" : ` from ${loadedCount}`}.
        </p>
      </section>

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No events in this filter"
          description="Try another category or clear the search to see more of the loaded activity."
        />
      ) : (
        <div className="grid gap-6">
          {groupedRows.map(([dateGroup, dateLabel, groupRows], groupIndex) => (
            <MotionReveal
              key={dateGroup}
              className="grid gap-2"
              delay={groupIndex * 0.04}
              distance={10}
            >
              <h2 className="eyebrow text-muted-foreground">
                {dateLabel}
              </h2>
              <ol className="grid gap-2">
                {groupRows.map((row) => (
                  <ActivityDetailCard key={row.id} row={row} />
                ))}
              </ol>
            </MotionReveal>
          ))}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs text-muted-foreground">
          {loadedCount} of {totalCount} events loaded
          {isPending ? " while updating filters" : ""}.
        </p>
        {loadedCount < totalCount ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={loadMoreHref(searchParams, limit)}>Load more</Link>
          </Button>
        ) : null}
      </footer>
    </div>
  )

  function updateUrl(values: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(values)) {
      if (value.trim().length === 0) {
        nextParams.delete(key)
      } else {
        nextParams.set(key, value)
      }
    }

    startTransition(() => {
      const queryString = nextParams.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      })
    })
  }
}

function ActivityDetailCard({ row }: { row: ActivityDisplayRow }) {
  return (
    <li className="relative pl-5">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-4 size-2.5 rounded-full border-2 border-ink ring-4 ring-background",
          activityDotClass(row.category)
        )}
      />
      <article className="group/activity surface-card border-ink px-4 py-3 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5">
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-6 text-foreground">
            {row.headline}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <CategoryBadge category={row.category} label={row.badgeLabel} />
            <span
              aria-hidden="true"
              className="hidden size-1 rounded-full bg-muted-foreground/35 sm:inline-block"
            />
            <time dateTime={row.timestamp} className="numeric-tabular">
              {row.relativeTime} at {row.timestampLabel}
            </time>
          </div>
        </div>
      </article>
    </li>
  )
}

function CategoryBadge({
  category,
  label,
}: {
  category: ActivityCategory
  label: string
}) {
  return (
    <MonoTag
      tone={categoryBadgeTone(category)}
      className={cn(
        categoryBadgeTone(category) === "plain" && categoryBadgeClass(category)
      )}
    >
      {label}
    </MonoTag>
  )
}

function categoryBadgeTone(
  category: ActivityCategory
): "plain" | "accent" | "ink" | "leaf" | "sun" {
  switch (category) {
    case "customer":
      return "accent"
    case "stamp":
      return "ink"
    case "reward":
      return "leaf"
    case "qr":
      return "sun"
    case "account":
      return "plain"
  }
}

function activityDotClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "bg-accent"
    case "stamp":
      return "bg-primary"
    case "reward":
      return "bg-reward"
    case "qr":
      return "bg-qr"
    case "account":
      return "bg-muted-foreground"
  }
}

function categoryBadgeClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "border-accent/80 bg-accent text-accent-foreground"
    case "stamp":
      return "border-primary/20 bg-primary/10 text-primary"
    case "reward":
      return "border-reward/25 bg-reward/10 text-reward"
    case "qr":
      return "border-qr/20 bg-qr/10 text-foreground"
    case "account":
      return "border-border bg-secondary/70 text-secondary-foreground"
  }
}

function groupRowsByDate(rows: ActivityDisplayRow[]) {
  const groups: Array<[string, string, ActivityDisplayRow[]]> = []
  const groupIndexes = new Map<string, number>()

  for (const row of rows) {
    const existingIndex = groupIndexes.get(row.dateGroup)
    if (existingIndex == null) {
      groupIndexes.set(row.dateGroup, groups.length)
      groups.push([row.dateGroup, row.dateGroupLabel, [row]])
    } else {
      groups[existingIndex][2].push(row)
    }
  }

  return groups
}

function normalizeFilter(value: string): "all" | ActivityCategory {
  return filterOptions.some((option) => option.id === value)
    ? (value as "all" | ActivityCategory)
    : "all"
}

function loadMoreHref(searchParams: URLSearchParams, limit: number) {
  const nextParams = new URLSearchParams(searchParams.toString())
  nextParams.set("limit", String(limit + 50))
  return `/app/activity?${nextParams.toString()}`
}


// ==============================================================================
// FILE: components/merchant/copy-url-button.tsx
// LINES: 37
// ==============================================================================

"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setFailed(false)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
      setFailed(true)
    }
  }

  return (
    <span className="inline-grid gap-1">
      <Button type="button" variant="secondary" onClick={copyUrl}>
        {copied ? "Copied" : "Copy URL"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {failed
          ? "Copy failed. Use the visible shareable URL instead."
          : copied
            ? "Shareable URL copied."
            : ""}
      </span>
    </span>
  )
}


// ==============================================================================
// FILE: components/merchant/customer-readback-table.tsx
// LINES: 93
// ==============================================================================

import type { ReactNode } from "react"

import { DataTable, type DataTableColumn } from "@/components/data"
import type { MerchantCustomerRow } from "@/lib/merchant/dashboard"

type CustomerIdentity = {
  email: string | null
  phone: string | null
}

export function CustomerReadbackTable({
  customers,
  emptyState,
  highlightedMembershipId,
}: {
  customers: MerchantCustomerRow[]
  emptyState: ReactNode
  highlightedMembershipId?: string
}) {
  const columns: DataTableColumn<MerchantCustomerRow>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (row) => (
        <span className="font-bold">
          {formatMerchantCustomerIdentifier(row.customer)}
        </span>
      ),
    },
    {
      key: "current",
      header: "Current stamps",
      cell: (row) => (
        <span className="numeric-tabular">{row.current_stamp_count}</span>
      ),
    },
    {
      key: "total",
      header: "Total stamps",
      cell: (row) => (
        <span className="numeric-tabular">{row.total_stamps_earned}</span>
      ),
    },
    {
      key: "rewards",
      header: "Rewards redeemed",
      cell: (row) => (
        <span className="numeric-tabular">{row.total_rewards_redeemed}</span>
      ),
    },
    {
      key: "lastVisit",
      header: "Last visit",
      cell: (row) =>
        row.last_visit_at ? (
          <time
            className="text-muted-foreground"
            dateTime={row.last_visit_at}
          >
            {formatDate(row.last_visit_at)}
          </time>
        ) : (
          <span className="text-muted-foreground">Not visited yet</span>
        ),
    },
  ]

  return (
    <DataTable
      caption="Merchant loyalty customer readbacks"
      columns={columns}
      rows={customers}
      getRowKey={(row) => row.id}
      emptyState={emptyState}
      rowClassName={(row) =>
        row.id === highlightedMembershipId
          ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
          : undefined
      }
    />
  )
}

export function formatMerchantCustomerIdentifier(customer: CustomerIdentity) {
  return customer.email ?? customer.phone ?? "Customer"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}


// ==============================================================================
// FILE: components/merchant/loyalty-card-form.tsx
// LINES: 490
// ==============================================================================

"use client"

import { useActionState, useState } from "react"

import {
  deleteRewardPoolItemAction,
  saveLoyaltyCardAction,
  saveRewardPoolItemAction,
  type LoyaltyCardActionState,
  type RewardPoolItemActionState,
} from "@/app/app/card/actions"
import {
  EmptyState,
  Eyebrow,
  MonoTag,
  PageTitle,
  SectionHeader,
  VenueMark,
} from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"

type LoyaltyCardFormValues = {
  cardId?: string
  cardName: string
  stampsRequired: string
  rewardTerms: string
  minSpendPence: string
  isActive: boolean
}

type RewardPoolItemValues = {
  id?: string
  rewardName: string
  rewardTerms: string
  minSpendPence: string
  weight: string
  displayOrder: string
  isActive: boolean
}

type LoyaltyCardFormProps = {
  initialValues: LoyaltyCardFormValues
  rewardPoolItems: RewardPoolItemValues[]
  merchantName: string
  locationName: string
}

const initialCardState: LoyaltyCardActionState = {}
const initialPoolState: RewardPoolItemActionState = {}

export function LoyaltyCardForm({
  initialValues,
  rewardPoolItems,
  merchantName,
  locationName,
}: LoyaltyCardFormProps) {
  const [state, action, pending] = useActionState(
    saveLoyaltyCardAction,
    initialCardState
  )
  const [draft, setDraft] = useState(initialValues)

  function updateDraft<K extends keyof LoyaltyCardFormValues>(
    field: K,
    value: LoyaltyCardFormValues[K]
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  const activeRewardCount = rewardPoolItems.filter((item) => item.isActive).length

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-6">
        <form action={action} className="surface-card grid gap-5 p-6">
          <input type="hidden" name="cardId" value={draft.cardId ?? ""} />
          <input type="hidden" name="minSpendPence" value={draft.minSpendPence} />
          <PageTitle
            eyebrow="Mystery card setup"
            title="Build your visit card"
            description={`One active card for ${locationName}, with rewards revealed after the final approved visit.`}
            titleClassName="sm:text-3xl"
          />

          <Field
            id="cardName"
            label="Card name"
            name="cardName"
            value={draft.cardName}
            onChange={(event) => updateDraft("cardName", event.target.value)}
            error={state.errors?.cardName}
          />

          <Field
            id="stampsRequired"
            label="Visits to reveal"
            name="stampsRequired"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.stampsRequired}
            onChange={(event) => updateDraft("stampsRequired", event.target.value)}
            error={state.errors?.stampsRequired}
          />

          <TextareaField
            id="rewardTerms"
            label="Mystery reward terms"
            name="rewardTerms"
            value={draft.rewardTerms}
            onChange={(event) => updateDraft("rewardTerms", event.target.value)}
            error={state.errors?.rewardTerms}
          />

          <label className="flex items-center justify-between gap-4 rounded-2xl border-2 border-ink bg-secondary/50 px-4 py-3 text-sm font-bold">
            <span>Card active</span>
            <input
              name="isActive"
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => updateDraft("isActive", event.target.checked)}
              className="size-5 accent-primary"
            />
          </label>

          {state.errors?.form ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.errors.form}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? "Saving..."
              : draft.cardId
                ? "Save mystery card"
                : "Create mystery card"}
          </Button>
        </form>

        <section className="surface-card grid gap-4 p-6">
          <SectionHeader
            eyebrow="Reward pool"
            title="Custom surprise rewards"
            description="At least one active reward is required before the venue QR can launch or a final stamp can reveal a prize."
          />

          {draft.cardId ? (
            <div className="grid gap-4">
              {activeRewardCount < 1 ? (
                <StatusBanner
                  tone="warning"
                  title="QR launch is blocked until a reward is active."
                >
                  Add a reward below or switch an existing reward back to active
                  so customers can reveal a prize on their final stamp.
                </StatusBanner>
              ) : (
                <StatusBanner tone="success" title="QR launch eligible.">
                  {activeRewardCount} active reward
                  {activeRewardCount === 1 ? "" : "s"} can be assigned when a
                  customer completes the card.
                </StatusBanner>
              )}
              {rewardPoolItems.length === 0 ? (
                <EmptyState
                  title="No rewards in the pool yet"
                  description="Create the first active mystery reward so the QR launch checklist can pass."
                  headingLevel={3}
                />
              ) : null}
              {rewardPoolItems.map((item) => (
                <RewardPoolItemForm
                  key={item.id}
                  loyaltyCardId={draft.cardId ?? ""}
                  initialValues={item}
                />
              ))}
              <RewardPoolItemForm
                loyaltyCardId={draft.cardId}
                initialValues={{
                  rewardName: "",
                  rewardTerms: "",
                  minSpendPence: "",
                  weight: "1",
                  displayOrder: String(rewardPoolItems.length + 1),
                  isActive: true,
                }}
                isNew
              />
            </div>
          ) : (
            <StatusBanner tone="neutral" title="Save the card before rewards.">
              The reward pool is tied to a saved loyalty card id, so this step
              unlocks after the first card save.
            </StatusBanner>
          )}
        </section>
      </div>

      <StampCardPreview
        merchantName={merchantName}
        locationName={locationName}
        draft={draft}
        activeRewardCount={activeRewardCount}
      />
    </div>
  )
}

function RewardPoolItemForm({
  loyaltyCardId,
  initialValues,
  isNew = false,
}: {
  loyaltyCardId: string
  initialValues: RewardPoolItemValues
  isNew?: boolean
}) {
  const [state, action, pending] = useActionState(
    saveRewardPoolItemAction,
    initialPoolState
  )
  const [draft, setDraft] = useState(initialValues)

  function updateDraft<K extends keyof RewardPoolItemValues>(
    field: K,
    value: RewardPoolItemValues[K]
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
  }

  return (
    <div className="surface-card grid gap-4 p-4">
      {!isNew ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border-2 border-dashed border-ink/15 bg-secondary/50 px-4 py-3">
          <div>
            <p className="text-sm font-extrabold">
              {draft.rewardName || "Untitled reward"}
            </p>
            <p className="mt-1 font-mono text-xs leading-5 text-muted-foreground">
              Minimum spend:{" "}
              {draft.minSpendPence ? `£${formatPence(draft.minSpendPence)}` : "None"} ·
              Weight: {draft.weight || "1"} · Order: {draft.displayOrder || "0"}
            </p>
          </div>
          <MonoTag tone={draft.isActive ? "leaf" : "plain"}>
            {draft.isActive ? "Active reward" : "Inactive reward"}
          </MonoTag>
        </div>
      ) : null}
      <form action={action} className="grid gap-4">
        <input type="hidden" name="loyaltyCardId" value={loyaltyCardId} />
        <input type="hidden" name="rewardPoolItemId" value={draft.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id={`${draft.id ?? "new"}-rewardName`}
            label="Reward name"
            name="rewardName"
            value={draft.rewardName}
            onChange={(event) => updateDraft("rewardName", event.target.value)}
            error={state.errors?.rewardName}
          />
          <Field
            id={`${draft.id ?? "new"}-minSpendPence`}
            label="Minimum spend"
            name="minSpendPence"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Optional pence"
            value={draft.minSpendPence}
            onChange={(event) =>
              updateDraft("minSpendPence", event.target.value)
            }
            error={state.errors?.minSpendPence}
          />
        </div>
        <TextareaField
          id={`${draft.id ?? "new"}-rewardTerms`}
          label="Reward terms"
          name="rewardTerms"
          rows={3}
          value={draft.rewardTerms}
          onChange={(event) => updateDraft("rewardTerms", event.target.value)}
          error={state.errors?.rewardTerms}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            id={`${draft.id ?? "new"}-weight`}
            label="Weight"
            name="weight"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.weight}
            onChange={(event) => updateDraft("weight", event.target.value)}
            error={state.errors?.weight}
          />
          <Field
            id={`${draft.id ?? "new"}-displayOrder`}
            label="Order"
            name="displayOrder"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.displayOrder}
            onChange={(event) => updateDraft("displayOrder", event.target.value)}
            error={state.errors?.displayOrder}
          />
          <label className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-secondary/50 px-3 py-2 text-sm font-bold sm:self-end">
            <span>Active</span>
            <input
              name="isActive"
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => updateDraft("isActive", event.target.checked)}
              className="size-5 accent-primary"
            />
          </label>
        </div>
        {state.errors?.form ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.errors.form}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isNew ? "Add reward" : "Save reward"}
          </Button>
        </div>
      </form>
      {!isNew && draft.id ? (
        <form action={deleteRewardPoolItemAction}>
          <input type="hidden" name="rewardPoolItemId" value={draft.id} />
          <Button type="submit" variant="outline">
            Delete or archive
          </Button>
        </form>
      ) : null}
    </div>
  )
}

function formatPence(value: string) {
  const pence = Number.parseInt(value, 10)
  if (!Number.isFinite(pence)) return value
  return (pence / 100).toFixed(2)
}

function Field({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function TextareaField({
  id,
  label,
  error,
  rows = 5,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className="resize-none rounded-xl border-2 border-ink bg-secondary/60 px-4 py-3 text-sm leading-6 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function StampCardPreview({
  merchantName,
  locationName,
  draft,
  activeRewardCount,
}: {
  merchantName: string
  locationName: string
  draft: LoyaltyCardFormValues
  activeRewardCount: number
}) {
  const stampsRequired = Math.max(Number.parseInt(draft.stampsRequired, 10) || 3, 1)
  const earnedPreviewCount = Math.min(stampsRequired - 1, 2)

  return (
    <div className="h-fit">
    <aside className="surface-card grid gap-4 p-5">
      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <VenueMark name={merchantName} size={48} />
          <div className="grid gap-1">
            <Eyebrow>Customer preview</Eyebrow>
            <h2 className="text-2xl font-extrabold leading-tight">
              {draft.cardName || "Mystery Visit Card"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {merchantName} · {locationName}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: Math.min(stampsRequired, 12) }).map((_, index) => {
          const earned = index < earnedPreviewCount
          return (
            <span
              key={index}
              className={
                earned
                  ? "aspect-square rounded-full border-2 border-ink bg-primary shadow-xs"
                  : "aspect-square rounded-full border-2 border-dashed border-ink bg-background"
              }
              aria-label={earned ? "Earned stamp" : "Empty stamp"}
            />
          )
        })}
      </div>

      {stampsRequired > 12 ? (
        <p className="text-xs text-muted-foreground">
          Preview shows 12 of {stampsRequired} visit slots.
        </p>
      ) : null}

      <div className="rounded-2xl border-2 border-ink bg-accent p-4">
        <Eyebrow>Locked reward</Eyebrow>
        <p className="mt-1 text-lg font-extrabold">Surprise reward</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Complete {stampsRequired} visits to reveal your surprise reward.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {draft.rewardTerms}
        </p>
      </div>

      <hr className="w-rule" />

      <Eyebrow>
        {draft.isActive ? "Active for new stamps" : "Inactive: no new stamps"}
      </Eyebrow>
      <Eyebrow>
        {activeRewardCount} active pool reward{activeRewardCount === 1 ? "" : "s"}
      </Eyebrow>
    </aside>
    <div aria-hidden className="receipt-edge" />
    </div>
  )
}


// ==============================================================================
// FILE: components/merchant/onboarding-form.tsx
// LINES: 189
// ==============================================================================

"use client"

import { useActionState, useEffect, useRef } from "react"

import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/app/app/onboarding/actions"
import { Eyebrow, VenueMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const initialState: OnboardingActionState = {}
const draftStorageKey = "nabaperks:onboarding-draft"

type OnboardingDraft = NonNullable<OnboardingActionState["fields"]>

export function OnboardingForm({
  className,
  initialFields = {},
}: {
  className?: string
  initialFields?: OnboardingDraft
}) {
  const hasInitialFields = Object.values(initialFields).some(Boolean)
  const [state, action, pending] = useActionState(
    completeOnboardingAction,
    hasInitialFields ? { ...initialState, fields: initialFields } : initialState
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem(draftStorageKey)
      const draft = savedDraft ? (JSON.parse(savedDraft) as OnboardingDraft) : {}
      const form = formRef.current
      if (!form || Object.values(state.fields ?? {}).some(Boolean)) return

      restoreField(form, "businessName", draft.businessName)
      restoreField(form, "businessType", draft.businessType)
      restoreField(form, "locationName", draft.locationName)
      restoreField(form, "phone", draft.phone)
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }, [state.fields])

  function updateDraft(field: keyof OnboardingDraft, value: string) {
    try {
      const currentDraft = JSON.parse(
        window.localStorage.getItem(draftStorageKey) ?? "{}"
      ) as OnboardingDraft
      const nextDraft: OnboardingDraft = {
        ...initialFields,
        ...currentDraft,
        [field]: value,
      }
      window.localStorage.setItem(draftStorageKey, JSON.stringify(nextDraft))
    } catch {
      window.localStorage.removeItem(draftStorageKey)
    }
  }

  return (
    <form
      ref={formRef}
      action={action}
      className={cn(
        "surface-card grid gap-4 p-6",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <VenueMark name="Nabaperks" size={48} />
        <Eyebrow>Merchant setup</Eyebrow>
      </div>
      <hr className="w-rule" />
      <Field
        id="businessName"
        label="Business name"
        name="businessName"
        defaultValue={state.fields?.businessName}
        onChange={(event) => updateDraft("businessName", event.target.value)}
        error={state.errors?.businessName}
      />
      <div className="grid gap-2">
        <label htmlFor="businessType" className="eyebrow">
          Business type
        </label>
        <select
          id="businessType"
          name="businessType"
          defaultValue={state.fields?.businessType ?? ""}
          onChange={(event) => updateDraft("businessType", event.target.value)}
          className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
          aria-invalid={Boolean(state.errors?.businessType)}
          aria-describedby={
            state.errors?.businessType ? "businessType-error" : undefined
          }
        >
          <option value="" disabled>
            Select type
          </option>
          <option value="cafe">Cafe</option>
          <option value="dessert">Dessert shop</option>
          <option value="bubble_tea">Bubble tea</option>
          <option value="pub">Pub or bar</option>
          <option value="takeaway">Takeaway / quick service</option>
          <option value="barber">Barber</option>
          <option value="salon">Salon</option>
          <option value="other">Other local business</option>
        </select>
        {state.errors?.businessType ? (
          <p id="businessType-error" className="text-sm text-destructive">
            {state.errors.businessType}
          </p>
        ) : null}
      </div>
      <Field
        id="locationName"
        label="First location name"
        name="locationName"
        defaultValue={state.fields?.locationName}
        onChange={(event) => updateDraft("locationName", event.target.value)}
        error={state.errors?.locationName}
      />
      <Field
        id="phone"
        label="Phone number"
        name="phone"
        type="tel"
        defaultValue={state.fields?.phone}
        onChange={(event) => updateDraft("phone", event.target.value)}
      />
      {state.errors?.form ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Finish setup"}
      </Button>
    </form>
  )
}

function restoreField(
  form: HTMLFormElement,
  fieldName: keyof OnboardingDraft,
  value?: string
) {
  const field = form.elements.namedItem(fieldName)
  if (!value || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
    return
  }

  field.value = value
}

function Field({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}


// ==============================================================================
// FILE: components/merchant/roi-settings-form.tsx
// LINES: 148
// ==============================================================================

"use client"

import { useActionState } from "react"

import {
  saveRoiSettingsAction,
  type RoiSettingsState,
} from "@/app/app/settings/actions"
import { Button } from "@/components/ui/button"

export function RoiSettingsForm({
  averageOrderValuePence,
  estimatedGrossMarginBps,
  rewardCostPence,
}: {
  averageOrderValuePence: number
  estimatedGrossMarginBps: number
  rewardCostPence: number
}) {
  const initialState: RoiSettingsState = {
    fields: {
      averageOrderValue: formatInputMoney(averageOrderValuePence),
      estimatedGrossMargin: formatInputPercent(estimatedGrossMarginBps),
      rewardCost: formatInputMoney(rewardCostPence),
    },
  }
  const [state, action, pending] = useActionState(
    saveRoiSettingsAction,
    initialState
  )
  const fields = state.fields ?? initialState.fields

  return (
    <form action={action} className="surface-card grid gap-4 p-5">
      <MoneyField
        id="averageOrderValue"
        label="Average order value"
        value={fields?.averageOrderValue ?? ""}
        error={state.errors?.averageOrderValue}
      />
      <NumberField
        id="estimatedGrossMargin"
        label="Estimated gross margin"
        suffix="%"
        value={fields?.estimatedGrossMargin ?? ""}
        error={state.errors?.estimatedGrossMargin}
      />
      <MoneyField
        id="rewardCost"
        label="Estimated reward cost"
        value={fields?.rewardCost ?? ""}
        error={state.errors?.rewardCost}
      />
      {state.errors?.form ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.errors.form}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  )
}

function MoneyField({
  id,
  label,
  value,
  error,
}: {
  id: string
  label: string
  value: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <div className="flex h-12 items-center rounded-xl border-2 border-ink bg-secondary/60 px-4 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <span className="font-mono text-sm text-muted-foreground">£</span>
        <input
          id={id}
          name={id}
          type="number"
          min="0"
          step="0.01"
          defaultValue={value}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function NumberField({
  id,
  label,
  suffix,
  value,
  error,
}: {
  id: string
  label: string
  suffix: string
  value: string
  error?: string
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <div className="flex h-12 items-center rounded-xl border-2 border-ink bg-secondary/60 px-4 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <input
          id={id}
          name={id}
          type="number"
          min="0"
          max="100"
          step="0.01"
          defaultValue={value}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          aria-invalid={Boolean(error)}
        />
        <span className="font-mono text-sm text-muted-foreground">{suffix}</span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function formatInputMoney(pence: number) {
  return (pence / 100).toFixed(2)
}

function formatInputPercent(bps: number) {
  return (bps / 100).toFixed(2)
}


// ==============================================================================
// FILE: components/merchant/staff-station-forms.tsx
// LINES: 130
// ==============================================================================

"use client"

import { useActionState } from "react"

import {
  addStaffMemberAction,
  createStationAction,
  type AddStaffState,
  type CreateStationState,
} from "@/app/app/staff/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const addStaffInitial: AddStaffState = {}
const createStationInitial: CreateStationState = {}

export function AddStaffForm() {
  const [state, action, pending] = useActionState(
    addStaffMemberAction,
    addStaffInitial
  )

  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="staff-display-name" className="eyebrow">
            Display name
          </label>
          <Input
            id="staff-display-name"
            name="displayName"
            placeholder="Maya"
            aria-invalid={Boolean(state.errors?.displayName)}
            aria-describedby={
              state.errors?.displayName ? "staff-name-error" : undefined
            }
          />
          {state.errors?.displayName ? (
            <p id="staff-name-error" className="text-sm text-destructive">
              {state.errors.displayName}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="staff-pin" className="eyebrow">
            Their PIN (4–6 digits)
          </label>
          <Input
            id="staff-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            aria-invalid={Boolean(state.errors?.pin)}
            aria-describedby={state.errors?.pin ? "staff-pin-error" : undefined}
          />
          {state.errors?.pin ? (
            <p id="staff-pin-error" className="text-sm text-destructive">
              {state.errors.pin}
            </p>
          ) : null}
        </div>
      </div>
      {state.added ? (
        <p
          className="surface-card bg-accent px-3 py-2 text-sm"
          role="status"
        >
          {state.added} can now start sessions on any paired station.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Adding..." : "Add staff member"}
      </Button>
    </form>
  )
}

export function CreateStationForm() {
  const [state, action, pending] = useActionState(
    createStationAction,
    createStationInitial
  )

  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="station-name" className="eyebrow">
          Station name
        </label>
        <Input
          id="station-name"
          name="stationName"
          placeholder="Front till"
          aria-invalid={Boolean(state.errors?.stationName)}
          aria-describedby={
            state.errors?.stationName ? "station-name-error" : undefined
          }
        />
        {state.errors?.stationName ? (
          <p id="station-name-error" className="text-sm text-destructive">
            {state.errors.stationName}
          </p>
        ) : null}
      </div>
      {state.pairing ? (
        <div
          className="grid gap-1 rounded-xl border-2 border-ink bg-ink p-4 text-paper"
          role="status"
        >
          <p className="font-mono text-[11px] uppercase tracking-wide text-paper/60">
            Pairing code for {state.pairing.stationName}
          </p>
          <p className="font-mono text-3xl font-bold uppercase tracking-[0.2em]">
            {state.pairing.pairingCode}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wide text-paper/60">
            Enter it at /staff on the counter device · lives for 15 minutes
          </p>
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Creating..." : "Create station"}
      </Button>
    </form>
  )
}


// ==============================================================================
// FILE: components/loyalty/qr-frame.tsx
// LINES: 25
// ==============================================================================

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function QrFrame({
  children,
  label = "Scanner-safe QR code",
  className,
}: {
  children: ReactNode
  label?: string
  className?: string
}) {
  return (
    <figure
      aria-label={label}
      className={cn(
        "rounded-lg border-2 border-ink bg-white p-4 text-black shadow-[4px_4px_0_var(--w-shadow-color)]",
        className
      )}
    >
      <div className="rounded-md bg-white p-2">{children}</div>
    </figure>
  )
}


// ==============================================================================
// FILE: components/loyalty/status-banner.tsx
// LINES: 34
// ==============================================================================

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const statusClasses = {
  success: "border-2 border-ink bg-reward/12 text-foreground",
  warning: "border-2 border-ink bg-primary/12 text-foreground",
  error: "border-2 border-ink bg-destructive/10 text-destructive",
  neutral: "border-2 border-ink bg-card text-card-foreground",
} as const

export type StatusBannerTone = keyof typeof statusClasses

export function StatusBanner({
  title,
  children,
  tone = "neutral",
  className,
}: {
  title: ReactNode
  children?: ReactNode
  tone?: StatusBannerTone
  className?: string
}) {
  return (
    <Alert className={cn(statusClasses[tone], className)}>
      <AlertTitle className="font-extrabold">{title}</AlertTitle>
      {children ? (
        <AlertDescription className="text-current/75">{children}</AlertDescription>
      ) : null}
    </Alert>
  )
}


// ==============================================================================
// FILE: components/motion/motion-reveal.tsx
// LINES: 38
// ==============================================================================

"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

const stampEase = [0.2, 0, 0, 1] as const

export function MotionReveal({
  children,
  className,
  delay = 0,
  distance = 14,
}: {
  children: ReactNode
  className?: string
  delay?: number
  distance?: number
}) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>
  }

  // Animate position/scale only — never opacity — so wrapped content stays
  // legible even if the entrance never runs (pre-hydration, a throttled
  // background tab that pauses rAF, or JS disabled). Content must not blank out.
  return (
    <motion.div
      initial={{ y: distance, scale: 0.98 }}
      animate={{ y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: stampEase }}
      className={className}
    >
      {children}
    </motion.div>
  )
}


// ==============================================================================
// FILE: components/motion/index.ts
// LINES: 4
// ==============================================================================

export { DashboardMetricGrid } from "./dashboard-metric-grid"
export { MotionReveal } from "./motion-reveal"
export { StampCelebration } from "./stamp-celebration"
export type { DashboardMetric } from "./dashboard-metric-grid"


// ==============================================================================
// END OF DUMP — 38 files, 4707 lines
// ==============================================================================
