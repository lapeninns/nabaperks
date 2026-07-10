import {
  classifyCheckoutEligibility,
  type CheckoutEligibility,
} from "@/lib/merchant/billing-checkout-core"

export type BillingPresentationSource = {
  status?: string | null
  stripe_subscription_status?: string | null
  stripe_customer_id?: string | null
  billing_interval?: string | null
  unit_amount?: number | null
  currency?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
  cancel_at?: string | null
}

export type BillingReceiptModel =
  | {
      kind: "monthly" | "annual"
      amountLabel: string
      cadenceLabel: "per month" | "per year"
      summary: string
    }
  | {
      kind: "unknown"
      message: "Stripe details are still syncing."
    }

export type BillingPrimaryAction =
  | {
      kind: "checkout"
      intent: "start" | "restart" | "retry"
      label: "Proceed to billing" | "Restart billing" | "Try checkout again"
    }
  | { kind: "portal"; label: "Open Stripe portal" }
  | {
      kind: "recovery"
      label: "Refresh billing"
      message: string
    }

export type BillingPresentation = {
  eligibility: CheckoutEligibility
  receipt: BillingReceiptModel
  primaryAction: BillingPrimaryAction
  periodMessage: string | null
}

const UNKNOWN_RECEIPT: BillingReceiptModel = {
  kind: "unknown",
  message: "Stripe details are still syncing.",
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

function formatBillingDate(value: string | null | undefined): string | null {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date)
}

function buildReceipt(
  source: BillingPresentationSource | null
): BillingReceiptModel {
  if (!source) return UNKNOWN_RECEIPT

  const { billing_interval: interval, unit_amount: amount, currency } = source

  if (
    (interval !== "month" && interval !== "year") ||
    !Number.isSafeInteger(amount) ||
    (amount ?? -1) < 0 ||
    !currency ||
    !/^[a-z]{3}$/i.test(currency)
  ) {
    return UNKNOWN_RECEIPT
  }

  try {
    const amountLabel = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: (amount as number) % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format((amount as number) / 100)
    const monthly = interval === "month"
    const cadenceLabel = monthly ? "per month" : "per year"

    return {
      kind: monthly ? "monthly" : "annual",
      amountLabel,
      cadenceLabel,
      summary: `${amountLabel} ${cadenceLabel}`,
    }
  } catch {
    return UNKNOWN_RECEIPT
  }
}

function effectiveEligibilityStatus(
  source: BillingPresentationSource | null
): string | null {
  if (!source) return null

  if (source.stripe_subscription_status === "incomplete_expired") {
    return "incomplete_expired"
  }

  if (
    source.status === "cancelled" ||
    source.stripe_subscription_status === "canceled"
  ) {
    return "cancelled"
  }

  return (
    source.status ?? source.stripe_subscription_status ?? "unknown_subscription"
  )
}

function buildPrimaryAction(
  source: BillingPresentationSource | null,
  eligibility: CheckoutEligibility
): BillingPrimaryAction {
  if (eligibility.allowed) {
    if (eligibility.reason === "cancelled") {
      return { kind: "checkout", intent: "restart", label: "Restart billing" }
    }

    if (eligibility.reason === "incomplete_expired") {
      return {
        kind: "checkout",
        intent: "retry",
        label: "Try checkout again",
      }
    }

    return { kind: "checkout", intent: "start", label: "Proceed to billing" }
  }

  if (source?.stripe_customer_id) {
    return { kind: "portal", label: "Open Stripe portal" }
  }

  return {
    kind: "recovery",
    label: "Refresh billing",
    message:
      "Stripe billing exists, but its management link is still syncing. Refresh before trying again.",
  }
}

function buildPeriodMessage(
  source: BillingPresentationSource | null
): string | null {
  if (!source) return null

  if (source.cancel_at_period_end) {
    const cancellationDate = formatBillingDate(source.cancel_at)
    return cancellationDate
      ? `Cancels on ${cancellationDate}.`
      : "Cancellation is scheduled in Stripe."
  }

  const periodEnd = formatBillingDate(source.current_period_end)
  return periodEnd ? `Current period ends ${periodEnd}.` : null
}

/** Build truthful receipt and action copy from the authoritative billing row. */
export function buildBillingPresentation(
  source: BillingPresentationSource | null
): BillingPresentation {
  const eligibility = classifyCheckoutEligibility(
    effectiveEligibilityStatus(source)
  )

  return {
    eligibility,
    receipt: buildReceipt(source),
    primaryAction: buildPrimaryAction(source, eligibility),
    periodMessage: buildPeriodMessage(source),
  }
}
