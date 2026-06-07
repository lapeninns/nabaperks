import { redirect } from "next/navigation"

import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/app/billing/actions"
import { PageTitle } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type BillingPageProps = {
  searchParams: Promise<{
    checkout?: string
    portal?: string
  }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const merchant = await getCurrentMerchant()
  const params = await searchParams

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data: billing, error } = await supabase
    .from("billing_customers")
    .select("status, current_period_end, stripe_subscription_id")
    .eq("merchant_id", merchant.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load billing record: ${error.message}`)
  }

  const status = billing?.status ?? "not_started"

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Billing"
        title="Growth Plan"
        description="First 30 days free, then GBP 29/month per location through Stripe Billing."
      />

      {params.checkout === "success" ? (
        <p className="rounded-2xl border border-reward/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          Checkout completed. Billing access updates after Stripe webhook sync.
        </p>
      ) : null}
      {params.portal === "missing" ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Start a subscription before opening the Stripe portal.
        </p>
      ) : null}

      <section className="grid gap-5 rounded-3xl border bg-card p-5 shadow-xs">
        <div className="grid gap-2">
          <p className="text-xs font-bold text-muted-foreground uppercase">
            Current billing state
          </p>
          <p className="text-2xl font-extrabold">{formatStatus(status)}</p>
          {billing?.current_period_end ? (
            <p className="text-sm text-muted-foreground">
              Current period ends {formatDate(billing.current_period_end)}.
            </p>
          ) : null}
        </div>

        <BillingAccessNote status={status} />

        <div className="flex flex-wrap gap-2">
          <form action={startCheckoutAction}>
            <Button type="submit">Start checkout</Button>
          </form>
          <form action={openCustomerPortalAction}>
            <Button
              type="submit"
              variant="secondary"
              disabled={!billing?.stripe_subscription_id}
            >
              Open Stripe portal
            </Button>
          </form>
        </div>
      </section>
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
      Trialing and active billing states have full MVP access.
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
