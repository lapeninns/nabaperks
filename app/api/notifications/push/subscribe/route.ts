import { type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { readBoundedJsonRequest } from "@/lib/http/bounded-json-request"
import { noStoreJson as json } from "@/lib/http/no-store-json"
import { enforcePushMutationRateLimit } from "@/lib/notifications/push-mutation-rate-limit"
import {
  normalizePermissionState,
  registerCustomerPushSubscription,
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
      key: `push-subscribe:${customer.id}`,
      limit: 12,
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
  const subscription = validatePushSubscriptionInput(subscriptionBody(body))

  if (!subscription.ok) {
    return json({ error: subscription.error }, 400)
  }

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

function subscriptionBody(value: unknown) {
  return isRecord(value) && "subscription" in value ? value.subscription : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
