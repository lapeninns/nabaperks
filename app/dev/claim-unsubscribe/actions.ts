"use server"

import { notFound, redirect } from "next/navigation"

/**
 * Harness-only stand-in for unsubscribeRewardInviteAction. It must not call
 * the suppress RPC — live writes stay in tests/db.
 */
export async function harnessClaimUnsubscribeAction(): Promise<void> {
  if (process.env.NODE_ENV === "production") notFound()
  redirect("/dev/claim-unsubscribe?state=done")
}
