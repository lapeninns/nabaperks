import { NextResponse, type NextRequest } from "next/server"

import { runPushNotificationDeliveryWorker } from "@/lib/notifications/delivery-worker"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  // Drain budget (notifications drain throughput): up to five 100-event
  // batches per tick, stopping after 240s so the run stays inside
  // maxDuration with headroom. Producers add up to ~200 events/tick, so a
  // 500-event budget retires backlog 2.5x faster than it grows.
  const result = await runPushNotificationDeliveryWorker({
    batchSize: 100,
    maxEvents: 500,
    timeBudgetMs: 240_000,
  })

  return NextResponse.json(
    { ok: true, result },
    { headers: { "cache-control": "no-store, max-age=0" } }
  )
}
