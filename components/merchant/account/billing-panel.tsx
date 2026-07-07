import Link from "next/link"
import { redirect } from "next/navigation"

import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/app/billing/actions"
import { ArrowRight01Icon, CreditCardIcon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, ReceiptCard, SectionHeader } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import {
  MerchantBillingAccessNote,
  shouldShowMerchantDashboardBillingNotice,
} from "@/components/merchant/billing-status"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"
import { PRODUCT } from "@/lib/marketing/facts"
import { BILLING_LAUNCH_TAB_PATH } from "@/lib/merchant/billing-nav"
import { completeBillingCheckoutReturn } from "@/lib/merchant/billing-checkout-return"
import {
  getMerchantBilling,
  getMerchantBillingFresh,
  type MerchantBilling,
} from "@/lib/merchant/billing"

const SHOW_LOCAL_STRIPE_WEBHOOK_NOTE = process.env.NODE_ENV !== "production"

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

  let checkoutSyncFailed = false

  if (params.checkout === "success") {
    try {
      await completeBillingCheckoutReturn(merchant.id)
    } catch (error) {
      checkoutSyncFailed = true
      console.error(
        "[billing] checkout return sync failed",
        error instanceof Error ? error.message : error
      )
    }
  }

  const result =
    params.checkout === "success"
      ? await getMerchantBillingFresh(merchant.id)
      : await getMerchantBilling(merchant.id)
  const billing = result.ok ? result.billing : null
  const billingLoadFailed = !result.ok
  const billingReturnTo =
    mode === "setup" ? BILLING_LAUNCH_TAB_PATH : undefined

  const status = billing?.status ?? "not_started"
  const needsBillingAttention = shouldShowMerchantDashboardBillingNotice(status)
  const needsCardToActivate = status === "not_started"
  const setupActivation = mode === "setup" && needsCardToActivate
  // The annual option only appears once the operator has created the annual
  // Stripe Price and set STRIPE_GROWTH_ANNUAL_PRICE_ID; until then, monthly only.
  const annualBillingAvailable = Boolean(
    process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID
  )

  return (
    <section className="grid gap-3 sm:gap-4">
      <BillingOutcomeMessages
        checkout={params.checkout}
        portal={params.portal}
        checkoutSyncFailed={checkoutSyncFailed}
      />

      {billingLoadFailed ? (
        <StatusBanner tone="error" title="Billing details could not be loaded">
          This is usually temporary.{" "}
          {/* A real control, not bare prose — the force-dynamic tab refetches
              billing on navigation. */}
          <Link
            href={
              mode === "setup"
                ? "/app/launch?tab=billing"
                : "/app/account?tab=billing"
            }
            className="font-bold underline underline-offset-4"
          >
            Try again
          </Link>
          .
        </StatusBanner>
      ) : null}

      {setupActivation ? (
        <SetupBillingActivationCard
          annualBillingAvailable={annualBillingAvailable}
          billingReturnTo={billingReturnTo}
        />
      ) : (
        <AccountBillingCard
          mode={mode}
          billing={billing}
          needsBillingAttention={needsBillingAttention}
          needsCardToActivate={needsCardToActivate}
          status={status}
          annualBillingAvailable={annualBillingAvailable}
          billingReturnTo={billingReturnTo}
        />
      )}
    </section>
  )
}

/** Final launch step — plan facts, one primary action, no duplicate copy. */
function SetupBillingActivationCard({
  annualBillingAvailable,
  billingReturnTo,
}: {
  annualBillingAvailable: boolean
  billingReturnTo?: string
}) {
  return (
    <ReceiptCard
      edge
      padding="sm"
      className="grid gap-4 sm:[--card-spacing:--spacing(6)] sm:gap-5"
    >
      <div className="grid gap-2">
        <Eyebrow>Step 5 of 5 · Billing</Eyebrow>
        <h2 className="text-lg leading-snug font-extrabold text-foreground sm:text-xl">
          Your account is created
        </h2>
        <p className="text-sm leading-6 text-pretty text-muted-foreground">
          Add a card through Stripe to activate your venue and start accepting
          stamps.
        </p>
      </div>

      <dl className="grid gap-0 rounded-lg border border-border bg-secondary/40 px-3 py-1 text-sm">
        <PlanRow label="Free trial" value="30 days" />
        <PlanRow label="Then" value="£49 a month" />
        <PlanRow label="Billed" value="Per location" />
      </dl>

      <div className="grid gap-2">
        <form action={startCheckoutAction.bind(null, "month")}>
          {billingReturnTo ? (
            <input type="hidden" name="returnTo" value={billingReturnTo} />
          ) : null}
          <Button type="submit" className="w-full">
            <Icon icon={CreditCardIcon} size={16} />
            Proceed to billing · {PRODUCT.priceShort}
          </Button>
        </form>
        {annualBillingAvailable ? (
          <form action={startCheckoutAction.bind(null, "year")}>
            {billingReturnTo ? (
              <input type="hidden" name="returnTo" value={billingReturnTo} />
            ) : null}
            <Button type="submit" variant="outline" className="w-full">
              Pay yearly · {PRODUCT.priceAnnual} · {PRODUCT.annualSaving}
            </Button>
          </form>
        ) : null}
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Secure checkout via Stripe. Cancel anytime during the trial.
        </p>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        <Link
          href="/app/account?tab=billing"
          className="font-bold text-foreground underline decoration-2 underline-offset-4"
        >
          Manage billing in Account
        </Link>{" "}
        once your venue is live.
      </p>
    </ReceiptCard>
  )
}

function AccountBillingCard({
  mode,
  billing,
  needsBillingAttention,
  needsCardToActivate,
  status,
  annualBillingAvailable,
  billingReturnTo,
}: {
  mode: "account" | "setup"
  billing: MerchantBilling | null
  needsBillingAttention: boolean
  needsCardToActivate: boolean
  status: string
  annualBillingAvailable: boolean
  billingReturnTo?: string
}) {
  // The Stripe portal only exists once a customer is created. Keep the button
  // focusable (aria-disabled, not native disabled) and announce the reason via
  // the helper text below; the server action stays the real guard — it redirects
  // to `?portal=missing` when there is no customer id, so a stray submit is inert.
  const portalUnavailable = !billing?.stripe_customer_id

  return (
    <ReceiptCard edge className="grid gap-5">
      <SectionHeader
        eyebrow={mode === "setup" ? "Step 5 of 5 · Billing" : "Your plan"}
        title={needsCardToActivate ? "Activate your venue" : "Growth Plan"}
        description={
          needsCardToActivate
            ? "Add a card through Stripe to activate your venue — the first 30 days are free."
            : "Everything on this receipt updates by itself once your Stripe checkout is done."
        }
      />

      <dl className="grid gap-0 text-sm">
        <PlanRow label="Free trial" value="30 days" />
        <PlanRow label="Then" value="£49 a month" />
        <PlanRow label="Billed" value="Per location" />
      </dl>

      {needsBillingAttention ? (
        <MerchantBillingAccessNote status={status} />
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          {billing?.current_period_end
            ? `Your current period ends ${formatDate(billing.current_period_end)}.`
            : "Your billing period will show here once checkout is done."}
        </p>
      )}

      <div className="grid gap-4 border-t-2 border-dashed border-ink/20 pt-5">
        <div className="flex flex-wrap gap-2">
          {needsCardToActivate ? (
            <>
              <form action={startCheckoutAction.bind(null, "month")}>
                {billingReturnTo ? (
                  <input type="hidden" name="returnTo" value={billingReturnTo} />
                ) : null}
                <Button type="submit">
                  <Icon icon={CreditCardIcon} size={16} />
                  Start checkout · {PRODUCT.priceShort}
                </Button>
              </form>
              {annualBillingAvailable ? (
                <form action={startCheckoutAction.bind(null, "year")}>
                  {billingReturnTo ? (
                    <input
                      type="hidden"
                      name="returnTo"
                      value={billingReturnTo}
                    />
                  ) : null}
                  <Button type="submit" variant="outline">
                    Pay yearly · {PRODUCT.annualSaving}
                  </Button>
                </form>
              ) : null}
            </>
          ) : null}
          <form action={openCustomerPortalAction}>
            {billingReturnTo ? (
              <input type="hidden" name="returnTo" value={billingReturnTo} />
            ) : null}
            <Button
              type="submit"
              variant={
                needsCardToActivate || portalUnavailable
                  ? "secondary"
                  : "default"
              }
              aria-disabled={portalUnavailable || undefined}
              aria-describedby={
                portalUnavailable ? "billing-portal-help" : undefined
              }
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              Open Stripe portal
              <Icon icon={ArrowRight01Icon} size={16} />
            </Button>
          </form>
        </div>
        <p
          id="billing-portal-help"
          className="text-xs leading-5 text-muted-foreground"
        >
          {portalUnavailable
            ? "Start checkout to add your card and activate the venue."
            : "Manage your card and invoices in the Stripe portal."}
        </p>
      </div>
    </ReceiptCard>
  )
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-ink/15 py-2 last:border-b-0 sm:py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}

function BillingOutcomeMessages({
  checkout,
  portal,
  checkoutSyncFailed = false,
}: {
  checkout?: string
  portal?: string
  checkoutSyncFailed?: boolean
}) {
  const hasBanner =
    checkout === "success" ||
    checkout === "cancelled" ||
    portal === "missing" ||
    checkoutSyncFailed

  // No outcome params -> render nothing so the parent grid gap doesn't reserve a
  // phantom band on the default view.
  if (!hasBanner) {
    return null
  }

  return (
    <div className="grid gap-3">
      {checkoutSyncFailed ? (
        <StatusBanner tone="error" title="Billing sync is still catching up">
          Checkout finished in Stripe, but we could not refresh your billing
          status yet. Refresh this page in a moment or check that your Stripe
          keys and webhook listener are configured for local dev.
        </StatusBanner>
      ) : null}
      {checkout === "success" && !checkoutSyncFailed ? (
        <StatusBanner tone="success" title="Checkout completed">
          <div className="grid gap-2">
            <p>Your billing is active and your launch checklist should reflect it now.</p>
            {SHOW_LOCAL_STRIPE_WEBHOOK_NOTE ? (
              <p className="text-xs leading-5">
                Local dev: keep the Stripe webhook listener running with{" "}
                <code className="font-mono break-all">
                  stripe listen --forward-to localhost:3000/api/stripe/webhook
                </code>{" "}
                and restart after setting STRIPE_WEBHOOK_SECRET so future
                renewals sync automatically.
              </p>
            ) : null}
          </div>
        </StatusBanner>
      ) : null}
      {checkout === "cancelled" ? (
        <StatusBanner tone="warning" title="Checkout cancelled">
          You can restart the Growth Plan checkout when you are ready.
        </StatusBanner>
      ) : null}
      {portal === "missing" ? (
        <StatusBanner tone="error" title="No Stripe customer yet">
          Start checkout before opening the Stripe portal.
        </StatusBanner>
      ) : null}
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value))
}
