import { createDisablePushSubscriptionHandler } from "@/app/api/notifications/push/disable-subscription-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Customer-initiated opt-out from the notification settings UI, audited as
 * `customer_disabled` in the subscription ledger.
 */
export const POST = createDisablePushSubscriptionHandler({
  rateLimitKeyPrefix: "push-unsubscribe",
  rateLimitPerMinute: 12,
  reason: "customer_disabled",
})
