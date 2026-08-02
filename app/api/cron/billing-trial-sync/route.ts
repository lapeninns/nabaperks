import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { runObservedCron } from "@/lib/observability/cron-run"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"
import { runBillingTrialSync } from "@/lib/stripe/trial-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson({ error: "unauthorized" }, 401)
  }

  const observed = await runObservedCron({
    job: "billing-trial-sync",
    run: () => runBillingTrialSync(),
    isSuccessful: (result) => result.failed === 0,
    failureCode: () => "trial_sync_item_failed",
  })

  return observed.ok
    ? noStoreJson({ ok: true, result: observed.value })
    : noStoreJson({ ok: false, error: "cron_failed" }, 500)
}
