import Link from "next/link"
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
import { getCurrentMerchant } from "@/lib/auth/session"
import { getMerchantBilling } from "@/lib/merchant/billing"

const BILLING_PAGE_ERROR = "Billing details could not be loaded. Try again."

/**
 * Billing tab of the Account hub. Self-loads the signed-in merchant and their
 * Stripe billing row, then states the plan once on a single Wet Ink receipt:
 * the plan facts as receipt lines, the current status, and the two Stripe
 * actions. Checkout/portal still happen through `/app/billing` actions.
 */
export async function BillingPanel({
  params,
  mode = "account",
}: {
  params: { checkout?: string; portal?: string }
  mode?: "account" | "setup"
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
  const needsCardToActivate = status === "not_started"

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

      <ReceiptCard edge className="grid gap-5">
        <SectionHeader
          eyebrow={mode === "setup" ? "Step 5 of 5 · Billing" : "Your plan"}
          title={needsCardToActivate ? "Add a card to activate" : "Growth Plan"}
          description={
            needsCardToActivate
              ? mode === "setup"
                ? "This is the final setup step. Start checkout to add your card and activate the 30-day free trial."
                : "Start checkout to add your card and activate the 30-day free trial."
              : "Everything on this receipt updates by itself once your Stripe checkout is done."
          }
        />

        <dl className="grid gap-0 text-sm">
          <PlanRow label="Free trial" value="30 days" />
          <PlanRow label="Then" value="GBP 29 / month" />
          <PlanRow label="Billed" value="Per location" />
        </dl>

        {needsCardToActivate ? (
          <p className="rounded-lg bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground">
            A card is required before you go live. Stripe starts the
            subscription with 30 days free, then billing begins after the trial.
          </p>
        ) : needsBillingAttention ? (
          <MerchantBillingAccessNote status={status} />
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {billing?.current_period_end
              ? `Your current period ends ${formatDate(billing.current_period_end)}.`
              : "Your billing period will show here once checkout is done."}
          </p>
        )}

        {mode === "setup" ? (
          <p className="text-sm leading-6 text-muted-foreground">
            <Link
              href="/app/account?tab=billing"
              className="font-bold text-foreground underline decoration-2 underline-offset-4"
            >
              Manage billing later in Account
            </Link>{" "}
            once your venue is live.
          </p>
        ) : needsCardToActivate ? (
          <p className="text-sm leading-6 text-muted-foreground">
            <Link
              href="/app/launch?tab=billing"
              className="font-bold text-foreground underline decoration-2 underline-offset-4"
            >
              Add a card to go live
            </Link>{" "}
            from Launch setup.
          </p>
        ) : null}

        <div className="grid gap-4 border-t-2 border-dashed border-ink/20 pt-5">
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
          <p className="text-xs leading-5 text-muted-foreground">
            {billing?.stripe_customer_id
              ? "Manage your card and invoices in the Stripe portal."
              : "Start checkout to add your card and activate the venue."}
          </p>
        </div>
      </ReceiptCard>
    </section>
  )
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-ink/15 py-2.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
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
