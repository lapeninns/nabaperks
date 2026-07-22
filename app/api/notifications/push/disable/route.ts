import { createDisablePushSubscriptionHandler } from "@/app/api/notifications/push/disable-subscription-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Service-worker-initiated revocation: the subscription disappeared or was
 * invalidated at the browser level, so the ledger records the disable as
 * `service_worker_disabled` rather than a customer choice.
 */
export const POST = createDisablePushSubscriptionHandler({
  rateLimitKeyPrefix: "push-disable",
  rateLimitPerMinute: 20,
  reason: "service_worker_disabled",
})
