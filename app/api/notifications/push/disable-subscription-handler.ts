import { type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { noStoreJson as json } from "@/lib/http/no-store-json"
import { pushEndpointFromBody } from "@/lib/notifications/push-subscription-input"
import {
  disableCustomerPushSubscription,
  validatePushEndpoint,
} from "@/lib/notifications/push-subscriptions"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

/**
 * Shared implementation for the push `disable` and `unsubscribe` routes. Both
 * revoke one of the current customer's push subscriptions and differ only in
 * their rate-limit budget and the audited lifecycle reason. Customer scope
 * always comes from the session — never from the request body.
 */
export function createDisablePushSubscriptionHandler({
  rateLimitKeyPrefix,
  rateLimitPerMinute,
  reason,
}: {
  readonly rateLimitKeyPrefix: "push-disable" | "push-unsubscribe"
  readonly rateLimitPerMinute: number
  readonly reason: "service_worker_disabled" | "customer_disabled"
}) {
  return async function POST(request: NextRequest) {
    const customer = await getCurrentCustomer()
    if (!customer) return json({ error: "unauthenticated" }, 401)

    try {
      await enforceRateLimit({
        key: `${rateLimitKeyPrefix}:${customer.id}`,
        limit: rateLimitPerMinute,
        windowMs: 60_000,
      })
    } catch (error) {
      if (error instanceof RateLimitError) {
        return json({ error: "rate_limited" }, 429)
      }
      throw error
    }

    const body = await request.json().catch(() => null)
    const endpoint = validatePushEndpoint(pushEndpointFromBody(body))
    if (!endpoint) return json({ error: "invalid_subscription" }, 400)

    await disableCustomerPushSubscription({
      customerId: customer.id,
      endpoint,
      reason,
    })

    return json({ ok: true }, 200)
  }
}
