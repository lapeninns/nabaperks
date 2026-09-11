"use server"

import { redirect } from "next/navigation"

/**
 * Harness-only stand-in for startInviteClaimAction. It must not mint an invite
 * cookie or a membership — the live write path stays in tests/db.
 */
export async function harnessStartInviteClaimAction(): Promise<void> {
  redirect("/dev/home-harness/invite-claim?state=claimed")
}
