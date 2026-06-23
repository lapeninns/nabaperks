import { NextResponse, type NextRequest } from "next/server"

import { getCurrentMerchant } from "@/lib/auth/session"
import {
  enqueueVenueAnnouncement,
  validateVenueAnnouncementText,
} from "@/lib/notifications/venue-announcements"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const merchant = await getCurrentMerchant()
  if (!merchant) return json({ error: "unauthenticated" }, 401)

  try {
    await enforceRateLimit({
      key: `venue-announcement:${merchant.id}`,
      limit: 4,
      windowMs: 60 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return json({ error: "rate_limited" }, 429)
    }
    throw error
  }

  const body = await request.json().catch(() => null)
  const validated = validateVenueAnnouncementText({
    title: readString(body, "title"),
    body: readString(body, "body"),
  })
  if (!validated.ok) return json({ error: validated.error }, 400)

  const result = await enqueueVenueAnnouncement({
    merchantId: merchant.id,
    businessName: merchant.business_name,
    title: validated.title,
    body: validated.body,
    actorId: merchant.id,
  })

  return json({ ok: true, ...result }, 200)
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0" },
  })
}

function readString(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
