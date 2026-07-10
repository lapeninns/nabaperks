import { NextResponse, type NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Referral bonus settlement sweep (MS-referral-settlement, SE-10/SE-12). Settles
 * every due referral bonus (qualified/held, next_retry_at ≤ now) through
 * settle_referral_bonus, in concurrency-safe FOR UPDATE SKIP LOCKED batches, once
 * the referrer's card has room and velocity allows. Kept a separate cron from the
 * delivery worker: this WRITES the ledger, the worker DELIVERS. Idempotent and
 * retry-aware, so a missed tick self-heals and a persistent block is retried later.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("drain_due_referral_bonuses", {
    p_limit: 200,
  })

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
