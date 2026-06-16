import { redirect } from "next/navigation"

import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/app/billing/actions"
import { ArrowRight01Icon, CreditCardIcon } from "@hugeicons/core-free-icons"

import { Icon, ReceiptCard, SectionHeader } from "@/components/brand"
import {
  MerchantBillingAccessNote,
  shouldShowMerchantDashboardBillingNotice,
} from "@/components/merchant/billing-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantBilling } from "@/lib/merchant/billing"

const BILLING_PAGE_ERROR = "Billing details could not be loaded. Try again."

/**
 * Billing tab of the Account hub. Self-loads the signed-in merchant and their
 * Stripe billing row, then stacks the plan facts, status, and actions in one
 * column. Stripe checkout/portal still happen through `/app/billing` actions.
 */
export async function BillingPanel({
  params,
}: {
  params: { checkout?: string; portal?: string }
}) {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const result = await getMerchantBilling(merchant.id)
  const billing = result.ok ? result.billing : null
  const billingLoadFailed = !result.ok

  const status = billing?.status ?? "not_started"
  const needsBillingAttention = shouldShowMerchantDashboardBillingNotice(status)

  return (
    <section className="grid gap-4">
      <BillingOutcomeMessages
        checkout={params.checkout}
        portal={params.portal}
      />

      {billingLoadFailed ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {BILLING_PAGE_ERROR}
        </p>
      ) : null}

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

      {needsBillingAttention ? (
        <MerchantBillingAccessNote status={status} />
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          {billing?.current_period_end
            ? `Your current period ends ${formatDate(billing.current_period_end)}.`
            : "Your billing period will show here once checkout is done."}
        </p>
      )}

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
              <Button type="submit">
                <Icon icon={CreditCardIcon} size={16} />
                Start checkout
              </Button>
            </form>
            <form action={openCustomerPortalAction}>
              <Button
                type="submit"
                variant="secondary"
                disabled={!billing?.stripe_customer_id}
              >
                Open Stripe portal
                <Icon icon={ArrowRight01Icon} size={16} />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </section>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value))
}
