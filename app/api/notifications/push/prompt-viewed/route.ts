import { NextResponse } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { recordPushPermissionPromptViewed } from "@/lib/notifications/push-subscriptions"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const customer = await getCurrentCustomer()
  if (!customer) return json({ error: "unauthenticated" }, 401)

  try {
    await enforceRateLimit({
      key: `push-prompt-viewed:${customer.id}`,
      limit: 12,
      windowMs: 60_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return json({ error: "rate_limited" }, 429)
    }
    throw error
  }

  await recordPushPermissionPromptViewed(customer.id)
  return json({ ok: true }, 200)
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0" },
  })
}
