export type MerchantBillingMilestone = {
  merchantId: string
  eventName:
    | "merchant_billing_reached"
    | "merchant_billing_checkout_started"
    | "merchant_billing_checkout_returned"
  idempotencyKey:
    | "first-entry"
    | "first-session-ready"
    | "first-verified-return"
  source: "merchant_billing" | "stripe_checkout"
}

export type MerchantBillingScheduler = (input: MerchantBillingMilestone) => void

export type MerchantBillingLaunchObservation = {
  merchantId: string
  activeTab: string
  needsBilling: boolean
}

export type MerchantBillingCheckoutPreparationResult =
  | { status: "redirect"; url: string }
  | { status: "error" }

function scheduleBillingMilestone(
  input: MerchantBillingMilestone,
  schedule: MerchantBillingScheduler
): void {
  try {
    schedule(input)
  } catch {
    // Billing render, redirect, and reconciliation remain authoritative.
  }
}

export function scheduleMerchantBillingReachedWith(
  merchantId: string,
  schedule: MerchantBillingScheduler
): void {
  scheduleBillingMilestone(
    {
      merchantId,
      eventName: "merchant_billing_reached",
      idempotencyKey: "first-entry",
      source: "merchant_billing",
    },
    schedule
  )
}

/** Observe only the authoritative launch state that represents billing reach. */
export function scheduleMerchantBillingReachedForLaunchWith(
  input: MerchantBillingLaunchObservation,
  schedule: MerchantBillingScheduler
): void {
  if (input.activeTab !== "billing" || !input.needsBilling) return

  scheduleMerchantBillingReachedWith(input.merchantId, schedule)
}

export function scheduleMerchantBillingCheckoutStartedWith(
  merchantId: string,
  schedule: MerchantBillingScheduler
): void {
  scheduleBillingMilestone(
    {
      merchantId,
      eventName: "merchant_billing_checkout_started",
      idempotencyKey: "first-session-ready",
      source: "stripe_checkout",
    },
    schedule
  )
}

/**
 * Wrap the real Checkout preparation seam. Only a usable redirect is a
 * checkout-started milestone; the exact product result always passes through.
 */
export async function observeMerchantBillingCheckoutPreparationWith<
  Result extends MerchantBillingCheckoutPreparationResult,
>(
  merchantId: string,
  prepare: () => Promise<Result>,
  schedule: MerchantBillingScheduler
): Promise<Result> {
  const result = await prepare()

  if (result.status === "redirect" && result.url.length > 0) {
    scheduleMerchantBillingCheckoutStartedWith(merchantId, schedule)
  }

  return result
}

export function scheduleMerchantBillingCheckoutReturnedWith(
  merchantId: string,
  schedule: MerchantBillingScheduler
): void {
  scheduleBillingMilestone(
    {
      merchantId,
      eventName: "merchant_billing_checkout_returned",
      idempotencyKey: "first-verified-return",
      source: "stripe_checkout",
    },
    schedule
  )
}
