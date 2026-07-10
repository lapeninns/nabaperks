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
