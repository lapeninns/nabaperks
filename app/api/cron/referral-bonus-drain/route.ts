import { NextResponse, type NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * "Bring a Regular" bonus-drain sweep (MS-referral-bonus-stamp, RB-6). Pays every
 * owed-but-unpaid referrer bonus whose invited friend has visited, once the
 * referrer's card has room. Kept a separate cron from the delivery worker: this
 * WRITES the ledger, the worker DELIVERS. Idempotent, so a missed tick self-heals.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("drain_due_referrer_bonuses")

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  return NextResponse.json(
    { ok: true, processed: data ?? 0 },
    { headers: { "cache-control": "no-store, max-age=0" } }
  )
}
