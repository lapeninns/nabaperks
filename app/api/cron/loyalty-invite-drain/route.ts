import { NextResponse, type NextRequest } from "next/server"

import { runLoyaltyInviteDrain } from "@/lib/loyalty-invites/delivery-worker"
import { runObservedCron } from "@/lib/observability/cron-run"
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth"

/**
 * Five-minute cron that drains queued bulk loyalty invitations. Authorised by
 * the shared timing-safe CRON_SECRET guard; the durable worker leases and sends
 * up to 800 emails at <=4 Resend requests per second.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const NO_STORE = { "cache-control": "no-store, max-age=0" }

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    )
  }

  const observed = await runObservedCron({
    job: "loyalty-invite-drain",
    run: () => runLoyaltyInviteDrain(),
    isSuccessful: (result) => result.skipped === undefined,
    failureCode: (result) => result.skipped ?? "worker_unavailable",
  })

  return observed.ok
    ? NextResponse.json(
        { ok: true, result: observed.value },
        { headers: NO_STORE }
      )
    : NextResponse.json(
        { ok: false, error: "cron_failed" },
        { status: 500, headers: NO_STORE }
      )
}
