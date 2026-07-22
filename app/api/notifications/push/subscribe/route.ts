import { type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { noStoreJson as json } from "@/lib/http/no-store-json"
import {
  normalizePermissionState,
  registerCustomerPushSubscription,
  validatePushSubscriptionInput,
} from "@/lib/notifications/push-subscriptions"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const customer = await getCurrentCustomer()
  if (!customer) return json({ error: "unauthenticated" }, 401)

  try {
    await enforceRateLimit({
      key: `push-subscribe:${customer.id}`,
      limit: 12,
      windowMs: 60_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return json({ error: "rate_limited" }, 429)
    }
    throw error
  }

  const body = await request.json().catch(() => null)
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
