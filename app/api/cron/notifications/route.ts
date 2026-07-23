import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { runPushNotificationDeliveryWorker } from "@/lib/notifications/delivery-worker"
import { runObservedCron } from "@/lib/observability/cron-run"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson({ error: "unauthorized" }, 401)
  }

  // Drain budget (notifications drain throughput): up to five 100-event
  // batches per tick, stopping after 240s so the run stays inside
  // maxDuration with headroom. Producers add up to ~200 events/tick, so a
  // 500-event budget retires backlog 2.5x faster than it grows.
  const observed = await runObservedCron({
    job: "notifications",
    run: () =>
      runPushNotificationDeliveryWorker({
        batchSize: 100,
        maxEvents: 500,
        timeBudgetMs: 240_000,
      }),
  })

  return observed.ok
    ? noStoreJson({ ok: true, result: observed.value })
    : noStoreJson({ ok: false, error: "cron_failed" }, 500)
}
