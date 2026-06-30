export type CustomerNotificationDeliveryIssue =
  | "none"
  | "temporary_failure"
  | "subscription_expired"
  | "delivery_failed"
  | "skipped"

export type CustomerNotificationDeliveryReadback = {
  readonly status: string
  readonly attemptNumber: number
  readonly issue: CustomerNotificationDeliveryIssue
  readonly createdAt: string
}

export type CustomerNotificationDeliveryReadbackSource = {
  readonly status: string
  readonly attemptNumber: number
  readonly responseStatus: number | null
  readonly failureReason: string | null
  readonly createdAt: string
}

export function shapeCustomerNotificationDeliveryReadback(
  source: CustomerNotificationDeliveryReadbackSource
): CustomerNotificationDeliveryReadback {
  return {
    status: source.status,
    attemptNumber: source.attemptNumber,
    issue: customerNotificationDeliveryIssue(source),
    createdAt: source.createdAt,
  }
}

function customerNotificationDeliveryIssue(
  source: CustomerNotificationDeliveryReadbackSource
): CustomerNotificationDeliveryIssue {
  if (source.status === "sent") return "none"
  if (source.status === "skipped") return "skipped"
  if (isExpiredSubscriptionFailure(source)) return "subscription_expired"
  if (source.status === "retryable_failure") return "temporary_failure"
  if (source.status === "permanent_failure") return "delivery_failed"
  return source.responseStatus === null && source.failureReason === null
    ? "none"
    : "delivery_failed"
}

function isExpiredSubscriptionFailure(
  source: CustomerNotificationDeliveryReadbackSource
) {
  const reason = source.failureReason?.toLowerCase() ?? ""

  return (
    source.responseStatus === 404 ||
    source.responseStatus === 410 ||
    reason.includes("expired") ||
    reason.includes("gone")
  )
}
