import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { runMerchantWeeklyDigest } from "@/lib/notifications/merchant-digest"
import { runObservedCron } from "@/lib/observability/cron-run"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson({ error: "unauthorized" }, 401)
  }

  const observed = await runObservedCron({
    job: "merchant-digest",
    run: () => runMerchantWeeklyDigest(),
    isSuccessful: (result) => !result.notConfigured && result.failed === 0,
    failureCode: (result) =>
      result.notConfigured ? "provider_unconfigured" : "delivery_failed",
  })

  return observed.ok
    ? noStoreJson({ ok: true, result: observed.value })
    : noStoreJson({ ok: false, error: "cron_failed" }, 500)
}
