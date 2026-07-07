import { NextResponse, type NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily birthday-reward sweep. Kept a separate cron from the 15-min notification
 * worker: this WRITES the ledger, the worker DELIVERS — separate blast radius.
 * Idempotent, so a missed day self-heals on the next tick.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("issue_birthday_rewards")

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  return NextResponse.json(
    { ok: true, issued: data ?? 0 },
    { headers: { "cache-control": "no-store, max-age=0" } }
  )
}
