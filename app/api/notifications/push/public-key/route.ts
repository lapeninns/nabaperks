import { NextResponse } from "next/server"

import { getWebPushPublicKey } from "@/lib/notifications/push-subscriptions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const publicKey = getWebPushPublicKey()

  return NextResponse.json(
    { enabled: Boolean(publicKey), publicKey },
    { headers: { "cache-control": "no-store, max-age=0" } }
  )
}
