import { NextResponse, type NextRequest } from "next/server"

import { runMerchantWeeklyDigest } from "@/lib/notifications/merchant-digest"

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

  const result = await runMerchantWeeklyDigest()

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
