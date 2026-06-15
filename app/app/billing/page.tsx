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
        description="First 30 days free, then GBP 29/month for each location."
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
            title="30 days free, then GBP 29/month"
            description="Checkout sets up your subscription securely with Stripe. Everything on this page updates by itself once you are set up."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <BillingFact label="Free trial" value="30 days" />
            <BillingFact label="After that" value="GBP 29/month" />
            <BillingFact label="Billed" value="Per location" />
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
                ? `Your current period ends ${formatDate(billing.current_period_end)}.`
                : "Your billing period will show here once checkout is done."}
            </p>
          </div>
          <BillingAccessNote status={status} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <p className="eyebrow">Payments</p>
          <CardTitle className="text-2xl font-extrabold">
            Start or manage billing
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-5">
          <div className="grid gap-3 rounded-lg bg-secondary/60 p-4 text-sm text-secondary-foreground sm:grid-cols-2">
            <div>
              <p className="font-bold">Payment details</p>
              <p className="text-muted-foreground">
                {billing?.stripe_customer_id
                  ? "Manage your card and invoices in the portal."
                  : "Start checkout to set this up."}
              </p>
            </div>
            <div>
              <p className="font-bold">Subscription</p>
              <p className="text-muted-foreground">
                {billing?.stripe_subscription_id
                  ? "Your subscription is set up."
                  : "Not set up yet."}
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
          Checkout completed. Your billing will update here in a moment.
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
        A payment is past due. Your dashboard stays available while you sort it
        out.
      </p>
    )
  }

  if (status === "cancelled") {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Your subscription is cancelled. You can still see your data, but new
        stamps are paused.
      </p>
    )
  }

  if (status === "suspended") {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Your subscription is suspended. The customer card is paused until it is
        restored.
      </p>
    )
  }

  return (
    <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
      Your dashboard stays fully available while you finish setting up billing.
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
