"use server"

import { notFound, redirect } from "next/navigation"

/**
 * Harness-only stand-in for startInviteClaimAction. It must not mint an invite
 * cookie or a membership — the live write path stays in tests/db.
 */
export async function harnessStartInviteClaimAction(): Promise<void> {
  if (process.env.NODE_ENV === "production") notFound()
  redirect("/dev/home-harness/invite-claim?state=claimed")
}
