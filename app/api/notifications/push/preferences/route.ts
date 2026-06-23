import { NextResponse, type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  getCustomerNotificationPreferences,
  updateCustomerNotificationPreferences,
} from "@/lib/notifications/push-subscriptions"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  } catch (error) {
    if (error instanceof RateLimitError) {
      return json({ error: "rate_limited" }, 429)
    }
    throw error
  }

  const body = await request.json().catch(() => null)
  if (!isRecord(body)) return json({ error: "invalid_preferences" }, 400)

  const current = await getCustomerNotificationPreferences(customer.id)
  const preferences = await updateCustomerNotificationPreferences({
    customerId: customer.id,
    transactionalEnabled: booleanValue(
      body.transactionalEnabled,
      current.transactionalEnabled
    ),
    reminderEnabled: booleanValue(body.reminderEnabled, current.reminderEnabled),
    marketingEnabled: booleanValue(
      body.marketingEnabled,
      current.marketingEnabled
    ),
  })

  return json({ ok: true, preferences }, 200)
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0" },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}
