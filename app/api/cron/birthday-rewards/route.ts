import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { runObservedCron } from "@/lib/observability/cron-run"
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

  const observed = await runObservedCron({
    job: "birthday-rewards",
    run: async () => {
      const supabase = createSupabaseServiceRoleClient()
      const { data, error } = await supabase.rpc("issue_birthday_rewards")
      if (error) throw new Error("Birthday reward sweep failed")
      return typeof data === "number" ? data : 0
    },
  })

  return observed.ok
    ? noStoreJson({ ok: true, issued: observed.value })
    : noStoreJson({ ok: false, error: "cron_failed" }, 500)
}
