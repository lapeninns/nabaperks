import { type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { readBoundedJsonRequest } from "@/lib/http/bounded-json-request"
import { noStoreJson as json } from "@/lib/http/no-store-json"
import { enforcePushMutationRateLimit } from "@/lib/notifications/push-mutation-rate-limit"
import {
  getCustomerNotificationPreferences,
  updateCustomerNotificationPreferences,
} from "@/lib/notifications/push-subscriptions"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_PUSH_MUTATION_BODY_BYTES = 8_192

export async function GET() {
  const customer = await getCurrentCustomer()
  if (!customer) return json({ error: "unauthenticated" }, 401)

  const preferences = await getCustomerNotificationPreferences(customer.id)
  return json({ ok: true, preferences }, 200)
}

export async function POST(request: NextRequest) {
  const customer = await getCurrentCustomer()
  if (!customer) return json({ error: "unauthenticated" }, 401)

  try {
    await enforceRateLimit({
      key: `push-preferences:${customer.id}`,
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
    const error = parsed.status === 400 ? "invalid_preferences" : parsed.error
    return json({ error }, parsed.status)
  }
  const body = parsed.value
  if (!isRecord(body)) return json({ error: "invalid_preferences" }, 400)

  const current = await getCustomerNotificationPreferences(customer.id)
  const preferences = await updateCustomerNotificationPreferences({
    customerId: customer.id,
    transactionalEnabled: booleanValue(
      body.transactionalEnabled,
      current.transactionalEnabled
    ),
    reminderEnabled: booleanValue(
      body.reminderEnabled,
      current.reminderEnabled
    ),
    marketingEnabled: booleanValue(
      body.marketingEnabled,
      current.marketingEnabled
    ),
  })

  return json({ ok: true, preferences }, 200)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}
