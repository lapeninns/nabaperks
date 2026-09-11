/**
 * Shared production rule for merchant self-serve cancellation.
 *
 * A subscription is cancellable only when Stripe has a subscription id and the
 * local status is still trialing, active, or past_due. Missing billing, a
 * cancelled row, or any other status must not render the exit interview.
 */

const CANCELLABLE_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
] as const

export function isCancellableMerchantSubscription(
  billing:
    | {
        readonly stripe_subscription_id?: string | null
        readonly status?: string | null
      }
    | null
    | undefined
): boolean {
  return Boolean(
    billing?.stripe_subscription_id &&
      billing.status &&
      (CANCELLABLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(
        billing.status
      )
  )
}
