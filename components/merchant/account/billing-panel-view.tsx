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
import { isLaunchBillingReady } from "@/lib/merchant/launch-readiness-core"

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
  cleanupOutcomeQuery = Boolean(outcome),
  requiresBilling = true,
  mode = "account",
  checkoutAction,
  portalAction,
  billingReturnTo,
  billingLoadFailed = false,
  refreshHref,
}: {
  billing: BillingPresentationSource | null
  outcome: BillingPanelOutcome
  cleanupOutcomeQuery?: boolean
  requiresBilling?: boolean
  mode?: "account" | "setup"
  checkoutAction: BillingCheckoutAction
  portalAction?: BillingPortalAction
  billingReturnTo?: string
  billingLoadFailed?: boolean
  refreshHref?: string
}) {
  if (!requiresBilling) {
    return (
      <ComplimentaryBillingAccess
        billing={billing}
        cleanupOutcomeQuery={cleanupOutcomeQuery}
        mode={mode}
        portalAction={portalAction}
        billingReturnTo={billingReturnTo}
        billingLoadFailed={billingLoadFailed}
        refreshHref={refreshHref}
      />
    )
  }

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
      ? "Restart this venue's 28-day billing plan safely."
      : restartableReason === "incomplete_expired"
        ? "Your earlier checkout expired before completion. Try again without creating a duplicate plan."
        : presentation.eligibility.allowed
          ? "Add a card through Stripe to activate your venue — the platform is free for the first 28 days."
          : "Your receipt reflects the latest subscription terms stored from Stripe."

  return (
    <section className="grid min-w-0 gap-3 sm:gap-4">
      {outcome ? <BillingOutcomeBanner outcome={outcome} /> : null}
      {cleanupOutcomeQuery ? <BillingOutcomeQueryCleanup /> : null}

      {billingLoadFailed ? (
        <StatusBanner tone="error" title="Billing details could not be loaded">
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

          <div className="grid gap-3 border-t-2 border-dashed border-line pt-5">
            {presentation.primaryAction.kind === "checkout" ? (
              <BillingCheckoutForm
                checkoutAction={checkoutAction}
                returnTo={billingReturnTo}
                label={
                  billing?.launch_fee_status
                    ? presentation.primaryAction.label + " · " + PRODUCT.price
                    : presentation.primaryAction.label +
                      " · " +
                      PRODUCT.launchFee +
                      " launch · then " +
                      PRODUCT.price
                }
                annualLabel={
                  billing?.launch_fee_status
                    ? presentation.primaryAction.label +
                      " · " +
                      PRODUCT.annualPrice
                    : presentation.primaryAction.label +
                      " · " +
                      PRODUCT.launchFee +
                      " launch · then " +
                      PRODUCT.annualPrice
                }
              />
            ) : presentation.primaryAction.kind === "portal" && portalAction ? (
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <form action={portalAction}>
                  {billingReturnTo ? (
                    <input
                      type="hidden"
                      name="returnTo"
                      value={billingReturnTo}
                    />
                  ) : null}
                  <Button type="submit" className="w-full sm:w-fit">
                    Update payment method
                    <Icon icon={ArrowRight01Icon} size={16} />
                  </Button>
                </form>
                <Button asChild variant="secondary" className="w-full sm:w-fit">
                  <Link href="/app/account/cancel">
                    Review cancellation options
                  </Link>
                </Button>
              </div>
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
                : "Update your payment method in Stripe, or complete the short exit review before cancelling."}
            </p>
          </div>
        </ReceiptCard>
      ) : null}
    </section>
  )
}

function ComplimentaryBillingAccess({
  billing,
  cleanupOutcomeQuery,
  mode,
  portalAction,
  billingReturnTo,
  billingLoadFailed,
  refreshHref,
}: {
  billing: BillingPresentationSource | null
  cleanupOutcomeQuery: boolean
  mode: "account" | "setup"
  portalAction?: BillingPortalAction
  billingReturnTo?: string
  billingLoadFailed: boolean
  refreshHref?: string
}) {
  const hasStripeCustomer = Boolean(billing?.stripe_customer_id)

  return (
    <section className="grid min-w-0 gap-3 sm:gap-4">
      {cleanupOutcomeQuery ? <BillingOutcomeQueryCleanup /> : null}

      {billingLoadFailed ? (
        <StatusBanner
          tone="error"
          title="Existing billing details could not be checked"
        >
          Your complimentary access is unaffected.{" "}
          {refreshHref ? (
            <Link
              href={refreshHref}
              className="font-bold underline underline-offset-4"
            >
              Try again
            </Link>
          ) : null}
          {refreshHref ? "." : null}
        </StatusBanner>
      ) : null}

      <ReceiptCard edge className="grid min-w-0 gap-5">
        <SectionHeader
          eyebrow={mode === "setup" ? "Billing" : "Your plan"}
          title="Complimentary access"
          description="This venue has complimentary access. No new card or Stripe subscription is required."
        />

        <dl className="grid gap-0 rounded-lg border-2 border-ink/20 bg-secondary/40 px-4 py-2 text-sm">
          <PlanRow label="Access" value="Active" />
          <PlanRow label="Cost" value="£0" />
          <PlanRow label="Billing" value="Not required" />
        </dl>

        {/* This one banner keeps its <h2>. 03#59 removed heading elements from
            StatusBanner titles, which is right in general — a banner should not
            smuggle a rank into the document outline. But on the complimentary
            branch this banner IS the section's heading (there is no other), and
            merchant-billing-recovery asserts
            getByRole("heading", { name: "Billing access is active" }).
            The other three titles 03#59 flattened stay plain strings. */}
        <StatusBanner tone="success" title={<h2>Billing access is active</h2>}>
          You can use every included merchant feature without starting a new
          payment plan. Venue launch status is shown separately.
        </StatusBanner>

        {hasStripeCustomer && portalAction ? (
          <div className="grid gap-2 border-t-2 border-dashed border-line pt-5">
            <p className="text-sm leading-6 text-muted-foreground">
              An existing Stripe customer is still linked to this venue. You can
              manage its card, invoices, or subscription without starting a new
              checkout.
            </p>
            <form action={portalAction}>
              {billingReturnTo ? (
                <input type="hidden" name="returnTo" value={billingReturnTo} />
              ) : null}
              <Button type="submit" className="w-full sm:w-fit">
                Manage existing Stripe billing
                <Icon icon={ArrowRight01Icon} size={16} />
              </Button>
            </form>
          </div>
        ) : null}
      </ReceiptCard>
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
    // The money surface: a 2px ink-tinted rule and py-2 gutters rather than the
    // system's thinnest 1px border and 4px of padding, which left the first and
    // last PlanRow separators flush against the container edge (03#58).
    <dl className="grid gap-0 rounded-lg border-2 border-ink/20 bg-secondary/40 px-4 py-2 text-sm">
      {receipt.kind === "unknown" ? (
        <PlanRow label="Plan details" value={receipt.message} />
      ) : receipt.kind === "cycle" ? (
        <>
          <PlanRow label="Free pilot" value="28 days" />
          <PlanRow
            label="Then"
            value={`${receipt.amountLabel} every 28 days`}
          />
          <PlanRow
            label="Recurring year"
            value="£909.87 across 13 payments per 364 days"
          />
        </>
      ) : receipt.kind === "monthly" ? (
        <>
          <PlanRow
            label="Historical monthly plan"
            value={`${receipt.amountLabel} a month`}
          />
          <PlanRow label="Availability" value="Closed to new customers" />
        </>
      ) : (
        <>
          <PlanRow
            label="Annual plan"
            value={`${receipt.amountLabel} a year`}
          />
          <PlanRow label="Payment" value="Paid upfront after the pilot" />
        </>
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
    // <h2>, like the complimentary banner above. 03#59 flattened these to
    // plain strings, but the billing outcome banner IS the section's heading on
    // every Stripe return path, and merchant-billing-recovery asserts
    // getByRole("heading") for "Checkout confirmed", "Billing details
    // refreshed" and "Billing not confirmed".
    <StatusBanner tone={model.tone} title={<h2>{model.title}</h2>}>
      <span className="grid gap-3">
        <span>{model.message}</span>
        {outcome.kind === "confirmed" &&
        isLaunchBillingReady({
          requiresBilling: true,
          status: outcome.status,
        }) ? (
          <Button asChild className="w-full sm:w-fit">
            <Link href="/app/launch?tab=qr">
              See your venue QR
              <Icon icon={ArrowRight01Icon} size={16} />
            </Link>
          </Button>
        ) : null}
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
          ? "Stripe is holding recurring billing while your delivery-anchored platform pilot is prepared. See the poster and pilot dates below."
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
