"use server"

import { redirect } from "next/navigation"

/**
 * Harness-only stand-in for unsubscribeRewardInviteAction. It must not call
 * the suppress RPC — live writes stay in tests/db.
 */
export async function harnessClaimUnsubscribeAction(): Promise<void> {
  redirect("/dev/claim-unsubscribe?state=done")
}
