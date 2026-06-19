import { NextResponse } from "next/server"

import { getCustomerRewardState } from "@/lib/customer/reward"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The live reward page polls this while it waits for the merchant scan, so every
// response must be revalidated — never served from a cache, proxy, or bfcache.
const NO_STORE = "no-store, max-age=0"

type RewardStatusRouteContext = {
  params: Promise<{
    rewardId: string
  }>
}

/**
 * Read-only redemption status for a customer-held reward. Reuses
 * {@link getCustomerRewardState}, which resolves the customer session and reward
 * ownership, then returns only what the live confirmation needs. It observes
 * `reward_events.status`; it never mutates — the merchant scan is the sole
 * redemption path.
 */
export async function GET(
  _request: Request,
  context: RewardStatusRouteContext
) {
  const { rewardId } = await context.params
  const rewardState = await getCustomerRewardState(rewardId)

  if (rewardState.status === "unauthenticated") {
    return json({ error: "unauthenticated" }, 401)
  }

  if (rewardState.status !== "ready") {
    // `not_found` and `unauthorized` collapse to one 404 so the endpoint never
    // reveals whether a reward the caller cannot see exists.
    return json({ error: "not_found" }, 404)
  }

  const { reward } = rewardState
  return json(
    {
      redeemed: reward.status === "redeemed",
      status: reward.status,
      redeemedAt: reward.redeemed_at,
    },
    200
  )
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": NO_STORE },
  })
}
