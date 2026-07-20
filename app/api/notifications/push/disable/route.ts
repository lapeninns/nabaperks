import { type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { noStoreJson as json } from "@/lib/http/no-store-json"
import {
  disableCustomerPushSubscription,
  validatePushEndpoint,
} from "@/lib/notifications/push-subscriptions"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const customer = await getCurrentCustomer()
  if (!customer) return json({ error: "unauthenticated" }, 401)

  try {
    await enforceRateLimit({
      key: `push-disable:${customer.id}`,
      limit: 20,
      windowMs: 60_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return json({ error: "rate_limited" }, 429)
    }
    throw error
  }

  const body = await request.json().catch(() => null)
  const endpoint = validatePushEndpoint(endpointBody(body))
  if (!endpoint) return json({ error: "invalid_subscription" }, 400)

  await disableCustomerPushSubscription({
    customerId: customer.id,
    endpoint,
    reason: "service_worker_disabled",
  })

  return json({ ok: true }, 200)
}

function endpointBody(value: unknown) {
  if (!isRecord(value)) return null
  if (typeof value.endpoint === "string") return value.endpoint
  return isRecord(value.subscription) ? value.subscription.endpoint : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
