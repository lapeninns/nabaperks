import { NextResponse, type NextRequest } from "next/server"

import { runPushNotificationDeliveryWorker } from "@/lib/notifications/delivery-worker"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store, max-age=0" } }
    )
  }

  const result = await runPushNotificationDeliveryWorker()

  return NextResponse.json(
    { ok: true, result },
    { headers: { "cache-control": "no-store, max-age=0" } }
  )
}

function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  return request.headers.get("authorization") === `Bearer ${secret}`
}
