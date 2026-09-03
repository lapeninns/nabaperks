import { type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { readBoundedJsonRequest } from "@/lib/http/bounded-json-request"
import { noStoreJson as json } from "@/lib/http/no-store-json"
import { enforcePushMutationRateLimit } from "@/lib/notifications/push-mutation-rate-limit"
import {
  disableCustomerPushSubscription,
  normalizePermissionState,
  registerCustomerPushSubscription,
  validatePushEndpoint,
  validatePushSubscriptionInput,
} from "@/lib/notifications/push-subscriptions"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_PUSH_MUTATION_BODY_BYTES = 8_192

export async function POST(request: NextRequest) {
  const customer = await getCurrentCustomer()
  if (!customer) return json({ error: "unauthenticated" }, 401)

  try {
    await enforceRateLimit({
      key: `push-refresh:${customer.id}`,
      limit: 20,
      windowMs: 60_000,
    })
    await enforcePushMutationRateLimit(customer.id)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return json({ error: "rate_limited" }, 429)
    }
    throw error
  }

  const parsed = await readBoundedJsonRequest(
    request,
    MAX_PUSH_MUTATION_BODY_BYTES
  )
  if (!parsed.ok) {
    const error = parsed.status === 400 ? "invalid_subscription" : parsed.error
    return json({ error }, parsed.status)
  }
  const body = parsed.value
  const oldEndpoint = validatePushEndpoint(oldEndpointBody(body))
  if (oldEndpoint) {
    await disableCustomerPushSubscription({
      customerId: customer.id,
      endpoint: oldEndpoint,
      reason: "subscription_refreshed",
    })
  }

  const subscription = validatePushSubscriptionInput(newSubscriptionBody(body))
  if (!subscription.ok) return json({ error: subscription.error }, 400)

  const subscriptionId = await registerCustomerPushSubscription({
    customerId: customer.id,
    subscription: subscription.subscription,
    userAgent: request.headers.get("user-agent"),
    permissionState: normalizePermissionState(
      isRecord(body) ? body.permissionState : null
    ),
  })

  return json({ ok: true, subscriptionId }, 200)
}

function oldEndpointBody(value: unknown) {
  if (!isRecord(value)) return null
  if (typeof value.oldEndpoint === "string") return value.oldEndpoint
  return isRecord(value.oldSubscription) ? value.oldSubscription.endpoint : null
}

function newSubscriptionBody(value: unknown) {
  return isRecord(value) && "subscription" in value ? value.subscription : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
