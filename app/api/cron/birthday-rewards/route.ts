import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
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
    return noStoreJson({ error: "unauthorized" }, 401)
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("issue_birthday_rewards")

  if (error) {
    return noStoreJson({ ok: false, error: error.message }, 500)
  }

  return noStoreJson({ ok: true, issued: data ?? 0 })
}
