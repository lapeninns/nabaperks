import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Icon, ReceiptCard, SectionHeader } from "@/components/brand"
import {
  StatusBanner,
  type StatusBannerTone,
} from "@/components/loyalty/status-banner"
import {
  PlanRow,
  SetupBillingActivationCard,
} from "@/components/merchant/account/billing-activation-card"
import {
  BillingCheckoutForm,
  type BillingCheckoutAction,
} from "@/components/merchant/account/billing-checkout-form"
import { BillingOutcomeQueryCleanup } from "@/components/merchant/account/billing-outcome-query-cleanup"
import { Button } from "@/components/ui/button"
import { PRODUCT } from "@/lib/marketing/facts"
import {
  buildBillingPresentation,
  type BillingPresentationSource,
} from "@/lib/merchant/billing-presentation"

export type BillingPanelOutcome =
  | { kind: "confirmed"; source: "checkout" | "portal"; status: string }
  | { kind: "missing_session" }
  | {
      kind: "rejected"
      reason:
        | "foreign_session"
        | "wrong_mode"
        | "incomplete_session"
        | "missing_subscription"
        | "customer_mismatch"
        | "stale_session"
    }
  | { kind: "catching_up" }
  | { kind: "checkout_cancelled" }
  | { kind: "portal_missing" }
  | { kind: "action_error" }
  | null

type BillingPortalAction = (formData: FormData) => void | Promise<void>

export function BillingPanelView({
  billing,
  outcome,
  mode = "account",
  annualBillingAvailable,
  checkoutAction,
  portalAction,
  billingReturnTo,
  billingLoadFailed = false,
  refreshHref,
}: {
  billing: BillingPresentationSource | null
  outcome: BillingPanelOutcome
  mode?: "account" | "setup"
  annualBillingAvailable: boolean
  checkoutAction: BillingCheckoutAction
  portalAction?: BillingPortalAction
  billingReturnTo?: string
  billingLoadFailed?: boolean
  refreshHref?: string
}) {
  const presentation = buildBillingPresentation(billing)
  const resolvedRefreshHref =
    refreshHref ??
    (mode === "setup" ? "/app/launch?tab=billing" : "/app/account?tab=billing")
  const periodMessage = billingPeriodMessage(
    billing,
    presentation.periodMessage
  )
  const setupActivation =
    mode === "setup" &&
    presentation.eligibility.allowed &&
    presentation.eligibility.reason === "absent"
  const restartableReason = presentation.eligibility.allowed
    ? presentation.eligibility.reason
    : null
  const panelTitle =
    restartableReason === "cancelled"
      ? `Restart your ${PRODUCT.planName}`
      : restartableReason === "incomplete_expired"
        ? "Finish billing setup"
        : presentation.eligibility.allowed
          ? "Activate your venue"
          : PRODUCT.planName
  const panelDescription =
    restartableReason === "cancelled"
      ? "Choose monthly or annual billing to safely restart this venue's plan."
      : restartableReason === "incomplete_expired"
        ? "Your earlier checkout expired before completion. Try again without creating a duplicate plan."
        : presentation.eligibility.allowed
          ? "Add a card through Stripe to activate your venue — the first 30 days are free."
          : "Your receipt reflects the latest subscription terms stored from Stripe."

  return (
    <section className="grid min-w-0 gap-3 sm:gap-4">
      {outcome ? <BillingOutcomeBanner outcome={outcome} /> : null}
      {outcome ? <BillingOutcomeQueryCleanup /> : null}

      {billingLoadFailed ? (
        <StatusBanner
          tone="error"
          title={<h2>Billing details could not be loaded</h2>}
        >
          This is usually temporary.{" "}
          <Link
            href={resolvedRefreshHref}
            className="font-bold underline underline-offset-4"
          >
            Try again
          </Link>
          .
        </StatusBanner>
      ) : null}

      {!billingLoadFailed && setupActivation ? (
        <SetupBillingActivationCard
          annualBillingAvailable={annualBillingAvailable}
          billingReturnTo={billingReturnTo}
          checkoutAction={checkoutAction}
        />
      ) : !billingLoadFailed ? (
        <ReceiptCard edge className="grid min-w-0 gap-5">
          <SectionHeader
            eyebrow={mode === "setup" ? "Billing" : "Your plan"}
            title={panelTitle}
            description={panelDescription}
          />

          <BillingReceipt billing={billing} />

          {periodMessage ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {periodMessage}
            </p>
          ) : null}

          <div className="grid gap-3 border-t-2 border-dashed border-ink/20 pt-5">
            {presentation.primaryAction.kind === "checkout" ? (
              <BillingCheckoutForm
                checkoutAction={checkoutAction}
                annualBillingAvailable={annualBillingAvailable}
                returnTo={billingReturnTo}
                monthlyLabel={
                  presentation.primaryAction.label + " · " + PRODUCT.price
                }
              />
            ) : presentation.primaryAction.kind === "portal" && portalAction ? (
              <form action={portalAction} className="grid gap-2">
                {billingReturnTo ? (
                  <input
                    type="hidden"
                    name="returnTo"
                    value={billingReturnTo}
                  />
                ) : null}
                <Button type="submit" className="min-h-11 w-full sm:w-fit">
                  Open Stripe portal
                  <Icon icon={ArrowRight01Icon} size={16} />
                </Button>
              </form>
            ) : (
              <div className="grid gap-2">
                <p className="text-sm leading-6 text-muted-foreground">
                  {presentation.primaryAction.kind === "recovery"
                    ? presentation.primaryAction.message
                    : "Stripe billing is still syncing. Refresh before trying again."}
                </p>
                <Button asChild variant="secondary" className="w-full sm:w-fit">
                  <Link href={resolvedRefreshHref}>Refresh billing</Link>
                </Button>
              </div>
            )}

            <p className="text-xs leading-5 text-muted-foreground">
              {presentation.primaryAction.kind === "checkout"
                ? "Secure checkout via Stripe. " +
                  PRODUCT.cancelChip +
                  " from your billing page."
                : "Manage your card and invoices securely in Stripe."}
            </p>
          </div>
        </ReceiptCard>
      ) : null}
    </section>
  )
}

function BillingReceipt({
  billing,
}: {
  billing: BillingPresentationSource | null
}) {
  const receipt = buildBillingPresentation(billing).receipt

  return (
    <dl className="grid gap-0 rounded-lg border border-border bg-secondary/40 px-3 py-1 text-sm">
      <PlanRow label="Free trial" value="30 days" />
      {receipt.kind === "unknown" ? (
        <PlanRow label="Plan details" value={receipt.message} />
      ) : (
        <PlanRow
          label="Then"
          value={
            receipt.amountLabel +
            " a " +
            (receipt.kind === "monthly" ? "month" : "year")
          }
        />
      )}
      <PlanRow label="Billed" value="Per location" />
    </dl>
  )
}

function BillingOutcomeBanner({
  outcome,
}: {
  outcome: Exclude<BillingPanelOutcome, null>
}) {
  const model = billingOutcomeModel(outcome)

  return (
    <StatusBanner tone={model.tone} title={<h2>{model.title}</h2>}>
      <span className="grid gap-3">
        <span>{model.message}</span>
      </span>
    </StatusBanner>
  )
}

function billingOutcomeModel(outcome: Exclude<BillingPanelOutcome, null>): {
  tone: StatusBannerTone
  title: string
  message: string
} {
  if (outcome.kind === "confirmed") {
    if (outcome.source === "portal") {
      return {
        tone: "success",
        title: "Billing details refreshed",
        message: "Your latest Stripe billing details are shown below.",
      }
    }

    return {
      tone: "success",
      title: "Checkout confirmed",
      message:
        outcome.status === "trialing"
          ? "Your 30-day free trial is active. Your venue billing is ready."
          : "Your Growth Plan is active and the receipt below is up to date.",
    }
  }

  if (outcome.kind === "missing_session") {
    return {
      tone: "warning",
      title: "Billing not confirmed",
      message:
        "Stripe did not return a Checkout Session we could verify. Refresh billing or safely try checkout again.",
    }
  }

  if (outcome.kind === "rejected") {
    return {
      tone: "error",
      title: "Billing not confirmed",
      message:
        outcome.reason === "foreign_session"
          ? "That Checkout Session does not match this venue. No billing state was changed."
          : "That Checkout Session could not be verified for this venue. No billing state was changed.",
    }
  }

  if (outcome.kind === "catching_up") {
    return {
      tone: "warning",
      title: "Billing is catching up",
      message:
        "Stripe returned successfully, but the latest subscription state is not available yet. Refresh billing in a moment.",
    }
  }

  if (outcome.kind === "checkout_cancelled") {
    return {
      tone: "warning",
      title: "Checkout cancelled",
      message: "Nothing was charged. You can safely restart checkout below.",
    }
  }

  if (outcome.kind === "portal_missing") {
    return {
      tone: "error",
      title: "No Stripe customer yet",
      message: "Proceed to billing before opening the Stripe portal.",
    }
  }

  return {
    tone: "error",
    title: "Billing was not updated",
    message:
      "The billing action could not be completed. Try again safely below.",
  }
}

function billingPeriodMessage(
  billing: BillingPresentationSource | null,
  fallback: string | null
): string | null {
  if (!billing?.cancel_at_period_end || !billing.cancel_at) return fallback

  const date = new Date(billing.cancel_at)
  if (Number.isNaN(date.getTime())) return fallback

  return (
    "Cancels on " +
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date) +
    "."
  )
}
