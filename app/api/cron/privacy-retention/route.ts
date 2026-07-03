import { NextResponse, type NextRequest } from "next/server"

import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STALE_CUSTOMER_PII_RETENTION_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  const cutoff = new Date(
    Date.now() - STALE_CUSTOMER_PII_RETENTION_DAYS * DAY_MS
  ).toISOString()
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("admin_purge_stale_customer_pii", {
    p_cutoff: cutoff,
  })

  if (error) {
    logger.warn("privacy_retention_purge_failed", { reason: error.message })
    return NextResponse.json(
      { error: "purge_failed" },
      { status: 500, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  // Expire + scrub lapsed reward invites, and hard-delete old terminal ones. A
  // failure here is logged but does not fail the customer-PII purge above.
  const { data: expiredInvites, error: inviteError } = await supabase.rpc(
    "expire_and_purge_reward_invites"
  )
  if (inviteError) {
    logger.warn("privacy_retention_invite_purge_failed", {
      reason: inviteError.message,
    })
  }

  return NextResponse.json(
    {
      ok: true,
      result: {
        cutoff,
        purgedCount: typeof data === "number" ? data : 0,
        expiredInviteCount: typeof expiredInvites === "number" ? expiredInvites : 0,
      },
    },
    { headers: { "cache-control": "no-store, max-age=0" } }
  )
}

function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  return request.headers.get("authorization") === `Bearer ${secret}`
}
