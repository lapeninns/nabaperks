import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { drainQrStatusEmails } from "@/lib/notifications/qr-status-worker"
import { runObservedCron } from "@/lib/observability/cron-run"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request))
    return noStoreJson({ error: "unauthorized" }, 401)
  const observed = await runObservedCron({
    job: "qr-status-email-drain",
    run: () => drainQrStatusEmails(),
    isSuccessful: (value) => value.failed === 0,
  })
  return observed.ok
    ? noStoreJson({ ok: true, result: observed.value })
    : noStoreJson({ ok: false, error: "cron_failed" }, 500)
}
