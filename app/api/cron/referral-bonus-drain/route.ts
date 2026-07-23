import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { runObservedCron } from "@/lib/observability/cron-run"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Referral bonus settlement sweep (referral settlement, SE-10/SE-12). Settles
 * every due referral bonus (qualified/held, next_retry_at ≤ now) through
 * settle_referral_bonus, in concurrency-safe FOR UPDATE SKIP LOCKED batches, once
 * the referrer's card has room and velocity allows. Kept a separate cron from the
 * delivery worker: this WRITES the ledger, the worker DELIVERS. Idempotent and
 * retry-aware, so a missed tick self-heals and a persistent block is retried later.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson({ error: "unauthorized" }, 401)
  }

  const observed = await runObservedCron({
    job: "referral-bonus-drain",
    run: async () => {
      const supabase = createSupabaseServiceRoleClient()
      const { data, error } = await supabase.rpc("drain_due_referral_bonuses", {
        p_limit: 200,
      })
      if (error) throw new Error("Referral bonus drain failed")
      return typeof data === "number" ? data : 0
    },
  })

  return observed.ok
    ? noStoreJson({ ok: true, processed: observed.value })
    : noStoreJson({ ok: false, error: "cron_failed" }, 500)
}
