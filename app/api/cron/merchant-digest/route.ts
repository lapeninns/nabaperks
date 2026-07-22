import { type NextRequest } from "next/server"

import { noStoreJson } from "@/lib/http/no-store-json"
import { runMerchantWeeklyDigest } from "@/lib/notifications/merchant-digest"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson({ error: "unauthorized" }, 401)
  }

  const result = await runMerchantWeeklyDigest()

  return noStoreJson({ ok: true, result })
}
