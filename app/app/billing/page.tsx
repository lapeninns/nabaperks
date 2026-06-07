import { redirect } from "next/navigation"

import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/app/billing/actions"
import { PageTitle } from "@/components/brand"
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
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {BILLING_PAGE_ERROR}
        </p>
      ) : null}

      <Card className="surface-card">
        <CardHeader>
          <p className="eyebrow">Current billing state</p>
          <CardTitle className="numeric-tabular text-3xl font-extrabold">
            {formatStatus(status)}
          </CardTitle>
          {billing?.current_period_end ? (
            <p className="text-sm text-muted-foreground">
              Current period ends {formatDate(billing.current_period_end)}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No current Stripe period has been synced yet.
            </p>
          )}
        </CardHeader>

        <CardContent className="grid gap-5">
          <BillingAccessNote status={status} />

          <div className="grid gap-3 rounded-2xl bg-secondary/60 p-4 text-sm text-secondary-foreground sm:grid-cols-2">
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
        <p className="rounded-2xl border border-reward/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Checkout completed. Billing access updates after Stripe webhook sync.
        </p>
      ) : null}
      {checkout === "cancelled" ? (
        <p className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Checkout was cancelled. You can restart the Growth Plan checkout when
          you are ready.
        </p>
      ) : null}
      {portal === "missing" ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Start checkout before opening the Stripe portal.
        </p>
      ) : null}
    </div>
  )
}

function BillingAccessNote({ status }: { status: string }) {
  if (status === "past_due") {
    return (
      <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Payment is past due. Dashboard access remains available during the MVP
        grace period.
      </p>
    )
  }

  if (status === "cancelled") {
    return (
      <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Subscription is cancelled. Dashboard data remains available, but new
        stamps are blocked.
      </p>
    )
  }

  if (status === "suspended") {
    return (
      <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Subscription is suspended. Customer-facing card use is disabled.
      </p>
    )
  }

  return (
    <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
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
